/**
 * Audit log action strings for FAQ admin actions.
 *
 * Naming: <domain>.<entity>.<event> — lowercase, dot-separated.
 * Reference: src/modules/kyc/constants/kyc-audit-actions.ts
 */
export const FaqAuditAction = {
  CREATED: "faq.entry.created",
  UPDATED: "faq.entry.updated",
  DELETED: "faq.entry.deleted",
} as const;
