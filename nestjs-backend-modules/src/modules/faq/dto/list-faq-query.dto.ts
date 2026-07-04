import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListFaqQueryDto {
  @ApiPropertyOptional({ description: "Search keyword (question or answer)", example: "signup" })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: "Page number", example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Number of items per page", example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Sort field",
    enum: ["createdAt", "sortOrder"],
    example: "sortOrder",
    default: "sortOrder",
  })
  @IsOptional()
  @IsIn(["createdAt", "sortOrder"])
  sortBy?: "createdAt" | "sortOrder" = "sortOrder";

  @ApiPropertyOptional({ description: "Sort direction", enum: ["asc", "desc"], example: "asc", default: "asc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc" = "asc";

  @ApiPropertyOptional({ description: "Filter by active status", example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) {
      return true;
    }

    if (value === "false" || value === false) {
      return false;
    }

    return undefined;
  })
  isActive?: boolean;
}
