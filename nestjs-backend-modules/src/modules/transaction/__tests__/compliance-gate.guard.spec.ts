import { ComplianceStatus, TransactionStatus } from "../../../../generated/prisma/enums";
import { assertCompliancePermitsMoneyTransition } from "../domain/compliance-gate.guard";
import { ComplianceGateNotClearedError } from "../errors/transaction.error";

describe("compliance-gate.guard", () => {
  describe("gate A — QUOTE_CONFIRMED -> PAYMENT_RECEIVED (requires PRE_CLEARED)", () => {
    it.each([ComplianceStatus.PRE_CLEARED, ComplianceStatus.CLEARED])(
      "permits accepting a deposit when compliance is %s",
      (compliance) => {
        expect(() =>
          assertCompliancePermitsMoneyTransition(TransactionStatus.PAYMENT_RECEIVED, compliance),
        ).not.toThrow();
      },
    );

    it.each([
      ComplianceStatus.PENDING,
      ComplianceStatus.SCREENING,
      ComplianceStatus.FDS,
      ComplianceStatus.MANUAL_REVIEW,
      ComplianceStatus.ORIS_REPORTING,
      ComplianceStatus.BLOCKED,
    ])("blocks accepting a deposit when compliance is %s", (compliance) => {
      expect(() => assertCompliancePermitsMoneyTransition(TransactionStatus.PAYMENT_RECEIVED, compliance)).toThrow(
        ComplianceGateNotClearedError,
      );
    });
  });

  describe("gate B — PROCESSING -> SENT_TO_PARTNER (requires CLEARED)", () => {
    it("permits payout only when compliance is CLEARED", () => {
      expect(() =>
        assertCompliancePermitsMoneyTransition(TransactionStatus.SENT_TO_PARTNER, ComplianceStatus.CLEARED),
      ).not.toThrow();
    });

    it.each([
      ComplianceStatus.PENDING,
      ComplianceStatus.SCREENING,
      ComplianceStatus.FDS,
      ComplianceStatus.PRE_CLEARED,
      ComplianceStatus.MANUAL_REVIEW,
      ComplianceStatus.ORIS_REPORTING,
      ComplianceStatus.BLOCKED,
    ])("blocks payout when compliance is %s", (compliance) => {
      expect(() => assertCompliancePermitsMoneyTransition(TransactionStatus.SENT_TO_PARTNER, compliance)).toThrow(
        ComplianceGateNotClearedError,
      );
    });

    it("never lets a BLOCKED transaction reach payout", () => {
      expect(() =>
        assertCompliancePermitsMoneyTransition(TransactionStatus.SENT_TO_PARTNER, ComplianceStatus.BLOCKED),
      ).toThrow(ComplianceGateNotClearedError);
    });
  });

  describe("ungated money transitions (refund path must always work)", () => {
    it.each([
      TransactionStatus.PROCESSING,
      TransactionStatus.FAILED,
      TransactionStatus.REFUNDED,
      TransactionStatus.CANCELLED,
      TransactionStatus.COMPLETED,
      TransactionStatus.EXPIRED,
      TransactionStatus.QUOTE_CONFIRMED,
    ])("does not gate transition to %s even when BLOCKED", (target) => {
      expect(() => assertCompliancePermitsMoneyTransition(target, ComplianceStatus.BLOCKED)).not.toThrow();
    });

    it("allows the unhappy-path unwind PROCESSING -> FAILED -> REFUNDED while BLOCKED", () => {
      expect(() =>
        assertCompliancePermitsMoneyTransition(TransactionStatus.FAILED, ComplianceStatus.BLOCKED),
      ).not.toThrow();
      expect(() =>
        assertCompliancePermitsMoneyTransition(TransactionStatus.REFUNDED, ComplianceStatus.BLOCKED),
      ).not.toThrow();
    });
  });

  describe("ComplianceGateNotClearedError non-disclosure", () => {
    const throwGate = (): never => {
      assertCompliancePermitsMoneyTransition(TransactionStatus.SENT_TO_PARTNER, ComplianceStatus.MANUAL_REVIEW);
      throw new Error("expected the gate to throw");
    };

    it("keeps the compliance phases readable server-side for logs/audit", () => {
      let error: ComplianceGateNotClearedError;
      try {
        throwGate();
      } catch (e) {
        error = e as ComplianceGateNotClearedError;
      }
      expect(error!.complianceStatus).toBe(ComplianceStatus.MANUAL_REVIEW);
      expect(error!.requiredComplianceStatus).toBe(ComplianceStatus.CLEARED);
    });

    it("never serializes the internal compliance phase (JSON.stringify and envelope body)", () => {
      let error: ComplianceGateNotClearedError;
      try {
        throwGate();
      } catch (e) {
        error = e as ComplianceGateNotClearedError;
      }
      const enumerable = { ...error! };
      expect(Object.keys(enumerable)).not.toContain("complianceStatus");
      expect(Object.keys(enumerable)).not.toContain("requiredComplianceStatus");
      // MANUAL_REVIEW must not appear anywhere in what a serializer could emit.
      // (CLEARED cannot be asserted the same way — the error code itself contains
      // it as a substring: COMPLIANCE_GATE_NOT_CLEARED.)
      const serialized = JSON.stringify(enumerable) + JSON.stringify(error!.getResponse());
      expect(serialized).not.toContain(ComplianceStatus.MANUAL_REVIEW);
    });
  });
});
