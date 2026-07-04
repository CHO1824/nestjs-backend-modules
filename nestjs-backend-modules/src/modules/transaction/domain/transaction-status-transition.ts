import { TransactionStatus } from "../../../../generated/prisma/enums";
import {
  InvalidTransactionStatusTransitionError,
  TransactionStatusAlreadyFinalizedError,
} from "../errors/transaction.error";

/**
 * Transaction lifecycle state machine.
 *
 * Terminal states (no outgoing edges): CANCELLED, REFUNDED.
 *   - COMPLETED is NOT terminal — it can be reversed via REFUNDED.
 *   - FAILED is NOT terminal — reconciliation can move it forward (see below).
 *   - EXPIRED is "soft-terminal": the scheduler does not drive it forward,
 *     but the user/admin may still mark an expired row CANCELLED to clean
 *     up the user's history (Transfer Service PRD §15.2).
 *
 * Cancellation rules (PRD §15.2 / §15.4):
 *   - User and admin may cancel from CREATED, QUOTE_CONFIRMED, or EXPIRED.
 *   - PAYMENT_RECEIVED → CANCELLED is intentionally NOT allowed: once funds
 *     have arrived, the path to undo is FAILED → REFUNDED (the ledger must
 *     reverse, which CANCELLED would silently skip).
 *
 * Retries: PROCESSING does NOT self-transition. A retry is the same state
 * with a fresh attempts counter, modeled via the `attempts` column rather
 * than a status_log entry, so the audit trail records "what changed" only.
 *
 * FAILED → COMPLETED is reachable only via reconciliation: the partner
 * confirms a transfer we had marked FAILED (false-FAILED case). The actor
 * on such a transition MUST be a system reconciliation worker; that guard
 * lives at the call site, not in this table.
 *
 * PENDING is a legacy status kept for rows that predate this state machine.
 * New rows always start at CREATED. Legacy PENDING rows have no forward
 * transitions through this validator — any migration must run as a dedicated
 * backfill, not through this state machine.
 */
export const TRANSACTION_STATUS_TRANSITIONS: Record<TransactionStatus, readonly TransactionStatus[]> = {
  [TransactionStatus.CREATED]: [
    TransactionStatus.QUOTE_CONFIRMED,
    TransactionStatus.CANCELLED,
    TransactionStatus.EXPIRED,
  ],
  [TransactionStatus.QUOTE_CONFIRMED]: [
    TransactionStatus.PAYMENT_RECEIVED,
    TransactionStatus.CANCELLED,
    TransactionStatus.EXPIRED,
  ],
  // No CANCELLED edge — once payment is in, the unwind path is FAILED →
  // REFUNDED so the ledger reversal is recorded (PRD §15.4).
  [TransactionStatus.PAYMENT_RECEIVED]: [TransactionStatus.PROCESSING],
  [TransactionStatus.PROCESSING]: [TransactionStatus.SENT_TO_PARTNER, TransactionStatus.FAILED],
  [TransactionStatus.SENT_TO_PARTNER]: [TransactionStatus.COMPLETED, TransactionStatus.FAILED],
  [TransactionStatus.FAILED]: [TransactionStatus.PROCESSING, TransactionStatus.REFUNDED, TransactionStatus.COMPLETED],
  [TransactionStatus.COMPLETED]: [TransactionStatus.REFUNDED],
  [TransactionStatus.CANCELLED]: [],
  [TransactionStatus.REFUNDED]: [],
  // Soft-terminal: scheduler never advances from here, but user / admin
  // cancellation is permitted so the row can drop out of the active list.
  [TransactionStatus.EXPIRED]: [TransactionStatus.CANCELLED],
  // Legacy frozen — see header comment.
  [TransactionStatus.PENDING]: [],
};

// Derived from the transition table so the two stay in sync automatically
// when statuses are added or edges change.
export function isFinalTransactionStatus(status: TransactionStatus): boolean {
  return TRANSACTION_STATUS_TRANSITIONS[status]?.length === 0;
}

export const FINAL_TRANSACTION_STATUSES: readonly TransactionStatus[] = (
  Object.values(TransactionStatus) as TransactionStatus[]
).filter(isFinalTransactionStatus);

export function getAllowedNextTransactionStatuses(currentStatus: TransactionStatus): readonly TransactionStatus[] {
  return TRANSACTION_STATUS_TRANSITIONS[currentStatus] ?? [];
}

export function canTransitionTransactionStatus(
  currentStatus: TransactionStatus,
  nextStatus: TransactionStatus,
): boolean {
  return getAllowedNextTransactionStatuses(currentStatus).includes(nextStatus);
}

// Idempotent: same-status transitions are no-ops so callers can retry safely.
export function validateTransactionStatusTransition(
  currentStatus: TransactionStatus,
  nextStatus: TransactionStatus,
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (isFinalTransactionStatus(currentStatus)) {
    throw new TransactionStatusAlreadyFinalizedError(currentStatus);
  }

  if (!canTransitionTransactionStatus(currentStatus, nextStatus)) {
    throw new InvalidTransactionStatusTransitionError(currentStatus, nextStatus);
  }
}
