import { Injectable, Logger } from "@nestjs/common";
import * as admin from "firebase-admin";

import { PushDeliveryError, RecipientNotFoundError } from "../errors/notification.errors";
import { NotificationSender, RenderedContent } from "../interfaces/notification-sender.interface";
import { NotificationRepository } from "../notification.repository";

// FCM error codes meaning the token itself is dead/unregistered (app uninstalled
// or token rotated). These get deactivated so future sends skip them.
const UNREGISTERED_FCM_ERROR_CODES = new Set<string>([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

// FCM error codes that never succeed on retry (invalid/dead token, bad request).
// A batch failing only on these is permanent; everything else is transient.
const PERMANENT_FCM_ERROR_CODES = new Set<string>([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-recipient",
  "messaging/invalid-argument",
  "messaging/mismatched-credential",
  "messaging/third-party-auth-error",
]);

@Injectable()
export class PushSender implements NotificationSender {
  private readonly logger = new Logger(PushSender.name);
  readonly channel = "PUSH";

  constructor(private readonly repository: NotificationRepository) {}

  async send(outboxId: string, recipientInfo: string | string[], content: RenderedContent): Promise<void> {
    const tokens = Array.isArray(recipientInfo) ? recipientInfo : [recipientInfo];
    if (!tokens[0]) throw new RecipientNotFoundError();

    // Firebase init (NotificationModule.onModuleInit) is skipped in dev when ADC
    // credentials are absent — no-op here so dev/test don't pile up FAILED rows.
    if (admin.apps.length === 0) {
      this.logger.log(
        `[MOCK PUSH] Outbox ID: ${outboxId} - Send to ${tokens.length} token(s) skipped (Firebase not initialized)`,
      );
      return;
    }

    let response: admin.messaging.BatchResponse;
    try {
      response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: {
          title: content.title,
          body: content.message,
        },
      });
    } catch (error: unknown) {
      // SDK threw instead of returning per-token results. Usually transient
      // (network), but config errors (bad credential, invalid argument) carry a
      // permanent FCM code — classify by `code` so we don't retry those.
      const code = this.errorCode(error);
      const permanent = !!code && PERMANENT_FCM_ERROR_CODES.has(code);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[PushSender] Outbox ID: ${outboxId} - Failed: ${message}`);
      throw new PushDeliveryError(permanent, code ?? message);
    }

    this.logger.log(
      `[PushSender] Outbox ID: ${outboxId} - Success: ${response.successCount}, Fail: ${response.failureCount}`,
    );

    // Deactivate tokens FCM reported as dead so future sends skip them.
    await this.deactivateUnregisteredTokens(outboxId, tokens, response);

    // All tokens rejected → fail so the worker retries/falls back. FCM resolves
    // even when every token fails, so without this the job would be marked SENT.
    if (response.successCount === 0) {
      // Permanent (dead token) → no retry; transient (5xx) → worker retries.
      const permanent = this.isAllPermanent(response);
      const reason = this.firstErrorCode(response);
      throw new PushDeliveryError(permanent, reason);
    }
  }

  /** True only if every failed token is permanent (one transient → retryable). */
  private isAllPermanent(response: admin.messaging.BatchResponse): boolean {
    const failures = response.responses.filter((r) => !r.success);
    if (failures.length === 0) return false;
    return failures.every((r) => !!r.error && PERMANENT_FCM_ERROR_CODES.has(r.error.code));
  }

  /** First failing token's FCM error code, for the failure log/reason. */
  private firstErrorCode(response: admin.messaging.BatchResponse): string | undefined {
    return response.responses.find((r) => !r.success)?.error?.code;
  }

  /** Reads the FCM `code` field off a thrown SDK error, if present. */
  private errorCode(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === "string" ? code : undefined;
    }
    return undefined;
  }

  /**
   * Soft-deletes (isActive=false) tokens FCM rejected as unregistered/invalid.
   * Best-effort: a cleanup failure is logged but never masks the send result.
   */
  private async deactivateUnregisteredTokens(
    outboxId: string,
    tokens: string[],
    response: admin.messaging.BatchResponse,
  ): Promise<void> {
    const dead = response.responses
      .map((r, i) => (!r.success && r.error && UNREGISTERED_FCM_ERROR_CODES.has(r.error.code) ? tokens[i] : null))
      // Keep only real tokens — drop null/undefined (index mismatch) and blank strings.
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (dead.length === 0) return;

    try {
      const { count } = await this.repository.deactivateDevicesByTokens(dead);
      this.logger.log(`[PushSender] Outbox ID: ${outboxId} - Deactivated ${count} dead token(s)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[PushSender] Outbox ID: ${outboxId} - Dead-token cleanup failed: ${message}`);
    }
  }
}
