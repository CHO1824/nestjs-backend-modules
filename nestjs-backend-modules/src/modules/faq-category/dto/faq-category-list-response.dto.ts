import { ApiProperty } from "@nestjs/swagger";

import { FaqCategoryResponseDto } from "./faq-category-response.dto";

class FaqCategoryListMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  size: number;

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class FaqCategoryListResponseDto {
  @ApiProperty({ type: [FaqCategoryResponseDto] })
  items: FaqCategoryResponseDto[];

  @ApiProperty({ type: FaqCategoryListMetaDto })
  meta: FaqCategoryListMetaDto;
}
