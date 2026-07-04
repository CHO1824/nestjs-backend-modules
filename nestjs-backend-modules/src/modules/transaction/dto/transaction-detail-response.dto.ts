import { ApiProperty } from "@nestjs/swagger";

import { TransactionStatus } from "../../../../generated/prisma/enums";

export class TransactionDetailResponseDto {
  @ApiProperty({ description: "Transaction id (UUID)" })
  id: string;

  @ApiProperty({ description: "Human-readable tracking number" })
  trackingNumber: string;

  @ApiProperty({ description: "Owner user id (UUID)" })
  userId: string;

  @ApiProperty({ description: "Beneficiary id (UUID)" })
  beneficiaryId: string;

  @ApiProperty({
    description: "Quote id (UUID), if the transaction was created from a quote",
    nullable: true,
    type: String,
  })
  quoteId: string | null;

  @ApiProperty({ description: "Lifecycle status", enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ description: "Sender currency (ISO 4217)" })
  senderCurrency: string;

  @ApiProperty({ description: "Sender country" })
  senderCountry: string;

  @ApiProperty({ description: "Beneficiary currency (ISO 4217)" })
  beneficiaryCurrency: string;

  @ApiProperty({ description: "Beneficiary country" })
  beneficiaryCountry: string;

  @ApiProperty({ description: "Amount sent in sender currency", example: "100000.00" })
  sendAmount: string;

  @ApiProperty({ description: "Amount received in beneficiary currency", example: "3200000.00" })
  receiveAmount: string;

  @ApiProperty({ description: "FX rate applied", example: "32.000000" })
  fxRate: string;

  @ApiProperty({ description: "Remittance fee in sender currency", example: "1.00" })
  remittanceFee: string;

  @ApiProperty({ description: "Created timestamp (ISO 8601)" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp (ISO 8601)" })
  updatedAt: Date;
}
