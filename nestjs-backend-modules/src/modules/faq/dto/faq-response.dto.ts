import { ApiProperty } from "@nestjs/swagger";

export class FaqResponseDto {
  @ApiProperty({ description: "FAQ ID", example: "6f8fd85f-e639-4f89-94dd-12f1f2da4f12" })
  id: string;

  @ApiProperty({ description: "FAQ question", example: "How do I sign up?" })
  question: string;

  @ApiProperty({
    description: "FAQ answer",
    example: "You can sign up through email verification on the registration page.",
  })
  answer: string;

  @ApiProperty({ description: "Whether the FAQ is active", example: true })
  isActive: boolean;

  @ApiProperty({ description: "Display order", example: 0 })
  sortOrder: number;

  @ApiProperty({ description: "Created timestamp", example: "2026-03-18T09:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ description: "Updated timestamp", example: "2026-03-18T09:00:00.000Z" })
  updatedAt: Date;
}
