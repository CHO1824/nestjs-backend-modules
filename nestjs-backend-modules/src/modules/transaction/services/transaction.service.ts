import { ConflictException, Injectable } from "@nestjs/common";

import { PrismaService } from "@/common/prisma/prisma.service";

import { Prisma, Transaction } from "../../../../generated/prisma/client";
import { TransactionStatus } from "../../../../generated/prisma/enums";
import { TransferActor } from "../../transfer/domain/transfer-actor";
import { TransferStateService } from "../../transfer/services/transfer-state.service";
import { decodeTransactionListCursor, encodeTransactionListCursor } from "../domain/transaction-list-cursor";
import {
  canTransitionTransactionStatus,
  validateTransactionStatusTransition,
} from "../domain/transaction-status-transition";
import { TransactionDetailResponseDto } from "../dto/transaction-detail-response.dto";
import { TransactionListQueryDto } from "../dto/transaction-list-query.dto";
import { TransactionListResponseDto } from "../dto/transaction-list-response.dto";
import { TransactionResponseDto } from "../dto/transaction-response.dto";
import {
  InvalidTransactionStatusTransitionError,
  TransactionNotFoundError,
} from "../errors/transaction.error";
import { TransactionRepository } from "../repositories/transaction.repository";

// Result of the in-transaction work inside cancelByUser. The
// transaction body returns one of these shapes so the caller can map
// races / not-found / state-machine-rejection into the right HTTP
// response *outside* the Prisma transaction. Throwing business
// exceptions from inside the `$transaction` callback is technically
// fine but Prisma may wrap them, which makes the resulting error
// class hard to reason about; this discriminated union avoids that
// trap.
type CancelByUserOutcome =
  | { kind: "cancelled"; row: Transaction }
  | { kind: "already-cancelled"; row: Transaction }
  | { kind: "vanished" }
  | { kind: "not-cancellable"; currentStatus: TransactionStatus };

// Defensive cap on the optimistic-concurrency retry. Under READ COMMITTED the
// loop terminates naturally because every losing attempt observes a fresh
// row, but a stricter isolation level (e.g. SERIALIZABLE inside a passed tx)
// could pin the snapshot and spin forever. Three attempts is enough for any
// realistic concurrent-actor count on the same row.
const UPDATE_STATUS_MAX_ATTEMPTS = 3;

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly prisma: PrismaService,
    private readonly transferState: TransferStateService,
  ) {}

  async findMany(userId: string, query: TransactionListQueryDto): Promise<TransactionListResponseDto> {
    const decodedCursor = query.cursor
      ? (() => {
          const parsed = decodeTransactionListCursor(query.cursor!);
          return { createdAt: new Date(parsed.createdAt), id: parsed.id };
        })()
      : undefined;

    const rows = await this.transactionRepository.findManyByUserId({
      userId,
      limit: query.limit,
      status: query.status,
      cursor: decodedCursor,
    });

    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((row) => this.toListItem(row)),
      nextCursor:
        hasNext && last
          ? encodeTransactionListCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      hasNext,
      limit: query.limit,
    };
  }

  async findDetail(transactionId: string, userId: string): Promise<TransactionDetailResponseDto> {
    const transaction = await this.transactionRepository.findByIdForUser(transactionId, userId);
    if (!transaction) {
      throw new TransactionNotFoundError();
    }
    return this.toDetail(transaction);
  }

  // PRD §15.2 allows user cancellation from CREATED / QUOTE_CONFIRMED /
  // EXPIRED. PAYMENT_RECEIVED and beyond are rejected at the state-machine
  // layer (see transaction-status-transition.ts) because once funds arrive
  // the unwind path is FAILED -> REFUNDED (PRD §15.4).
  //
  // Idempotency: a double-click that arrives after the first cancel has
  // committed returns the existing CANCELLED row without writing a second
  // status_log entry. The pre-flight short-circuit handles the common
  // case (status already CANCELLED at API entry); the in-transaction
  // re-check under FOR UPDATE handles the race where two cancel calls
  // both pass the pre-flight before either commits.
  //
  // Errors are mapped from the transaction's discriminated-union
  // outcome *outside* the Prisma `$transaction` callback. Throwing
  // business exceptions from inside the callback works, but Prisma
  // can wrap them, which makes the resulting class hard to assert on
  // and obscures the original stack.
  async cancelByUser(
    transactionId: string,
    userId: string,
    reason?: string,
  ): Promise<TransactionDetailResponseDto> {
    const initial = await this.transactionRepository.findByIdForUser(transactionId, userId);
    if (!initial) {
      throw new TransactionNotFoundError();
    }

    // Pre-flight fast paths before opening a transaction.
    if (initial.status === TransactionStatus.CANCELLED) {
      return this.toDetail(initial);
    }
    if (!canTransitionTransactionStatus(initial.status, TransactionStatus.CANCELLED)) {
      throw new InvalidTransactionStatusTransitionError(initial.status, TransactionStatus.CANCELLED);
    }

    const outcome = await this.prisma.$transaction<CancelByUserOutcome>(async (tx) => {
      // Row-level lock so a concurrent admin-cancel / scheduler step
      // cannot land between our re-read and the transition. Filtering
      // by user_id keeps this resilient even if the caller bypasses
      // the pre-flight ownership check above.
      const locked = await tx.$queryRaw<{ id: string; status: TransactionStatus }[]>`
        SELECT id, status FROM transactions
        WHERE id = ${transactionId}::uuid AND user_id = ${userId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) {
        return { kind: "vanished" };
      }

      const currentStatus = locked[0].status;

      if (currentStatus === TransactionStatus.CANCELLED) {
        const row = await tx.transaction.findUnique({ where: { id: transactionId } });
        if (!row) return { kind: "vanished" };
        return { kind: "already-cancelled", row };
      }

      // Status drifted to a non-cancellable state between pre-flight
      // and lock acquisition (e.g. payment arrived in that window).
      // Surface as a state-machine rejection rather than letting
      // transferState.transition throw from inside this callback.
      if (!canTransitionTransactionStatus(currentStatus, TransactionStatus.CANCELLED)) {
        return { kind: "not-cancellable", currentStatus };
      }

      await this.transferState.transition(tx, {
        transferId: transactionId,
        to: TransactionStatus.CANCELLED,
        actor: TransferActor.user(userId),
        reason,
      });

      const row = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!row) return { kind: "vanished" };
      return { kind: "cancelled", row };
    });

    switch (outcome.kind) {
      case "cancelled":
      case "already-cancelled":
        return this.toDetail(outcome.row);
      case "vanished":
        throw new TransactionNotFoundError();
      case "not-cancellable":
        throw new InvalidTransactionStatusTransitionError(outcome.currentStatus, TransactionStatus.CANCELLED);
    }
  }

  // Internal: callers (FX confirm, ledger callbacks, payout partner webhooks)
  // pass their own Prisma tx client to keep this change in their transaction.
  // The repository write is guarded by the status read above, so concurrent
  // callers cannot overwrite a terminal status from a stale read. No HTTP
  // surface; admin/manual overrides should add a separate authorized endpoint
  // that delegates here.
  async updateStatus(
    transactionId: string,
    nextStatus: TransactionStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Transaction> {
    let current = await this.transactionRepository.findById(transactionId, tx);

    for (let attempt = 0; attempt < UPDATE_STATUS_MAX_ATTEMPTS; attempt += 1) {
      if (!current) {
        throw new TransactionNotFoundError();
      }
      validateTransactionStatusTransition(current.status, nextStatus);
      if (current.status === nextStatus) {
        return current;
      }

      const didUpdate = await this.transactionRepository.updateStatus(transactionId, current.status, nextStatus, tx);
      if (didUpdate) {
        const updated = await this.transactionRepository.findById(transactionId, tx);
        if (!updated) {
          throw new TransactionNotFoundError();
        }
        return updated;
      }

      current = await this.transactionRepository.findById(transactionId, tx);
    }

    throw new ConflictException(
      `Transaction ${transactionId} status changed concurrently after ${UPDATE_STATUS_MAX_ATTEMPTS} attempts. Please retry.`,
    );
  }

  private toListItem(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      trackingNumber: transaction.trackingNumber,
      status: transaction.status,
      senderCurrency: transaction.senderCurrency,
      beneficiaryCurrency: transaction.beneficiaryCurrency,
      sendAmount: this.formatDecimal(transaction.sendAmount, 2),
      receiveAmount: this.formatDecimal(transaction.receiveAmount, 2),
      createdAt: transaction.createdAt,
    };
  }

  private toDetail(transaction: Transaction): TransactionDetailResponseDto {
    return {
      id: transaction.id,
      trackingNumber: transaction.trackingNumber,
      userId: transaction.userId,
      beneficiaryId: transaction.beneficiaryId,
      quoteId: transaction.quoteId ?? null,
      status: transaction.status,
      senderCurrency: transaction.senderCurrency,
      senderCountry: transaction.senderCountry,
      beneficiaryCurrency: transaction.beneficiaryCurrency,
      beneficiaryCountry: transaction.beneficiaryCountry,
      sendAmount: this.formatDecimal(transaction.sendAmount, 2),
      receiveAmount: this.formatDecimal(transaction.receiveAmount, 2),
      fxRate: this.formatDecimal(transaction.fxRate, 6),
      remittanceFee: this.formatDecimal(transaction.remittanceFee, 2),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  // Pads to the schema's declared scale so API consumers see a consistent
  // number of fractional digits (e.g. Decimal(18,2) → "100.00", Decimal(18,6)
  // → "32.000000"). Falls back to toFixed when the underlying string uses
  // scientific notation.
  private formatDecimal(decimal: { toString(): string; toFixed?: (decimalPlaces?: number) => string }, scale: number) {
    const value = decimal.toString();
    if (value.includes("e") || value.includes("E")) {
      return decimal.toFixed?.(scale) ?? value;
    }

    const [integer, fraction = ""] = value.split(".");
    if (fraction.length >= scale) {
      return value;
    }
    return `${integer}.${fraction.padEnd(scale, "0")}`;
  }
}
