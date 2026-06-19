/* eslint-disable max-len */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { UserId } from "@/common/decorators/user.decorator";
import { successResponse } from "@/common/utils/response.util";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CancelTransactionDto } from "../dto/cancel-transaction.dto";
import { TransactionDetailResponseDto } from "../dto/transaction-detail-response.dto";
import { TransactionListQueryDto } from "../dto/transaction-list-query.dto";
import { TransactionListResponseDto } from "../dto/transaction-list-response.dto";
import { TransactionService } from "../services/transaction.service";

@ApiTags("Transactions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/transactions")
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the caller's transactions (cursor pagination)" })
  @ApiOkResponse({ type: TransactionListResponseDto })
  async list(@UserId() userId: string, @Query() query: TransactionListQueryDto) {
    const result = await this.transactionService.findMany(userId, query);
    return successResponse(result, "Transactions retrieved");
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a transaction by id (caller must be the owner)" })
  @ApiOkResponse({ type: TransactionDetailResponseDto })
  async detail(@UserId() userId: string, @Param("id", new ParseUUIDPipe()) id: string) {
    const result = await this.transactionService.findDetail(id, userId);
    return successResponse(result, "Transaction retrieved");
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cancel the caller's transaction",
    description:
      "Idempotent: cancelling a row already in CANCELLED returns the existing row. Allowed only from CREATED / QUOTE_CONFIRMED / EXPIRED per PRD §15.2; later states require the FAILED → REFUNDED path.",
  })
  @ApiOkResponse({ type: TransactionDetailResponseDto, description: "Transaction cancelled (or already cancelled)" })
  @ApiResponse({ status: 400, description: "Status does not permit cancellation" })
  @ApiResponse({ status: 404, description: "Transaction not found or not owned by caller" })
  async cancel(
    @UserId() userId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CancelTransactionDto,
  ) {
    const result = await this.transactionService.cancelByUser(id, userId, dto.reason);
    return successResponse(result, "Transaction cancelled");
  }
}
