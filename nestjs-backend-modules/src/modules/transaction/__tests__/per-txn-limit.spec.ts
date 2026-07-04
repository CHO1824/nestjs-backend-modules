import { CurrencyCode } from "@/modules/currency/constants/country-capability.constants";

import {
  assertWithinPerTxnLimit,
  DEFAULT_PER_TXN_LIMIT_USD,
  toUsdEquivalent,
  USD_REFERENCE_RATES,
} from "../domain/per-txn-limit";
import { PerTxnLimitExceededError, UnsupportedLimitCurrencyError } from "../errors/transaction.error";

describe("per-txn-limit", () => {
  describe("toUsdEquivalent", () => {
    it("returns the amount unchanged for USD", () => {
      expect(toUsdEquivalent(4000, "USD")).toBe(4000);
    });

    it("converts a non-USD amount via the reference rate", () => {
      expect(toUsdEquivalent(1100, "KRW")).toBeCloseTo(1, 6);
    });

    it("returns null for a currency with no reference rate", () => {
      expect(toUsdEquivalent(1000, "JPY")).toBeNull();
    });
  });

  describe("reference-rate table coverage (drift guard)", () => {
    it("has a reference rate for every sendable CurrencyCode (else that corridor hard-blocks)", () => {
      for (const currency of Object.values(CurrencyCode)) {
        expect(USD_REFERENCE_RATES[currency]).toBeDefined();
      }
    });
  });

  describe("assertWithinPerTxnLimit", () => {
    it("permits a USD amount below the limit", () => {
      expect(() => assertWithinPerTxnLimit(4999, "USD")).not.toThrow();
    });

    it("permits an amount exactly at the limit (boundary inclusive)", () => {
      expect(() => assertWithinPerTxnLimit(DEFAULT_PER_TXN_LIMIT_USD, "USD")).not.toThrow();
    });

    it("rejects a USD amount above the limit", () => {
      expect(() => assertWithinPerTxnLimit(5000.01, "USD")).toThrow(PerTxnLimitExceededError);
    });

    it("rejects a KRW amount whose USD equivalent exceeds the limit", () => {
      // 5000 / rate = the KRW value at exactly the limit; add a unit to exceed it.
      const krwAtLimit = DEFAULT_PER_TXN_LIMIT_USD / USD_REFERENCE_RATES.KRW;
      expect(() => assertWithinPerTxnLimit(krwAtLimit + 10_000, "KRW")).toThrow(PerTxnLimitExceededError);
    });

    it("permits a KRW amount whose USD equivalent is under the limit", () => {
      expect(() => assertWithinPerTxnLimit(1_000_000, "KRW")).not.toThrow();
    });

    it("treats a KRW amount exactly at the limit as inclusive (no float over-reject)", () => {
      // KRW value whose USD-equivalent is exactly the limit at the reference rate.
      const krwAtLimit = Math.round(DEFAULT_PER_TXN_LIMIT_USD / USD_REFERENCE_RATES.KRW);
      expect(() => assertWithinPerTxnLimit(krwAtLimit, "KRW")).not.toThrow();
    });

    it("enforces the limit for a VND source amount", () => {
      const vndOverLimit = Math.round((DEFAULT_PER_TXN_LIMIT_USD + 100) / USD_REFERENCE_RATES.VND);
      expect(() => assertWithinPerTxnLimit(vndOverLimit, "VND")).toThrow(PerTxnLimitExceededError);
      expect(() => assertWithinPerTxnLimit(1_000_000, "VND")).not.toThrow();
    });

    it("honors a custom limit argument", () => {
      expect(() => assertWithinPerTxnLimit(150, "USD", 100)).toThrow(PerTxnLimitExceededError);
      expect(() => assertWithinPerTxnLimit(80, "USD", 100)).not.toThrow();
    });

    it("fails closed for an unsupported currency (cannot be limit-checked)", () => {
      expect(() => assertWithinPerTxnLimit(1, "JPY")).toThrow(UnsupportedLimitCurrencyError);
    });

    it("carries the dedicated PER_TXN_LIMIT_EXCEEDED code and 422 status", () => {
      try {
        assertWithinPerTxnLimit(6000, "USD");
        throw new Error("expected to throw");
      } catch (e) {
        const err = e as PerTxnLimitExceededError;
        expect(err.code).toBe("PER_TXN_LIMIT_EXCEEDED");
        expect(err.getStatus()).toBe(422);
      }
    });
  });
});
