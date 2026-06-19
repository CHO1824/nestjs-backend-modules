import { HttpStatus } from "@nestjs/common";

import { AppError } from "@/common/errors/app.error";

/**
 * Triggered when an external provider (Mailgun, FCM) fails to deliver.
 */
export class NotificationDeliveryError extends AppError {
  constructor(channel: string) {
    // Pass 3 arguments to match the parent AppError signature: code, message, status
    super(
      `DELIVERY_FAILED_${channel.toUpperCase()}`,
      `Delivery failed for channel: ${channel}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * Push delivery failure tagged permanent (invalid/dead token — no retry) or
 * transient (5xx/network — retry). The worker reads `permanent` to decide.
 */
export class PushDeliveryError extends NotificationDeliveryError {
  constructor(
    readonly permanent: boolean,
    readonly reason?: string,
  ) {
    super("PUSH");
  }
}

/**
 * Triggered when the recipient's contact info (email/token) is missing.
 */
export class RecipientNotFoundError extends AppError {
  constructor() {
    super("RECIPIENT_NOT_FOUND", "Recipient contact info is missing", HttpStatus.NOT_FOUND);
  }
}

/**
 * Triggered when the requested notification id does not exist.
 */
export class NotificationNotFoundError extends AppError {
  constructor() {
    super("NOTIFICATION_NOT_FOUND", "Notification not found", HttpStatus.NOT_FOUND);
  }
}

/**
 * Triggered when a notification exists but belongs to another user. Kept
 * distinct from NotificationNotFoundError so callers can distinguish
 * "row is gone" from "you do not own this row".
 */
export class NotificationNotOwnedError extends AppError {
  constructor() {
    super("NOTIFICATION_NOT_OWNED", "Notification does not belong to the caller", HttpStatus.FORBIDDEN);
  }
}

/**
 * Triggered when an unsupported notification event type is requested.
 */
export class InvalidNotificationEventError extends AppError {
  constructor() {
    super("INVALID_NOTIFICATION_EVENT", "The requested notification event is not supported", HttpStatus.BAD_REQUEST);
  }
}

/**
 * Triggered when an external provider SDK exceeds the worker-side timeout
 * ceiling. Routed through handleFailure -> incrementRetry, never surfaced as
 * an HTTP response. The 504 status reflects the underlying semantics for
 * observability.
 */
export class SenderTimeoutError extends AppError {
  constructor(channel: string, timeoutMs: number) {
    super(
      `SENDER_TIMEOUT_${channel.toUpperCase()}`,
      `Sender for channel ${channel} exceeded ${timeoutMs}ms`,
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }
}

/**
 * Triggered when an incoming payload does not match the structural contract
 * declared for its notification event type (missing or mistyped fields).
 */
export class InvalidNotificationPayloadError extends AppError {
  constructor(type: string, issues: string[]) {
    super(
      "INVALID_NOTIFICATION_PAYLOAD",
      `Payload validation failed for event "${type}": ${issues.join("; ")}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * InternalApiKeyGuard — server has no INTERNAL_API_KEY configured, so the
 * /internal/* surface refuses every call (fail closed).
 */
export class InternalEndpointDisabledError extends AppError {
  constructor() {
    super(
      "INTERNAL_ENDPOINT_DISABLED",
      "Internal endpoint disabled: INTERNAL_API_KEY is not configured on the server.",
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * InternalApiKeyGuard — caller did not present X-Internal-Token.
 */
export class InternalTokenMissingError extends AppError {
  constructor() {
    super("INTERNAL_TOKEN_MISSING", "Missing X-Internal-Token header", HttpStatus.UNAUTHORIZED);
  }
}

/**
 * InternalApiKeyGuard — caller's token did not match the configured value.
 */
export class InternalTokenInvalidError extends AppError {
  constructor() {
    super("INTERNAL_TOKEN_INVALID", "Invalid internal API token", HttpStatus.UNAUTHORIZED);
  }
}

/**
 * publish() received an idempotency key already used with a different request body.
 */
export class IdempotencyConflictError extends AppError {
  constructor() {
    super(
      "NOTIFICATION_IDEMPOTENCY_CONFLICT",
      "Idempotency key already used with a different request",
      HttpStatus.CONFLICT,
    );
  }
}
