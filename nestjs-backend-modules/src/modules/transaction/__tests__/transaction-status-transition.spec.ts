import { TransactionStatus } from "../../../../generated/prisma/enums";
import {
  canTransitionTransactionStatus,
  FINAL_TRANSACTION_STATUSES,
  getAllowedNextTransactionStatuses,
  isFinalTransactionStatus,
  TRANSACTION_STATUS_TRANSITIONS,
  validateTransactionStatusTransition,
} from "../domain/transaction-status-transition";
import {
  InvalidTransactionStatusTransitionError,
  TransactionStatusAlreadyFinalizedError,
} from "../errors/transaction.error";

describe("transaction-status-transition", () => {
  describe("isFinalTransactionStatus", () => {
    it.each([TransactionStatus.CANCELLED, TransactionStatus.REFUNDED])(
      "returns true for terminal status %s",
      (status) => {
        expect(isFinalTransactionStatus(status)).toBe(true);
      },
    );

    it("returns false for EXPIRED (soft-terminal — user/admin cancel is still allowed per PRD §15.2)", () => {
      expect(isFinalTransactionStatus(TransactionStatus.EXPIRED)).toBe(false);
    });

    it.each([
      TransactionStatus.CREATED,
      TransactionStatus.QUOTE_CONFIRMED,
      TransactionStatus.PAYMENT_RECEIVED,
      TransactionStatus.PROCESSING,
      TransactionStatus.SENT_TO_PARTNER,
      TransactionStatus.FAILED,
      TransactionStatus.COMPLETED,
    ])("returns false for non-terminal status %s", (status) => {
      expect(isFinalTransactionStatus(status)).toBe(false);
    });

    it("returns true for legacy PENDING (frozen, no forward transitions)", () => {
      expect(isFinalTransactionStatus(TransactionStatus.PENDING)).toBe(true);
    });
  });

  describe("getAllowedNextTransactionStatuses", () => {
    it("allows CREATED to QUOTE_CONFIRMED, CANCELLED, EXPIRED", () => {
      expect(getAllowedNextTransactionStatuses(TransactionStatus.CREATED)).toEqual(
        expect.arrayContaining([
          TransactionStatus.QUOTE_CONFIRMED,
          TransactionStatus.CANCELLED,
          TransactionStatus.EXPIRED,
        ]),
      );
    });

    it("allows EXPIRED only to CANCELLED (cleanup edge, PRD §15.2)", () => {
      expect(getAllowedNextTransactionStatuses(TransactionStatus.EXPIRED)).toEqual([TransactionStatus.CANCELLED]);
    });

    it("disallows PAYMENT_RECEIVED to CANCELLED (must go through FAILED → REFUNDED, PRD §15.4)", () => {
      expect(getAllowedNextTransactionStatuses(TransactionStatus.PAYMENT_RECEIVED)).toEqual([
        TransactionStatus.PROCESSING,
      ]);
    });

    it("allows COMPLETED only to REFUNDED (reversible terminal)", () => {
      expect(getAllowedNextTransactionStatuses(TransactionStatus.COMPLETED)).toEqual([TransactionStatus.REFUNDED]);
    });

    it("allows FAILED to PROCESSING, REFUNDED, COMPLETED (reconciliation paths)", () => {
      expect(getAllowedNextTransactionStatuses(TransactionStatus.FAILED)).toEqual(
        expect.arrayContaining([TransactionStatus.PROCESSING, TransactionStatus.REFUNDED, TransactionStatus.COMPLETED]),
      );
    });

    it.each(FINAL_TRANSACTION_STATUSES)("returns empty array for terminal status %s", (status) => {
      expect(getAllowedNextTransactionStatuses(status)).toEqual([]);
    });
  });

  describe("canTransitionTransactionStatus", () => {
    it("returns true for CREATED -> QUOTE_CONFIRMED", () => {
      expect(canTransitionTransactionStatus(TransactionStatus.CREATED, TransactionStatus.QUOTE_CONFIRMED)).toBe(true);
    });

    it("returns true for FAILED -> COMPLETED (reconciliation false-FAILED case)", () => {
      expect(canTransitionTransactionStatus(TransactionStatus.FAILED, TransactionStatus.COMPLETED)).toBe(true);
    });

    it("returns true for COMPLETED -> REFUNDED", () => {
      expect(canTransitionTransactionStatus(TransactionStatus.COMPLETED, TransactionStatus.REFUNDED)).toBe(true);
    });

    it("returns false for CREATED -> COMPLETED (must go through QUOTE_CONFIRMED first)", () => {
      expect(canTransitionTransactionStatus(TransactionStatus.CREATED, TransactionStatus.COMPLETED)).toBe(false);
    });

    it("returns false for REFUNDED -> any (terminal)", () => {
      expect(canTransitionTransactionStatus(TransactionStatus.REFUNDED, TransactionStatus.COMPLETED)).toBe(false);
      expect(canTransitionTransactionStatus(TransactionStatus.REFUNDED, TransactionStatus.PROCESSING)).toBe(false);
    });
  });

  describe("validateTransactionStatusTransition", () => {
    it.each([
      [TransactionStatus.CREATED, TransactionStatus.QUOTE_CONFIRMED],
      [TransactionStatus.QUOTE_CONFIRMED, TransactionStatus.PAYMENT_RECEIVED],
      [TransactionStatus.PAYMENT_RECEIVED, TransactionStatus.PROCESSING],
      [TransactionStatus.PROCESSING, TransactionStatus.SENT_TO_PARTNER],
      [TransactionStatus.SENT_TO_PARTNER, TransactionStatus.COMPLETED],
      [TransactionStatus.COMPLETED, TransactionStatus.REFUNDED],
      [TransactionStatus.FAILED, TransactionStatus.PROCESSING],
    ])("permits %s -> %s", (current, next) => {
      expect(() => validateTransactionStatusTransition(current, next)).not.toThrow();
    });

    it("treats same-status transitions as no-ops (idempotent retries)", () => {
      expect(() =>
        validateTransactionStatusTransition(TransactionStatus.COMPLETED, TransactionStatus.COMPLETED),
      ).not.toThrow();
      expect(() =>
        validateTransactionStatusTransition(TransactionStatus.PROCESSING, TransactionStatus.PROCESSING),
      ).not.toThrow();
    });

    it("rejects transitions out of a terminal status with finalized error", () => {
      expect(() =>
        validateTransactionStatusTransition(TransactionStatus.CANCELLED, TransactionStatus.PROCESSING),
      ).toThrow(TransactionStatusAlreadyFinalizedError);
      expect(() =>
        validateTransactionStatusTransition(TransactionStatus.REFUNDED, TransactionStatus.COMPLETED),
      ).toThrow(TransactionStatusAlreadyFinalizedError);
    });

    it("rejects skipping the lifecycle (CREATED -> COMPLETED) with invalid-transition error", () => {
      expect(() => validateTransactionStatusTransition(TransactionStatus.CREATED, TransactionStatus.COMPLETED)).toThrow(
        InvalidTransactionStatusTransitionError,
      );
    });

    it("rejects unknown next status with invalid-transition error", () => {
      const unknown = "FOO" as TransactionStatus;
      expect(() => validateTransactionStatusTransition(TransactionStatus.CREATED, unknown)).toThrow(
        InvalidTransactionStatusTransitionError,
      );
    });

    it("rejects forward transitions out of legacy PENDING with finalized error", () => {
      expect(() => validateTransactionStatusTransition(TransactionStatus.PENDING, TransactionStatus.COMPLETED)).toThrow(
        TransactionStatusAlreadyFinalizedError,
      );
    });
  });

  describe("TRANSACTION_STATUS_TRANSITIONS table", () => {
    it("covers every TransactionStatus value as a key", () => {
      const enumValues = Object.values(TransactionStatus);
      const tableKeys = Object.keys(TRANSACTION_STATUS_TRANSITIONS);
      expect(new Set(tableKeys)).toEqual(new Set(enumValues));
    });
  });
});
