import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelTransactionDto {
  // Optional for user-initiated cancellation. Admin-initiated cancellation
  // requires a reason (enforced on the admin endpoint, not here).
  @ApiPropertyOptional({
    example: "Sent to the wrong beneficiary",
    description: "User-supplied free-text rationale, recorded on the status log",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
