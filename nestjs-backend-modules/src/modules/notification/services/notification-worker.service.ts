import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { NotificationOutbox, Prisma } from "../../../../generated/prisma/client";
import { NotificationEventType } from "../constants/notification.constants";
import { PushDeliveryError, SenderTimeoutError } from "../errors/notification.errors";
import { NotificationPayloadByType } from "../interfaces/notification-payload.interface";
import { NotificationSender, RenderedContent } from "../interfaces/notification-sender.interface";
import { NotificationRepository } from "../notification.repository";
import { NotificationTemplateService } from "../services/notification-template.service";
import { NotificationPolicyService } from "./notification-policy.service";
import { NotificationSenderService } from "./notification-sender.service";

type OutboxJob = NotificationOutbox;

// Firebase Admin / Mailgun SDKs have no built-in request timeout. Without a
// ceiling, a single hung send blocks Promise.allSettled in handleQueue,
// leaves isProcessing=true, and freezes the entire worker line until the 1h
// reapStuckNotifications run.
const SENDER_TIMEOUT_MS = 15_000;

// Push failures are most often permanent (invalid token / app uninstalled), so
// a single short retry is enough to absorb transient FCM/network blips before
// falling back to the paid Alimtalk channel. The 10s base sits well above the
// worker's 3s tick so a retry actually waits before re-attempting.
const PUSH_MAX_RETRIES = 1;
const PUSH_RETRY_BACKOFF_BASE_MS = 10_000;

// Other channels (EMAIL) keep the original, more forgiving budget. SMTP delivery
// routinely hits transient failures (greylisting, temporary 4xx) that clear only
// after a longer wait, so a 3-retry / 60s exponential backoff protects deliverability.
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BACKOFF_BASE_MS = 60_000;

@Injectable()
export class NotificationWorkerService {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private isProcessing = false;

  constructor(
    private readonly repository: NotificationRepository,
    private readonly templateService: NotificationTemplateService,
    private readonly senderService: NotificationSenderService,
    private readonly policyService: NotificationPolicyService,
    @Inject("NOTIFICATION_SENDERS")
    private readonly senders: NotificationSender[],
  ) {}

  @Cron("*/3 * * * * *")
  async handleQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      const jobs = await this.repository.claimPendingBatch(10);
      if (jobs.length > 0) {
        const results = await Promise.allSettled(jobs.map((job) => this.processJob(job)));
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
            this.logger.error(`[Worker] Job ${jobs[index].id} raised an unhandled error: ${reason}`);
          }
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Housekeeping: drop expired idempotency keys so the dedup table stays small.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneIdempotencyKeys() {
    const { count } = await this.repository.pruneExpiredIdempotency();
    if (count > 0) this.logger.log(`[Idempotency] pruned ${count} expired key(s)`);
  }

  private async processJob(job: OutboxJob) {
    try {
      // Outbox stores payload/templateId as Prisma JSON/string. The publish()
      // boundary already validated structure against NotificationPayloadByType,
      // so re-narrow with `as` here at the dispatch site without re-running
      // the validator on every queue tick.
      const eventType = job.templateId as NotificationEventType;
      const typedPayload = job.payload as unknown as NotificationPayloadByType[NotificationEventType];

      /**
       * Handle KAKAO or SMS using the specialized SenderService (with Fallback logic)
       */
      if (job.channel === "KAKAO" || job.channel === "SMS") {
        const content = this.templateService.render(eventType, typedPayload, job.locale);

        // job.lockedAt is set by claimPendingBatch and acts as the fence
        // the sender uses when writing the delivery log — see
        // NotificationRepository.recordDeliveryForActiveClaim.
        if (!job.lockedAt) {
          throw new Error(`Job ${job.id} missing lockedAt — claim invariant violated`);
        }

        const success = await this.withSenderTimeout(
          job.channel,
          this.senderService.sendWithFallback(
            job.id,
            job.targetValue,
            content.title,
            content.message,
            job.templateId,
            job.lockedAt,
          ),
        );

        if (success) {
          await this.repository.updateStatus(job.id, "SENT");
        } else {
          throw new Error("Fallback delivery failed");
        }
        return;
      }

      /**
       * Handle PUSH or EMAIL using the standard providers
       */
      const sender = this.senders.find((s) => s.channel === job.channel);
      if (!sender) throw new Error(`Unsupported channel: ${job.channel}`);

      const content: RenderedContent = this.templateService.render(eventType, typedPayload, job.locale);
      await this.withSenderTimeout(job.channel, sender.send(job.id, job.targetValue, content));

      await this.repository.updateStatus(job.id, "SENT");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Worker] Job ${job.id} failed: ${message}`);

      // Timeout is result-unknown — the provider call may still succeed.
      // Leave PROCESSING; reapStuckNotifications requeues after 15 min.
      if (error instanceof SenderTimeoutError) {
        return;
      }
      await this.handleFailure(job, message, error);
    }
  }

  private async handleFailure(job: OutboxJob, errorLog: string, error?: unknown) {
    const maxRetries = job.channel === "PUSH" ? PUSH_MAX_RETRIES : DEFAULT_MAX_RETRIES;
    // Permanent push failure (dead token) never succeeds on retry → skip to
    // FAILED + fallback. Transient falls through to the backoff retry.
    const isPermanent = error instanceof PushDeliveryError && error.permanent;

    if (isPermanent || job.retryCount >= maxRetries) {
      await this.repository.updateStatus(job.id, "FAILED", errorLog);
      if (job.channel === "PUSH") {
        await this.enqueuePushFallback(job, errorLog);
      }
      return;
    }
    const backoffBaseMs = job.channel === "PUSH" ? PUSH_RETRY_BACKOFF_BASE_MS : DEFAULT_RETRY_BACKOFF_BASE_MS;
    const delayMs = backoffBaseMs * Math.pow(2, job.retryCount);
    const nextRetryAt = new Date(Date.now() + delayMs);
    await this.repository.incrementRetry(job.id, nextRetryAt, errorLog);
  }

  /**
   * Keeps the user reachable when an app push can't be delivered: falls back to
   * KakaoTalk Alimtalk, then SMS. No-ops (with a warning) when the user has no
   * phone number on file.
   */
  private async enqueuePushFallback(job: OutboxJob, reason: string) {
    const user = await this.repository.findUserContext(job.userId);

    // Apply the same consent policy as the normal publish path: never push a
    // marketing message onto a channel the user did not opt into (or during
    // quiet hours). TRANSACTIONAL is always allowed, so transfer/KYC alerts pass.
    if (!user || !this.policyService.isAllowed(user, job.category, "KAKAO")) {
      this.logger.warn(
        `[Fallback] PUSH job ${job.id}: KAKAO fallback not allowed by policy for user ${job.userId} — skipping`,
      );
      return;
    }

    // Build the full international number. Strip a leading 0 (local format)
    // before prepending the country code — otherwise gateways reject numbers
    // like +8201012345678. Both the number and the country code are required.
    const cleanPhone = user.phoneNumber?.replace(/^0/, "");
    const phone = cleanPhone && user.phoneCountryCode ? `${user.phoneCountryCode}${cleanPhone}` : null;
    if (!phone) {
      this.logger.warn(
        `[Fallback] PUSH job ${job.id}: user ${job.userId} has no usable phone number — skipping Alimtalk fallback`,
      );
      return;
    }

    await this.repository.createOutbox({
      user: { connect: { id: job.userId } },
      traceId: job.traceId,
      category: job.category,
      targetValue: phone,
      locale: job.locale,
      channel: "KAKAO",
      templateId: job.templateId,
      payload: job.payload as Prisma.InputJsonValue,
      priority: job.priority,
      status: "PENDING",
    });

    this.logger.log(
      `[Fallback] PUSH job ${job.id} exhausted (${reason}) → enqueued KAKAO Alimtalk fallback for user ${job.userId}`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanZombies() {
    await this.repository.reapStuckNotifications();
  }

  private async withSenderTimeout<T>(channel: string, promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SenderTimeoutError(channel, SENDER_TIMEOUT_MS)), SENDER_TIMEOUT_MS);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
