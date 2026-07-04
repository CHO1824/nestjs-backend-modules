import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";

export const TEMPLATE_LOCALES = ["en", "ko"] as const;

export class UpdateMessageTemplateDto {
  @ApiProperty({ description: "Notification title/heading. Supports {{variable}} placeholders." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: "Notification body. Supports {{variable}} and {{variable|default}} placeholders." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

export class TemplateLocaleParamDto {
  @ApiProperty({ description: "Notification event type, e.g. remittance.completed" })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ description: "Locale", enum: TEMPLATE_LOCALES })
  @IsIn(TEMPLATE_LOCALES)
  locale: string;
}
