import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/common/prisma/prisma.service";

import { NotificationDeliveryStatus, Prisma } from "../../../generated/prisma/client";
import { NOTIFICATION_STATUS } from "./constants/notification.constants";

const STUCK_THRESHOLD_MS = 15 * 60 * 1000;

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // 1. Outbox Engine Core
  // ==========================================

  async createOutbox(data: Prisma.NotificationOutboxCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return client.notificationOutbox.create({ data });
  }

  async findUserContext(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { devices: true, preferences: true },
    });
  }

  /**
   * Soft-deletes push tokens FCM reported as dead/unregistered by flipping
   * isActive=false. The PUSH target resolver filters on isActive, so future
   * sends skip these without losing the row (re-registration re-activates it).
   */
  async deactivateDevicesByTokens(tokens: string[]) {
    if (tokens.length === 0) return { count: 0 };
    // Dedupe so the `in` filter has no redundant lookups. Callers pass tokens
    // already filtered to non-empty strings (see PushSender).
    const uniqueTokens = Array.from(new Set(tokens));
    return this.prisma.userDevice.updateMany({
      where: { token: { in: uniqueTokens }, isActive: true },
      data: { isActive: false },
    });
  }

  // Persists the in-app (bell-icon) notification so it stays visible in the
  // app even when every delivery channel fails.
  async createNotification(data: Prisma.NotificationUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return client.notification.create({ data });
  }

  // Reserves a key+hash. Returns RESERVED (new → proceed), DUPLICATE (same key and
  // hash → skip), or CONFLICT (same key, different hash → reject). ON CONFLICT DO
  // NOTHING so a duplicate never aborts the caller's tx.
  async reserveIdempotency(
    idempotencyKey: string,
    requestHash: string,
    expiresAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<"RESERVED" | "DUPLICATE" | "CONFLICT"> {
    const client = tx || this.prisma;
    const { count } = await client.notificationIdempotency.createMany({
      data: [{ idempotencyKey, requestHash, expiresAt }],
      skipDuplicates: true,
    });
    if (count > 0) return "RESERVED";

    const existing = await client.notificationIdempotency.findUnique({
      where: { idempotencyKey },
      select: { requestHash: true },
    });
    // Rare race (uncommitted concurrent insert) → treat as duplicate.
    if (!existing) return "DUPLICATE";
    return existing.requestHash === requestHash ? "DUPLICATE" : "CONFLICT";
  }

  // Drops expired idempotency keys so the table does not grow unbounded.
  async pruneExpiredIdempotency() {
    return this.prisma.notificationIdempotency.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // RETRY_WAIT rows are claimed alongside PENDING once next_retry_at passes —
  // without this, handleFailure -> incrementRetry rows would stay in
  // RETRY_WAIT forever (the reaper only sweeps PROCESSING). PENDING inserts
  // default next_retry_at to NOW() so the same predicate covers them.
  // IS NULL branch also covers legacy rows where next_retry_at is unset.
  async claimPendingBatch(limit: number) {
    return this.prisma.$transaction(async (tx) => {
      const locked: { id: string }[] = await tx.$queryRaw`
		  SELECT id FROM "notification_outbox"
		  WHERE status IN ('PENDING', 'RETRY_WAIT')
		    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
		  ORDER BY priority DESC, created_at ASC
			  LIMIT ${limit}
			  FOR UPDATE SKIP LOCKED
      `;

      if (locked.length === 0) return [];

      const ids = locked.map((l) => l.id);

      await tx.notificationOutbox.updateMany({
        where: { id: { in: ids } },
        data: {
          status: NOTIFICATION_STATUS.PROCESSING,
          lockedAt: new Date(),
        },
      });

      return tx.notificationOutbox.findMany({
        where: { id: { in: ids } },
      });
    });
  }

  async updateStatus(id: string, status: string, errorLog?: string) {
    const dataToUpdate: Prisma.NotificationOutboxUpdateInput = {
      status,
      errorLog: errorLog || null,
      // Clears the claim fence so orphaned senders fail their lockedAt check.
      lockedAt: null,
    };

    if (status === NOTIFICATION_STATUS.SENT) {
      dataToUpdate.sentAt = new Date();
    }

    return this.prisma.notificationOutbox.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async incrementRetry(id: string, nextRetryAt: Date, errorLog: string) {
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: NOTIFICATION_STATUS.RETRY_WAIT,
        retryCount: { increment: 1 },
        nextRetryAt,
        errorLog,
        // Releases the claim fence so orphaned senders abandon their write.
        lockedAt: null,
      },
    });
  }

  // 15 min ÷ 16s normal processing ceiling ≈ 50x margin.
  // Live workers cap at ~16s (sender timeout 15s + DB writes <1s),
  // so PROCESSING rows still locked past 15 min are zombies.
  async reapStuckNotifications() {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
    return this.prisma.notificationOutbox.updateMany({
      where: {
        status: NOTIFICATION_STATUS.PROCESSING,
        lockedAt: { lt: threshold },
      },
      data: {
        status: NOTIFICATION_STATUS.PENDING,
        lockedAt: null,
      },
    });
  }

  async getUserNotifications(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async findById(id: string) {
    return this.prisma.notification.findUnique({
      where: { id },
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async deleteUserNotification(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  // ==========================================
  // 2. Delivery & Dashboard Analytics
  // ==========================================

  async createDelivery(data: Prisma.NotificationDeliveryUncheckedCreateInput) {
    return this.prisma.notificationDelivery.create({ data });
  }

  // Writes the delivery only if the outbox row still holds the worker's
  // claim (status=PROCESSING and matching locked_at), under FOR UPDATE.
  // Returns false when the claim has moved on — used to block duplicate
  // writes from sender promises orphaned by withSenderTimeout.
  async recordDeliveryForActiveClaim(
    outboxId: string,
    expectedLockedAt: Date,
    data: Prisma.NotificationDeliveryUncheckedCreateInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows: { id: string }[] = await tx.$queryRaw`
        SELECT id FROM "notification_outbox"
        WHERE id = ${outboxId}::uuid
          AND status = 'PROCESSING'
          AND locked_at = ${expectedLockedAt}
        FOR UPDATE
      `;
      if (rows.length === 0) return false;
      await tx.notificationDelivery.create({ data });
      return true;
    });
  }

  async getDeliveryCounts(startDate: Date, endDate: Date) {
    return this.prisma.notificationDelivery.groupBy({
      by: ["status", "channel"],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
    });
  }

  async getTotalCost(startDate: Date, endDate: Date) {
    return this.prisma.notificationDelivery.aggregate({
      where: {
        status: NotificationDeliveryStatus.SENT,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { cost: true },
    });
  }

  async getRecentFailures(limit: number = 5) {
    return this.prisma.notificationDelivery.findMany({
      where: { status: NotificationDeliveryStatus.FAILED },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { recipient: true, channel: true, failureReason: true, createdAt: true },
    });
  }

  // ==========================================
  // 3. Editable Message Templates (admin copy management)
  // ==========================================

  // Seed only missing rows so admin-edited copy survives a redeploy.
  async seedMessageTemplates(
    rows: { eventType: string; locale: string; title: string; message: string }[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const { count } = await this.prisma.notificationMessageTemplate.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return count;
  }

  async findAllMessageTemplates() {
    return this.prisma.notificationMessageTemplate.findMany({
      orderBy: [{ eventType: "asc" }, { locale: "asc" }],
    });
  }

  async findMessageTemplate(eventType: string, locale: string) {
    return this.prisma.notificationMessageTemplate.findUnique({
      where: { eventType_locale: { eventType, locale } },
    });
  }

  // Upsert so an edit works even if the row was never seeded.
  async upsertMessageTemplate(input: {
    eventType: string;
    locale: string;
    title: string;
    message: string;
    updatedBy?: string | null;
  }) {
    const { eventType, locale, title, message, updatedBy } = input;
    return this.prisma.notificationMessageTemplate.upsert({
      where: { eventType_locale: { eventType, locale } },
      update: { title, message, updatedBy: updatedBy ?? null },
      create: { eventType, locale, title, message, updatedBy: updatedBy ?? null },
    });
  }
}
