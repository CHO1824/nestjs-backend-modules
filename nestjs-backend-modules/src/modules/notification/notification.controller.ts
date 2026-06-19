import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse,ApiTags } from "@nestjs/swagger";

import { UserId } from "@/common/decorators/user.decorator";
import { successResponse } from "@/common/utils/response.util";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserService } from "../user/user.service";
import { NotificationResponseDto } from "./dto/notification.dto";
import { NotificationService } from "./notification.service";

/**
 * Client-facing notification API.
 *
 * Auth: JwtAuthGuard (user JWT) — class-level enforcement.
 * Service-to-service publishing lives in NotificationInternalController
 * at /internal/notifications/events with InternalApiKeyGuard.
 */
@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/notifications")
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  @Get("/")
  @ApiOperation({ summary: "Fetch user notifications with pagination" })
  @ApiResponse({ type: [NotificationResponseDto] })
  async getUserNotifications(
    @UserId() userId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ){
    const data = await this.notificationService.getUserNotifications(userId, Number(page), Number(limit));
    return successResponse(data, "Notifications fetched successfully");
  }

  @Get("/unread-count")
  @ApiOperation({ summary: "Fetch unread notification badge count" })
  async getUnreadCount(@UserId() userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return successResponse({ count }, "Unread count fetched successfully");
  }

  @Patch("/:id/read")
  @ApiOperation({ summary: "Mark a specific notification as read" })
  async markAsRead(@UserId() userId: string, @Param("id") id: string) {
    await this.notificationService.markAsRead(userId, id);
    return successResponse(null, "Notification successfully marked as read");
  }

  @Delete("/:id")
  @ApiOperation({ summary: "Delete a specific notification" })
  async deleteNotification(@UserId() userId: string, @Param("id") id: string) {
    await this.notificationService.deleteNotification(userId, id);
    return successResponse(null, "Notification successfully deleted");
  }

  @Post("/devices")
  @ApiOperation({ summary: "Sync device push token" })
  async registerDevice(@UserId() userId: string, @Body() dto: { token: string; os: string }) {
    const device = await this.userService.syncDeviceToken(userId, dto.token, dto.os);
    return successResponse(device, "Device token synchronized successfully");
  }
}
