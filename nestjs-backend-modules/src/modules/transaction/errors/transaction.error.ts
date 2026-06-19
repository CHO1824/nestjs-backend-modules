import { HttpStatus } from "@nestjs/common";

import { AppError } from "@/common/errors/app.error";

import { TransactionStatus } from "../../../../generated/prisma/enums";

export class TransactionNotFoundError extends AppError {
  constructor() {
    super("TRANSACTION_NOT_FOUND", "Transaction not found", HttpStatus.NOT_FOUND);
  }
}

export class InvalidTransactionStatusTransitionError extends AppError {
  constructor(currentStatus: TransactionStatus, nextStatus: TransactionStatus) {
    super(
      "INVALID_TRANSACTION_STATUS_TRANSITION",
      `Cannot transition transaction from ${currentStatus} to ${nextStatus}`,
      HttpStatus.BAD_REQUEST,
      { currentStatus, nextStatus },
    );
  }
}

export class TransactionStatusAlreadyFinalizedError extends AppError {
  constructor(currentStatus: TransactionStatus) {
    super(
      "TRANSACTION_STATUS_ALREADY_FINALIZED",
      `Transaction status ${currentStatus} is final and cannot be changed`,
      HttpStatus.CONFLICT,
      { currentStatus },
    );
  }
}

export class InvalidTransactionListCursorError extends AppError {
  constructor() {
    super("INVALID_TRANSACTION_LIST_CURSOR", "Transaction list cursor is invalid", HttpStatus.BAD_REQUEST);
  }
}
