import { ApiProperty } from "@nestjs/swagger";

import { TransactionResponseDto } from "./transaction-response.dto";

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  items: TransactionResponseDto[];

  @ApiProperty({
    description: "Cursor for the next page; null when there are no more results",
    nullable: true,
    type: String,
  })
  nextCursor: string | null;

  @ApiProperty({ description: "Whether more results follow this page" })
  hasNext: boolean;

  @ApiProperty({ description: "Effective page size used for this response" })
  limit: number;
}
