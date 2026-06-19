import { ApiProperty } from "@nestjs/swagger";

import { TransactionStatus } from "../../../../generated/prisma/enums";

export class TransactionResponseDto {
  @ApiProperty({ description: "Transaction id (UUID)" })
  id: string;

  @ApiProperty({ description: "Human-readable tracking number" })
  trackingNumber: string;

  @ApiProperty({ description: "Lifecycle status", enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ description: "Sender currency (ISO 4217)" })
  senderCurrency: string;

  @ApiProperty({ description: "Beneficiary currency (ISO 4217)" })
  beneficiaryCurrency: string;

  @ApiProperty({ description: "Amount sent in sender currency", example: "100000.00" })
  sendAmount: string;

  @ApiProperty({ description: "Amount received in beneficiary currency", example: "3200000.00" })
  receiveAmount: string;

  @ApiProperty({ description: "Created timestamp (ISO 8601)" })
  createdAt: Date;
}
