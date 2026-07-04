import { Inject, Injectable, Logger } from "@nestjs/common";

import { NotificationChannel, NotificationDeliveryStatus } from "../../../../generated/prisma/client";
import { SENS_VENDOR, SensVendor } from "../interfaces/sens-vendor.interface";
import { NotificationRepository } from "../notification.repository";

@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    private readonly repository: NotificationRepository,
    @Inject(SENS_VENDOR) private readonly sens: SensVendor,
  ) {}

  /**
   * Sends via Alimtalk, falling back to SMS on a request-level failure.
   * claimLockedAt fences the delivery write against withSenderTimeout orphans.
   */
  async sendWithFallback(
    eventId: string,
    recipient: string,
    title: string,
    body: string,
    templateCode: string,
    claimLockedAt: Date,
  ): Promise<boolean> {
    // Attempt 1: Alimtalk. smsFailoverContent enables NCP-native failover for
    // delivery failures; this backend fallback covers request failures.
    let result = await this.sens.sendAlimtalk({
      templateCode,
      to: recipient,
      content: body,
      smsFailoverContent: `[VPAY] ${title}\n${body}`,
    });

    // Attempt 2: SMS fallback if the Alimtalk request itself failed.
    if (!result.success) {
      this.logger.warn(`[Fallback] Alimtalk failed, switching to SMS. Target: ${recipient}, Reason: ${result.error}`);
      result = await this.sens.sendSms({ to: recipient, content: `[VPAY] ${title}\n${body}` });
    }

    // Record the delivery log conditionally — only if the worker's claim
    // is still active. Prevents duplicate records when this promise was
    // orphaned by withSenderTimeout.
    const written = await this.repository.recordDeliveryForActiveClaim(eventId, claimLockedAt, {
      eventId,
      channel: result.channel as NotificationChannel,
      provider: result.provider,
      externalId: result.externalId,
      cost: result.cost,
      recipient,
      templateCode,
      renderedTitle: title,
      renderedBody: body,
      status: result.success ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
      failureReason: result.error,
      sentAt: result.success ? new Date() : null,
    });

    if (!written) {
      this.logger.warn(
        `[Sender] Outbox ${eventId} no longer holds active claim (likely timed out) — skipping delivery write`,
      );
    }

    return result.success;
  }
}
