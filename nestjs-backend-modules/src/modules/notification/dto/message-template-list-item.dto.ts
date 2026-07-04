import { ApiProperty } from "@nestjs/swagger";

export class MessageTemplateListItemDto {
  @ApiProperty({ description: "Notification event type key." })
  eventType: string;

  @ApiProperty({ description: "Locale of the copy (e.g. 'en', 'ko')." })
  locale: string;

  @ApiProperty({ description: "Notification title/heading." })
  title: string;

  @ApiProperty({ description: "Notification body." })
  message: string;

  @ApiProperty({ type: [String], description: "Placeholder variable names used by this event." })
  variables: string[];

  @ApiProperty({ description: "True when a DB override differs from the code default." })
  isCustomized: boolean;

  @ApiProperty({ nullable: true, description: "Admin id that last edited the copy, or null." })
  updatedBy: string | null;

  @ApiProperty({ nullable: true, type: Date, description: "Last edit timestamp, or null." })
  updatedAt: Date | null;
}
