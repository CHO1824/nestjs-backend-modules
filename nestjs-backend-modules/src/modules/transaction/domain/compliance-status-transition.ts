import { ComplianceStatus } from "../../../../generated/prisma/enums";
import { InvalidComplianceStatusTransitionError } from "../errors/transaction.error";

/**
 * Compliance gate state machine — runs on the `complianceStatus` column,
 * parallel to the money-movement `status` machine in
 * `transaction-status-transition.ts`.
 *
 * Flow (happy path):
 *   PENDING → SCREENING → FDS → PRE_CLEARED → ORIS_REPORTING → CLEARED
 *
 * Branches:
 *   - Any pre-deposit stage may divert to MANUAL_REVIEW (ambiguous hit / high
 *     risk) and resume on reviewer approval, or go straight to BLOCKED.
 *   - BLOCKED is terminal; the money status then unwinds via FAILED → REFUNDED
 *     (handled by the money machine, not here).
 *   - CLEARED is terminal.
 *
 * Stage placement vs the money machine (enforced by `compliance-gate.guard.ts`):
 *   - PRE_CLEARED is the pre-deposit gate: money may advance to PAYMENT_RECEIVED.
 *   - CLEARED is the post-report gate: money may advance to SENT_TO_PARTNER.
 *   - ORIS_REPORTING runs *after* deposit (D1: deposit first → ORIS report), so
 *     a BLOCKED from ORIS_REPORTING is the unhappy path (refund + ORIS correction).
 */
export const COMPLIANCE_STATUS_TRANSITIONS: Record<ComplianceStatus, readonly ComplianceStatus[]> = {
  [ComplianceStatus.PENDING]: [ComplianceStatus.SCREENING, ComplianceStatus.BLOCKED],
  [ComplianceStatus.SCREENING]: [ComplianceStatus.FDS, ComplianceStatus.MANUAL_REVIEW, ComplianceStatus.BLOCKED],
  [ComplianceStatus.FDS]: [ComplianceStatus.PRE_CLEARED, ComplianceStatus.MANUAL_REVIEW, ComplianceStatus.BLOCKED],
  [ComplianceStatus.PRE_CLEARED]: [ComplianceStatus.ORIS_REPORTING, ComplianceStatus.BLOCKED],
  // Reviewer outcomes: APPROVE resumes the pipeline (back to FDS if the hold came
  // from screening, or straight to PRE_CLEARED if it came from FDS); REJECT blocks.
  [ComplianceStatus.MANUAL_REVIEW]: [ComplianceStatus.FDS, ComplianceStatus.PRE_CLEARED, ComplianceStatus.BLOCKED],
  [ComplianceStatus.ORIS_REPORTING]: [ComplianceStatus.CLEARED, ComplianceStatus.BLOCKED],
  [ComplianceStatus.CLEARED]: [],
  [ComplianceStatus.BLOCKED]: [],
};

export function isFinalComplianceStatus(status: ComplianceStatus): boolean {
  return COMPLIANCE_STATUS_TRANSITIONS[status]?.length === 0;
}

export const FINAL_COMPLIANCE_STATUSES: readonly ComplianceStatus[] = (
  Object.values(ComplianceStatus) as ComplianceStatus[]
).filter(isFinalComplianceStatus);

export function getAllowedNextComplianceStatuses(currentStatus: ComplianceStatus): readonly ComplianceStatus[] {
  return COMPLIANCE_STATUS_TRANSITIONS[currentStatus] ?? [];
}

export function canTransitionComplianceStatus(currentStatus: ComplianceStatus, nextStatus: ComplianceStatus): boolean {
  return getAllowedNextComplianceStatuses(currentStatus).includes(nextStatus);
}

/**
 * Asserts a compliance-status transition is legal. Same-status is a no-op so
 * callers can retry idempotently. Throws `InvalidComplianceStatusTransitionError`
 * for an illegal edge or any move out of a terminal state.
 */
export function assertComplianceStatusTransition(currentStatus: ComplianceStatus, nextStatus: ComplianceStatus): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!canTransitionComplianceStatus(currentStatus, nextStatus)) {
    throw new InvalidComplianceStatusTransitionError(currentStatus, nextStatus);
  }
}
