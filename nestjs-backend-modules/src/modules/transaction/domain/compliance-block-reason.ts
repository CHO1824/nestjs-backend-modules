/**
 * Why a BLOCKED transaction was rejected. Stored for ops/audit; the user-facing
 * mapping collapses every BLOCKED reason to "Refund in Progress" (non-disclosure,
 * see compliance-status-presentation.ts).
 *
 * This is the application-level source of truth for `transactions.compliance_block_reason`,
 * which is a plain TEXT column (not a DB enum) so new reasons can be added here
 * without a database migration. Every writer of that column MUST use these values.
 */
export const ComplianceBlockReason = {
  AML_HIT: "AML_HIT",
  SANCTION_COUNTRY: "SANCTION_COUNTRY",
  FDS_RISK: "FDS_RISK",
  ORIS_REJECT: "ORIS_REJECT",
  PER_TXN_LIMIT: "PER_TXN_LIMIT",
} as const;

export type ComplianceBlockReasonType = (typeof ComplianceBlockReason)[keyof typeof ComplianceBlockReason];

const COMPLIANCE_BLOCK_REASONS: ReadonlySet<string> = new Set(Object.values(ComplianceBlockReason));

export function isComplianceBlockReason(value: string): value is ComplianceBlockReasonType {
  return COMPLIANCE_BLOCK_REASONS.has(value);
}
