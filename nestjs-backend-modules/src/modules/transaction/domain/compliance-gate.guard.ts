import { ComplianceStatus, TransactionStatus } from "../../../../generated/prisma/enums";
import { ComplianceGateNotClearedError } from "../errors/transaction.error";

/**
 * Couples the compliance gate to the money-movement state machine.
 *
 * Only two money transitions are gated by compliance; everything else (notably
 * the FAILED → REFUNDED unwind) stays unrestricted so a BLOCKED transaction can
 * always be refunded.
 *
 *   - QUOTE_CONFIRMED → PAYMENT_RECEIVED  requires PRE_CLEARED (or CLEARED).
 *     Pre-deposit screening + FDS must have passed before we accept funds.
 *   - PROCESSING → SENT_TO_PARTNER        requires CLEARED.
 *     The authoritative ORIS report (post-deposit) must have passed before payout.
 *
 * PENDING/SCREENING/FDS/MANUAL_REVIEW/ORIS_REPORTING/BLOCKED all fail the gate
 * for these two targets — including BLOCKED, which must never reach payout.
 */

/** Money targets that require the pre-deposit gate (PRE_CLEARED) to have passed. */
const PRE_DEPOSIT_CLEARED_STATES: readonly ComplianceStatus[] = [
  ComplianceStatus.PRE_CLEARED,
  ComplianceStatus.CLEARED,
];

export function assertCompliancePermitsMoneyTransition(
  nextMoneyStatus: TransactionStatus,
  complianceStatus: ComplianceStatus,
): void {
  if (
    nextMoneyStatus === TransactionStatus.PAYMENT_RECEIVED &&
    !PRE_DEPOSIT_CLEARED_STATES.includes(complianceStatus)
  ) {
    throw new ComplianceGateNotClearedError(nextMoneyStatus, complianceStatus, ComplianceStatus.PRE_CLEARED);
  }

  if (nextMoneyStatus === TransactionStatus.SENT_TO_PARTNER && complianceStatus !== ComplianceStatus.CLEARED) {
    throw new ComplianceGateNotClearedError(nextMoneyStatus, complianceStatus, ComplianceStatus.CLEARED);
  }
}
