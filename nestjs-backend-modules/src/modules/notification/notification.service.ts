import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";

import { canonicalStoredNumber, dialingDigits } from "@/common/utils/phone-identity.util";

import { Prisma, User, UserDevice, UserNotificationPreference } from "../../../generated/prisma/client";
import {
  DeliveryChannel,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  NotificationCategory,
  NotificationEventType,
} from "./constants/notification.constants";
import { CreateNotificationDto, NotificationResponseDto } from "./dto/notification.dto";
import {
  IdempotencyConflictError,
  InvalidNotificationEventError,
  InvalidNotificationPayloadError,
  NotificationNotFoundError,
  NotificationNotOwnedError,
} from "./errors/notification.errors";
import { NotificationPayloadByType } from "./interfaces/notification-payload.interface";
import { NotificationRepository } from "./notification.repository";
import { NotificationPolicyService } from "./services/notification-policy.service";
import { NotificationTemplateService } from "./services/notification-template.service";

// ==========================================
// Runtime payload validation
// ==========================================
// The /internal/notifications/events controller accepts payload as
// `Record<string, unknown>` because class-validator cannot natively check the
// 22-way discriminated union shape. We re-narrow the payload at the publish
// boundary so structural defects (missing/mistyped fields) are rejected
// before any outbox row is created.

type FieldKind = "string" | "number" | "date";

interface FieldSpec {
  kind: FieldKind;
  optional?: boolean;
}

type EventSchema<T extends NotificationEventType> = {
  [K in keyof NotificationPayloadByType[T]]: FieldSpec;
};

type PayloadSchemas = {
  [K in NotificationEventType]: EventSchema<K>;
};

const PAYLOAD_SCHEMAS: PayloadSchemas = {
  [NotificationEventType.KYC_PENDING]: {
    userName: { kind: "string" },
  },
  [NotificationEventType.KYC_REJECTED]: {
    reason: { kind: "string" },
  },
  [NotificationEventType.KYC_APPROVED]: {
    userName: { kind: "string" },
    approvedAt: { kind: "date" },
  },
  [NotificationEventType.KYC_REVERIFICATION_REQUIRED]: {
    userName: { kind: "string" },
  },
  [NotificationEventType.KYC_REVERIFICATION_REQUIRED_ADMIN]: {
    userName: { kind: "string" },
  },
  [NotificationEventType.KYC_REVERIFICATION_SUCCESS]: {
    userName: { kind: "string" },
  },
  [NotificationEventType.KYC_REVERIFICATION_SUSPENDED]: {
    userName: { kind: "string" },
    suspendedAt: { kind: "date" },
  },
  [NotificationEventType.REMITTANCE_PROCESSING]: {
    amount: { kind: "number" },
    currency: { kind: "string" },
    recipientName: { kind: "string" },
  },
  [NotificationEventType.REMITTANCE_DELAYED]: {
    recipientName: { kind: "string" },
  },
  [NotificationEventType.REMITTANCE_FAILED]: {
    transferId: { kind: "string" },
    amount: { kind: "number" },
    currency: { kind: "string" },
    recipientName: { kind: "string" },
    reason: { kind: "string" },
    deepLink: { kind: "string", optional: true },
  },
  [NotificationEventType.REMITTANCE_COMPLETED]: {
    amount: { kind: "number" },
    currency: { kind: "string" },
    recipientName: { kind: "string" },
  },
  [NotificationEventType.LIMIT_WARNING]: {
    remainingLimit: { kind: "number" },
  },
  [NotificationEventType.FX_ALERT]: {
    currency: { kind: "string" },
    targetRate: { kind: "number" },
    currentRate: { kind: "number" },
  },
  [NotificationEventType.TICKET_RECEIVED]: {
    ticketId: { kind: "string" },
  },
  [NotificationEventType.TICKET_RESOLVED]: {
    ticketSubject: { kind: "string" },
  },
  [NotificationEventType.REFERRAL_JOINED]: {
    friendName: { kind: "string" },
  },
  [NotificationEventType.REFERRAL_REWARDED]: {
    rewardAmount: { kind: "number" },
    currency: { kind: "string" },
  },
  [NotificationEventType.FDS_ALERT]: {
    amount: { kind: "number" },
  },
  [NotificationEventType.NEW_DEVICE_LOGIN]: {
    deviceModel: { kind: "string" },
  },
  [NotificationEventType.SUSPICIOUS_TRANSFER]: {
    amount: { kind: "number" },
    recipientName: { kind: "string" },
  },
  [NotificationEventType.SYSTEM_DOWNTIME]: {
    node: { kind: "string", optional: true },
    lossRate: { kind: "string", optional: true },
    sysCode: { kind: "string", optional: true },
  },
  [NotificationEventType.AUDIT_SENSITIVE_ACCESS]: {
    adminName: { kind: "string" },
    ipAddress: { kind: "string" },
    resourceName: { kind: "string", optional: true },
    sysCode: { kind: "string", optional: true },
  },
  [NotificationEventType.AUDIT_ACCOUNT_CREATION]: {
    targetAccount: { kind: "string" },
    sysCode: { kind: "string", optional: true },
  },
  [NotificationEventType.AUDIT_PERSONAL_DATA]: {
    adminName: { kind: "string" },
    targetUser: { kind: "string" },
    sysCode: { kind: "string", optional: true },
  },
  [NotificationEventType.AUDIT_CUSTOMER_FUNDS]: {
    amount: { kind: "number" },
    targetUser: { kind: "string" },
    sysCode: { kind: "string", optional: true },
  },
  [NotificationEventType.AUDIT_FX_DEPOSIT]: {
    adminName: { kind: "string" },
    sysCode: { kind: "string", optional: true },
  },
};

function matchesFieldKind(value: unknown, kind: FieldKind): boolean {
  switch (kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "date":
      return value instanceof Date || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
  }
}

function validateNotificationPayload<T extends NotificationEventType>(
  type: T,
  payload: Record<string, unknown>,
): NotificationPayloadByType[T] {
  const schema = PAYLOAD_SCHEMAS[type] as Record<string, FieldSpec> | undefined;
  if (!schema) {
    throw new InvalidNotificationPayloadError(type, ["no schema registered for this event type"]);
  }

  const issues: string[] = [];

  for (const [field, spec] of Object.entries(schema)) {
    const value = payload[field];
    if (value === undefined || value === null) {
      if (!spec.optional) issues.push(`"${field}" is required`);
      continue;
    }
    if (!matchesFieldKind(value, spec.kind)) {
      issues.push(`"${field}" must be ${spec.kind}`);
    }
  }

  if (issues.length > 0) {
    throw new InvalidNotificationPayloadError(type, issues);
  }

  return payload as unknown as NotificationPayloadByType[T];
}

/**
 * Type alias to eliminate 'any' usage when handling user data with relations.
 */
type UserWithContext = User & {
  devices: UserDevice[];
  preferences: UserNotificationPreference[];
};

// Idempotency keys are pruned after 7 days — covers the 72h KYC polling window
// and webhook retries with margin.
const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mapping table to convert string labels from the template engine to database integers.
 */
const PRIORITY_MAP: Record<string, number> = {
  [NOTIFICATION_PRIORITY.URGENT]: 10,
  [NOTIFICATION_PRIORITY.HIGH]: 7,
  [NOTIFICATION_PRIORITY.MEDIUM]: 5,
  [NOTIFICATION_PRIORITY.LOW]: 1,
};

/**
 * Inverse mapping to convert database integers back to UI labels.
 */
const REVERSE_PRIORITY_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(PRIORITY_MAP).map(([k, v]) => [v, k]),
);

/**
 * Strategy Map for resolving target endpoints based on the delivery channel.
 */
/**
 * Builds an E.164 recipient from a stored phone identity. Tolerates both the
 * canonical "+82" dialing shape and legacy ISO-stored rows ("KR"): an ISO code
 * has no dialing digits, so we return null rather than emit a malformed
 * "KR1099998888" that the SMS/Alimtalk gateway silently rejects.
 */
const toE164Recipient = (user: UserWithContext): string | null => {
  if (!user.phoneNumber || !user.phoneCountryCode) return null;
  const cc = dialingDigits(user.phoneCountryCode);
  if (!cc) return null;
  return `+${cc}${canonicalStoredNumber(user.phoneNumber)}`;
};

const TARGET_RESOLVERS: Record<string, (user: UserWithContext) => string[]> = {
  PUSH: (user) => user.devices?.filter((d) => d.isActive).map((d) => d.token) ?? [],
  EMAIL: (user) => (user.email ? [user.email] : []),
  SMS: (user) => {
    const to = toE164Recipient(user);
    return to ? [to] : [];
  },
  KAKAO: (user) => {
    const to = toE164Recipient(user);
    return to ? [to] : [];
  },
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly templateService: NotificationTemplateService,
    private readonly policyService: NotificationPolicyService, // Injecting the external Policy Service
  ) {}

  /**
   * Main logic for publishing notification events.
   * Checks for legal and business policies using NotificationPolicyService.
   */
  async publish(userId: string, dto: CreateNotificationDto, traceId?: string, tx?: Prisma.TransactionClient) {
    const user = (await this.repository.findUserContext(userId)) as UserWithContext | null;
    if (!user) throw new NotFoundException("user_not_found");

    const eventType: NotificationEventType = dto.type;

    /**
     * STEP 1: Validate Template Existence
     * Checks if the requested event type exists in our Template Registry.
     * This activates 'InvalidNotificationEventError' (No longer grey).
     */
    if (!this.templateService.exists(eventType)) {
      throw new InvalidNotificationEventError();
    }

    // STEP 2: Validate payload shape, then render. The validator narrows
    // `dto.payload` (Record<string, unknown>) to the typed payload that the
    // template renderer expects — silent failures caused by missing/mistyped
    // fields are rejected here before any outbox row is created.
    const typedPayload = validateNotificationPayload(eventType, dto.payload);
    // In-app (bell) copy — uses the DB override (channel omitted → non-KAKAO).
    const uiData = await this.templateService.render(eventType, typedPayload, user.locale);
    const numericPriority: number = PRIORITY_MAP[uiData.priority as keyof typeof PRIORITY_MAP] ?? 1;

    // Idempotency: hash the body so the same key reused with a different
    // notification is rejected (409); a same-key+same-body retry is skipped.
    if (dto.idempotencyKey) {
      const requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            type: dto.type,
            category: dto.category,
            channels: [...dto.channels].sort(),
            payload: dto.payload,
          }),
        )
        .digest("hex");
      const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
      const outcome = await this.repository.reserveIdempotency(dto.idempotencyKey, requestHash, expiresAt, tx);
      if (outcome === "CONFLICT") throw new IdempotencyConflictError();
      if (outcome === "DUPLICATE") return [];
    }

    /**
     * STEP 3: Resolve final channels based on user preferences and fallback logic.
     */
    // No active token → push job is never created and its failure-driven fallback
    // never fires, so substitute Alimtalk up front to keep reach for these users.
    const hasActivePushToken = (user.devices ?? []).some((device) => device.isActive);

    const finalChannels = new Set<DeliveryChannel>();
    for (const channel of dto.channels) {
      const pref = user.preferences?.find((p) => p.channel === channel);
      const isEnabled = pref ? pref.isOptIn : true;
      const isTransactional = dto.category === NotificationCategory.TRANSACTIONAL;

      // Opted-out PUSH on a transactional message → reach the user via SMS.
      if (!isEnabled && channel === DeliveryChannel.PUSH && isTransactional) {
        finalChannels.add(DeliveryChannel.SMS);
        continue;
      }

      // Opted out and not forced by a transactional category → skip the channel.
      if (!isEnabled && !isTransactional) {
        continue;
      }

      // No active token → push can't be delivered; substitute Alimtalk instead.
      if (channel === DeliveryChannel.PUSH && !hasActivePushToken) {
        finalChannels.add(DeliveryChannel.KAKAO);
        continue;
      }

      finalChannels.add(channel);
    }

    /**
     * STEP 4: Keep only the channels policy-allowed for this user/category.
     */
    const allowedChannels = Array.from(finalChannels).filter((channel) =>
      this.policyService.isAllowed(user, dto.category, channel),
    );

    /**
     * STEP 5: Record the in-app (bell-icon) notification when at least one
     * channel is allowed — visible even if delivery fails; opted-out marketing
     * has no allowed channel, so it leaves no record.
     */
    if (allowedChannels.length > 0) {
      await this.repository.createNotification(
        {
          userId,
          type: eventType,
          title: uiData.title,
          message: uiData.message,
          priority: String(numericPriority),
        },
        tx,
      );
    }

    /**
     * STEP 6: One Outbox job per target on each allowed channel (already
     * policy-filtered in STEP 4). Created sequentially with await: a shared
     * interactive transaction (tx) runs on a single connection, so firing the
     * writes concurrently via Promise.all risks deadlocks and timeouts.
     */
    const outboxes: Awaited<ReturnType<NotificationRepository["createOutbox"]>>[] = [];
    for (const channel of allowedChannels) {
      for (const target of this.resolveTargets(user, channel)) {
        const outbox = await this.repository.createOutbox(
          {
            user: { connect: { id: userId } },
            traceId,
            channel,
            category: dto.category,
            targetValue: target,
            templateId: eventType,
            payload: dto.payload as Prisma.InputJsonValue,
            priority: numericPriority,
            status: NOTIFICATION_STATUS.PENDING,
            locale: user.locale,
          },
          tx,
        );
        outboxes.push(outbox);
      }
    }

    return outboxes;
  }

  // ==========================================
  // UI Actions (Notification Panel)
  // ==========================================

  /**
   * Fetches paginated user notifications.
   */
  async getUserNotifications(userId: string, page: number, limit: number): Promise<NotificationResponseDto[]> {
    const rawData = await this.repository.getUserNotifications(userId, page, limit);

    return rawData.map(
      (item) =>
        new NotificationResponseDto({
          id: item.id,
          priority: REVERSE_PRIORITY_MAP[Number(item.priority)] || NOTIFICATION_PRIORITY.LOW,
          title: item.title,
          message: item.message,
          sysCode: item.type,
          createdAt: item.createdAt,
        }),
    );
  }

  /**
   * Returns the count of unread notifications for the app badge.
   */
  async getUnreadCount(userId: string) {
    return this.repository.getUnreadCount(userId);
  }

  /**
   * Marks a specific notification as read after verifying ownership.
   */
  async markAsRead(userId: string, notificationId: string) {
    await this.verifyOwnership(userId, notificationId);
    return this.repository.markAsRead(notificationId);
  }

  /**
   * Deletes a notification after verifying ownership.
   */
  async deleteNotification(userId: string, notificationId: string) {
    await this.verifyOwnership(userId, notificationId);
    return this.repository.deleteUserNotification(notificationId);
  }

  // ==========================================
  // Internal Helper Methods
  // ==========================================

  /**
   * Enforces Single Responsibility Principle by verifying data ownership separately.
   */
  private async verifyOwnership(userId: string, notificationId: string) {
    const notification = await this.repository.findById(notificationId);

    if (!notification) {
      throw new NotificationNotFoundError();
    }
    if (notification.userId !== userId) {
      throw new NotificationNotOwnedError();
    }
    return notification;
  }

  /**
   * Extracts specific recipient info (Tokens/Emails) based on the delivery channel.
   */
  private resolveTargets(user: UserWithContext, channel: string): string[] {
    const resolver = TARGET_RESOLVERS[channel] || (() => []);
    return resolver(user);
  }
}
