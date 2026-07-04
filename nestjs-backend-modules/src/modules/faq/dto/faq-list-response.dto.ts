import { ApiProperty } from "@nestjs/swagger";

import { FaqResponseDto } from "./faq-response.dto";

class PaginationMetaDto {
  @ApiProperty({ description: "Current page number", example: 1 })
  page: number;

  @ApiProperty({ description: "Number of items per page", example: 10 })
  limit: number;

  @ApiProperty({ description: "Total number of items", example: 25 })
  totalCount: number;

  @ApiProperty({ description: "Total number of pages", example: 3 })
  totalPages: number;
}

export class FaqListResponseDto {
  @ApiProperty({ type: [FaqResponseDto] })
  items: FaqResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
