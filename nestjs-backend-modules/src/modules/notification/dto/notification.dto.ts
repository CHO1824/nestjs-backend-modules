import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

import { DeliveryChannel, NotificationCategory, NotificationEventType } from "../constants/notification.constants";

/**
 * [Input DTO] Data transfer object for creating new notification events.
 */
export class CreateNotificationDto {
  @ApiProperty({ enum: DeliveryChannel, isArray: true })
  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  @ArrayUnique()
  channels: DeliveryChannel[];

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  @IsNotEmpty()
  category: NotificationCategory;

  @ApiProperty({ enum: NotificationEventType })
  @IsEnum(NotificationEventType)
  @IsNotEmpty()
  type: NotificationEventType;

  @ApiProperty({ description: "Dynamic payload for template rendering" })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, unknown>;

  @ApiProperty({
    required: false,
    description: "Optional dedup key. A duplicate publish with the same key is skipped.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

/**
 * [Input DTO] Service-to-service publish request.
 * Used by /internal/notifications/events with InternalApiKeyGuard.
 * Caller must explicitly supply userId since no JWT context is available.
 */
export class PublishInternalEventDto extends CreateNotificationDto {
  @ApiProperty({ description: "Target user id for the notification" })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

/**
 * [Output DTO] Response object structured for the Frontend Notification Panel UI.
 */
export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  sysCode!: string;

  @ApiProperty()
  timeAgo!: string;

  @IsOptional()
  createdAt?: Date;

  constructor(partial: Partial<NotificationResponseDto>) {
    Object.assign(this, partial);
    this.timeAgo = this.formatRelativeTime(this.createdAt);
  }

  /**
   * Calculates the relative time difference to be displayed on UI.
   */
  private formatRelativeTime(date?: Date): string {
    if (!date) return "just now";

    const diffMins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  }
}
