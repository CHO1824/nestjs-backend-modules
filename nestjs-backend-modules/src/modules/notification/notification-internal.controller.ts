import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiHeader,ApiOperation, ApiTags } from "@nestjs/swagger";

import { successResponse } from "@/common/utils/response.util";

import { PublishInternalEventDto } from "./dto/notification.dto";
import { InternalApiKeyGuard } from "./guards/internal-api-key.guard";
import { NotificationService } from "./notification.service";

/**
 * Service-to-service notification API.
 *
 * Auth: X-Internal-Token header (InternalApiKeyGuard).
 * Not for client/browser use — call from backend services only.
 * The user-facing controller (NotificationController) handles client traffic.
 */
@ApiTags("Notifications (Internal)")
@ApiHeader({ name: "X-Internal-Token", required: true, description: "Internal service token" })
@UseGuards(InternalApiKeyGuard)
@Controller("internal/notifications")
export class NotificationInternalController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post("/events")
  @ApiOperation({ summary: "[Internal] Publish a notification event to the Outbox queue" })
  async publishEvent(@Body() dto: PublishInternalEventDto) {
    const { userId, ...createDto } = dto;
    const data = await this.notificationService.publish(userId, createDto);
    return successResponse(data, "Event successfully added to Outbox queue");
  }
}
