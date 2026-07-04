import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty } from "class-validator";

export class GetNotificationStatsDto {
  @ApiProperty({ description: "Start date for querying statistics (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: "End date for querying statistics (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
