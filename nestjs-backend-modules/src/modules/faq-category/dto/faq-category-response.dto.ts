import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FaqCategoryResponseDto {
  @ApiProperty({ description: "FAQ category ID", example: "8f4d8d45-8aaf-4db6-b1e4-4c95f1517e2d" })
  id: string;

  @ApiProperty({ description: "FAQ category name", example: "Account" })
  name: string;

  @ApiPropertyOptional({
    description: "FAQ category description",
    example: "Questions related to login and registration",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ description: "Created timestamp", example: "2026-03-17T09:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ description: "Updated timestamp", example: "2026-03-17T09:30:00.000Z" })
  updatedAt: Date;
}
