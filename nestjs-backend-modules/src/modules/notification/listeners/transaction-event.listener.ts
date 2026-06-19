import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationUseCases } from "../services/notification-usecases.service";
import { RemittanceCompletedPayload, RemittanceFailedPayload } from "../interfaces/notification-payload.interface";

@Injectable()
export class RemittanceEventListener {
  private readonly logger = new Logger(RemittanceEventListener.name);

  constructor(private readonly notificationUseCases: NotificationUseCases) {}

  /**
   * [Remittance Domain]
   * Triggered when a remittance transaction is successfully finalized.
   */
  @OnEvent("remittance.completed", { async: true })
  async handleRemittanceCompleted(payload: { userId: string; data: RemittanceCompletedPayload }) {
    try {
      this.logger.log(`[Remittance] Success event for User: ${payload.userId}`);

      await this.notificationUseCases.remittanceCompleted(payload.userId, payload.data);
    } catch (error: any) {
      this.logger.error(`Failed to notify remittance.completed: ${error.message}`);
    }
  }

  /**
   * [Remittance Domain]
   * Triggered when a remittance transaction fails.
   */
  @OnEvent("remittance.failed", { async: true })
  async handleRemittanceFailed(payload: { userId: string; data: RemittanceFailedPayload }) {
    try {
      this.logger.log(`[Remittance] Failure event for User: ${payload.userId}`);

      await this.notificationUseCases.remittanceFailed(payload.userId, payload.data);
    } catch (error: any) {
      this.logger.error(`Failed to notify remittance.failed: ${error.message}`);
    }
  }
}
