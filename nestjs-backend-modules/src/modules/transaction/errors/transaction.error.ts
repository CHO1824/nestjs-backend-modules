import { HttpStatus } from "@nestjs/common";

import { AppError } from "@/common/errors/app.error";

import { ComplianceStatus, TransactionStatus } from "../../../../generated/prisma/enums";

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

export class InvalidComplianceStatusTransitionError extends AppError {
  // Same non-disclosure treatment as ComplianceGateNotClearedError: the internal
  // compliance phases are kept server-side for logs/audit but never serialized
  // into the client envelope (message and details stay generic).
  declare readonly complianceCurrentStatus: ComplianceStatus;
  declare readonly complianceNextStatus: ComplianceStatus;

  constructor(currentStatus: ComplianceStatus, nextStatus: ComplianceStatus) {
    super("INVALID_COMPLIANCE_STATUS_TRANSITION", "Transaction cannot proceed at this stage", HttpStatus.BAD_REQUEST);
    Object.defineProperty(this, "complianceCurrentStatus", {
      value: currentStatus,
      enumerable: false,
      writable: false,
    });
    Object.defineProperty(this, "complianceNextStatus", {
      value: nextStatus,
      enumerable: false,
      writable: false,
    });
  }
}

export class ComplianceGateNotClearedError extends AppError {
  // Kept server-side for logs/audit but NEVER serialized: the internal compliance
  // phase is non-disclosable (see compliance-status-presentation.ts). Only the
  // money status and a generic message reach the client envelope. Defined as
  // non-enumerable so even a direct JSON.stringify of the error cannot leak them.
  declare readonly complianceStatus: ComplianceStatus;
  declare readonly requiredComplianceStatus: ComplianceStatus;

  constructor(
    nextMoneyStatus: TransactionStatus,
    complianceStatus: ComplianceStatus,
    requiredComplianceStatus: ComplianceStatus,
  ) {
    super("COMPLIANCE_GATE_NOT_CLEARED", "Transaction cannot proceed at this stage", HttpStatus.CONFLICT, {
      nextMoneyStatus,
    });
    Object.defineProperty(this, "complianceStatus", {
      value: complianceStatus,
      enumerable: false,
      writable: false,
    });
    Object.defineProperty(this, "requiredComplianceStatus", {
      value: requiredComplianceStatus,
      enumerable: false,
      writable: false,
    });
  }
}

export class InvalidInitialTransactionStatusError extends AppError {
  constructor(toStatus: TransactionStatus) {
    super(
      "INVALID_INITIAL_TRANSACTION_STATUS",
      `Transaction cannot be created at status ${toStatus}`,
      HttpStatus.BAD_REQUEST,
      { toStatus },
    );
  }
}

export class PerTxnLimitExceededError extends AppError {
  constructor(sendAmount: number, sendCurrency: string, usdEquivalent: number, limitUsd: number) {
    super(
      "PER_TXN_LIMIT_EXCEEDED",
      `Send amount exceeds the per-transaction limit of USD ${limitUsd}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { sendAmount, sendCurrency, usdEquivalent, limitUsd },
    );
  }
}

export class UnsupportedLimitCurrencyError extends AppError {
  constructor(currency: string) {
    super(
      "UNSUPPORTED_LIMIT_CURRENCY",
      `No reference rate to evaluate the per-transaction limit for currency ${currency}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { currency },
    );
  }
}

export class InvalidTransactionListCursorError extends AppError {
  constructor() {
    super("INVALID_TRANSACTION_LIST_CURSOR", "Transaction list cursor is invalid", HttpStatus.BAD_REQUEST);
  }
}
