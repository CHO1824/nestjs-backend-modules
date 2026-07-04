import { ComplianceStatus, TransactionStatus } from "../../../../generated/prisma/enums";

/**
 * User-facing compliance phase. Internal compliance states are NEVER exposed
 * directly (P0-7): a customer must not learn they are being screened, risk-scored,
 * or manually reviewed. Every non-cleared internal state collapses to either
 * "Processing" or "Refund in Progress".
 */
export enum UserFacingComplianceState {
  PROCESSING = "PROCESSING",
  REFUND_IN_PROGRESS = "REFUND_IN_PROGRESS",
}

const USER_FACING_BY_COMPLIANCE_STATUS: Record<ComplianceStatus, UserFacingComplianceState | null> = {
  // In-flight gate work — all shown as a neutral "Processing".
  [ComplianceStatus.PENDING]: UserFacingComplianceState.PROCESSING,
  [ComplianceStatus.SCREENING]: UserFacingComplianceState.PROCESSING,
  [ComplianceStatus.FDS]: UserFacingComplianceState.PROCESSING,
  [ComplianceStatus.PRE_CLEARED]: UserFacingComplianceState.PROCESSING,
  // The fact that a human is reviewing is non-disclosed — still just "Processing".
  [ComplianceStatus.MANUAL_REVIEW]: UserFacingComplianceState.PROCESSING,
  [ComplianceStatus.ORIS_REPORTING]: UserFacingComplianceState.PROCESSING,
  // Cleared: nothing compliance-specific to show; defer to the money status.
  [ComplianceStatus.CLEARED]: null,
  // Any block (AML hit, sanctioned country, FDS, ORIS reject) is disclosed only
  // as a refund in progress — never the underlying reason.
  [ComplianceStatus.BLOCKED]: UserFacingComplianceState.REFUND_IN_PROGRESS,
};

// Money states where the transaction is dead (or its refund already settled):
// the money status is what the user must see, never a compliance overlay.
// EXPIRED is soft-terminal but equally dead from the user's perspective.
const DEAD_MONEY_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.CANCELLED,
  TransactionStatus.EXPIRED,
  TransactionStatus.REFUNDED,
];

// Money states before any deposit has been accepted. A compliance BLOCK here
// cannot mean "refund in progress" — there is nothing to refund.
const PRE_PAYMENT_MONEY_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.CREATED,
  TransactionStatus.QUOTE_CONFIRMED,
];

/**
 * Maps an internal compliance status to its user-facing state, or `null` when
 * there is nothing compliance-specific to surface and the money status should
 * be shown instead. Callers building API responses MUST go through this and
 * never leak the raw `complianceStatus`.
 *
 * The money status takes precedence in two cases (it would otherwise be
 * contradicted by the compliance overlay):
 *   - dead money states (CANCELLED / EXPIRED / REFUNDED): the transaction is
 *     over; showing "Processing" or "Refund in Progress" would resurrect it.
 *   - BLOCKED before any deposit (CREATED / QUOTE_CONFIRMED): no funds were
 *     taken, so "Refund in Progress" would be false.
 */
export function toUserFacingComplianceState(
  complianceStatus: ComplianceStatus,
  moneyStatus: TransactionStatus,
): UserFacingComplianceState | null {
  if (DEAD_MONEY_STATUSES.includes(moneyStatus)) {
    return null;
  }

  if (complianceStatus === ComplianceStatus.BLOCKED && PRE_PAYMENT_MONEY_STATUSES.includes(moneyStatus)) {
    return null;
  }

  return USER_FACING_BY_COMPLIANCE_STATUS[complianceStatus];
}
