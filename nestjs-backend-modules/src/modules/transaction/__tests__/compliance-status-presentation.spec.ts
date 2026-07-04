import { ComplianceStatus, TransactionStatus } from "../../../../generated/prisma/enums";
import { toUserFacingComplianceState, UserFacingComplianceState } from "../domain/compliance-status-presentation";

describe("compliance-status-presentation", () => {
  it.each([
    ComplianceStatus.PENDING,
    ComplianceStatus.SCREENING,
    ComplianceStatus.FDS,
    ComplianceStatus.PRE_CLEARED,
    ComplianceStatus.MANUAL_REVIEW,
    ComplianceStatus.ORIS_REPORTING,
  ])("maps in-flight state %s to a neutral PROCESSING (no internal leak)", (status) => {
    expect(toUserFacingComplianceState(status, TransactionStatus.PAYMENT_RECEIVED)).toBe(
      UserFacingComplianceState.PROCESSING,
    );
  });

  it("hides manual review behind PROCESSING (the customer must not learn they are being reviewed)", () => {
    expect(toUserFacingComplianceState(ComplianceStatus.MANUAL_REVIEW, TransactionStatus.PAYMENT_RECEIVED)).toBe(
      UserFacingComplianceState.PROCESSING,
    );
  });

  it("maps BLOCKED after deposit to REFUND_IN_PROGRESS without disclosing the reason", () => {
    expect(toUserFacingComplianceState(ComplianceStatus.BLOCKED, TransactionStatus.PAYMENT_RECEIVED)).toBe(
      UserFacingComplianceState.REFUND_IN_PROGRESS,
    );
  });

  it("returns null for CLEARED so the money status is shown instead", () => {
    expect(toUserFacingComplianceState(ComplianceStatus.CLEARED, TransactionStatus.PROCESSING)).toBeNull();
  });

  it.each([TransactionStatus.CREATED, TransactionStatus.QUOTE_CONFIRMED])(
    "does NOT show REFUND_IN_PROGRESS for a pre-payment BLOCK at %s (no funds were taken)",
    (moneyStatus) => {
      expect(toUserFacingComplianceState(ComplianceStatus.BLOCKED, moneyStatus)).toBeNull();
    },
  );

  it.each([TransactionStatus.CANCELLED, TransactionStatus.EXPIRED, TransactionStatus.REFUNDED])(
    "defers to a dead money status %s regardless of the compliance state",
    (moneyStatus) => {
      for (const complianceStatus of Object.values(ComplianceStatus)) {
        expect(toUserFacingComplianceState(complianceStatus, moneyStatus)).toBeNull();
      }
    },
  );

  it("still shows PROCESSING for an in-flight compliance state at a pre-payment money status", () => {
    expect(toUserFacingComplianceState(ComplianceStatus.SCREENING, TransactionStatus.CREATED)).toBe(
      UserFacingComplianceState.PROCESSING,
    );
  });

  it("never surfaces a raw internal compliance status string", () => {
    const internalNames = new Set(Object.values(ComplianceStatus) as string[]);
    for (const status of Object.values(ComplianceStatus)) {
      for (const moneyStatus of Object.values(TransactionStatus)) {
        const facing = toUserFacingComplianceState(status, moneyStatus);
        if (facing !== null) {
          expect(internalNames.has(facing)).toBe(false);
        }
      }
    }
  });

  it("maps every (ComplianceStatus, TransactionStatus) pair (exhaustive, no undefined)", () => {
    for (const status of Object.values(ComplianceStatus)) {
      for (const moneyStatus of Object.values(TransactionStatus)) {
        const facing = toUserFacingComplianceState(status, moneyStatus);
        expect(facing === null || Object.values(UserFacingComplianceState).includes(facing)).toBe(true);
      }
    }
  });
});
