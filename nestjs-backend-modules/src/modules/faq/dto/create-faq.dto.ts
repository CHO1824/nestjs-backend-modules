import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateFaqDto {
  @ApiProperty({ description: "FAQ question", example: "How do I sign up?" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  question: string;

  @ApiProperty({
    description: "FAQ answer",
    example: "You can sign up through email verification on the registration page.",
  })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiPropertyOptional({ description: "Whether the FAQ is active", example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: "Display order", example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;
}
