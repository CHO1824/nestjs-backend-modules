import { Injectable } from "@nestjs/common";

import { Prisma } from "../../../../generated/prisma/client";
import { DeliveryChannel, NotificationCategory, NotificationEventType } from "../constants/notification.constants";
import {
  KycApprovedPayload,
  RemittanceCompletedPayload,
  RemittanceFailedPayload,
} from "../interfaces/notification-payload.interface";
import { NotificationService } from "../notification.service";

@Injectable()
export class NotificationUseCases {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Dispatches a notification when a remittance is successfully completed.
   */
  async remittanceCompleted(
    userId: string,
    data: RemittanceCompletedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    // The cast is the one acceptable boundary between the typed UseCase API
    // and the DTO's Record<string, unknown>; the validator inside publish()
    // re-narrows the payload to the typed shape before render.
    await this.notificationService.publish(
      userId,
      {
        // Push-first: Alimtalk/SMS only as the worker's fallback when PUSH fails.
        channels: [DeliveryChannel.PUSH, DeliveryChannel.EMAIL],
        category: NotificationCategory.TRANSACTIONAL,
        type: NotificationEventType.REMITTANCE_COMPLETED,
        payload: data as unknown as Record<string, unknown>,
      },
      undefined,
      tx,
    );
  }

  /**
   * Dispatches a notification when a user's KYC is approved (D4). Primarily for
   * the async-vendor path (status polling flips pending/in_review → approved
   * while the user is away) and admin manual approval — both cases where the
   * user is not in the same session and needs a re-visit nudge.
   */
  async kycApproved(userId: string, data: KycApprovedPayload, tx?: Prisma.TransactionClient): Promise<void> {
    await this.notificationService.publish(
      userId,
      {
        channels: [DeliveryChannel.PUSH, DeliveryChannel.EMAIL],
        category: NotificationCategory.TRANSACTIONAL,
        type: NotificationEventType.KYC_APPROVED,
        payload: data as unknown as Record<string, unknown>,
        // Key by user — a re-fired status poll must not send a second KYC-approved.
        idempotencyKey: `${NotificationEventType.KYC_APPROVED}:${userId}`,
      },
      undefined,
      tx,
    );
  }

  /**
   * Dispatches a notification when a remittance fails, including a deep link for details.
   */
  async remittanceFailed(userId: string, data: RemittanceFailedPayload, tx?: Prisma.TransactionClient): Promise<void> {
    const enrichedPayload: RemittanceFailedPayload = {
      ...data,
      deepLink: `vpay://transfer/${data.transferId}/detail`,
    };

    await this.notificationService.publish(
      userId,
      {
        // Push-first: Alimtalk/SMS only as the worker's fallback when PUSH fails.
        channels: [DeliveryChannel.PUSH, DeliveryChannel.EMAIL],
        category: NotificationCategory.TRANSACTIONAL,
        type: NotificationEventType.REMITTANCE_FAILED,
        payload: enrichedPayload as unknown as Record<string, unknown>,
        // Key by transfer id — a re-delivered event must not send a duplicate.
        idempotencyKey: `${NotificationEventType.REMITTANCE_FAILED}:${data.transferId}`,
      },
      undefined,
      tx,
    );
  }
}
