import { PerTxnLimitExceededError, UnsupportedLimitCurrencyError } from "../errors/transaction.error";

/**
 * Per-transaction remittance limit (P0-1a, decision D2: USD 5,000 no-doc ceiling).
 *
 * The check is intentionally DETERMINISTIC and self-contained: the same
 * (amount, currency) always yields the same decision, independent of live FX or
 * any external provider on the confirm hot path. A regulatory ceiling must be
 * reproducible and auditable, so it uses a fixed reference-rate table rather than
 * a market quote.
 *
 * Q1 (OPEN): the canonical KRW→USD reference basis is not finalized. The rates
 * below are PLACEHOLDERS — coarse, conservative, and easy to update. Replace with
 * the agreed reference (e.g. a published daily rate) when Q1 lands; the engine and
 * its callers do not change.
 */
export const DEFAULT_PER_TXN_LIMIT_USD = 5000;

/**
 * USD value of one unit of each currency. USD is the limit currency (rate 1).
 *
 * CONSERVATIVE ON PURPOSE: for a ceiling, the safe error is to OVER-estimate the
 * USD value (catch large transfers early), so each rate assumes a relatively
 * STRONG send currency vs spot. e.g. KRW uses 1/1100 (not ~1/1350 spot) so the
 * check stays safe even if KRW strengthens. This trades a few false-positives near
 * the boundary for never letting a true >$5,000 transfer slip under the ceiling.
 *
 * Every currency VPay can send (see CurrencyCode / country-capability matrix) MUST
 * have an entry — an unlisted currency fails closed (hard-blocks the corridor). A
 * unit test asserts table ⊇ CurrencyCode to catch drift.
 *
 * Q1 (OPEN): these are placeholders pending the agreed reference basis.
 */
export const USD_REFERENCE_RATES: Readonly<Record<string, number>> = {
  USD: 1,
  KRW: 1 / 1100,
  SGD: 0.8,
  IDR: 1 / 14000,
  VND: 1 / 22000,
  THB: 0.032,
  GBP: 1.4,
  EUR: 1.2,
  CAD: 0.8,
};

/** USD-equivalent of `amount` in `currency`, or null when no reference rate exists. */
export function toUsdEquivalent(amount: number, currency: string): number | null {
  const rate = USD_REFERENCE_RATES[currency];
  if (rate === undefined) {
    return null;
  }
  return amount * rate;
}

/**
 * Asserts a single transaction's send amount is within the per-transaction USD
 * limit. Fails closed: an unsupported currency cannot be limit-checked, so it is
 * rejected rather than waved through.
 *
 * Basis: `amount` is the send PRINCIPAL (excluding fee) — the standard basis for a
 * remittance "amount sent" ceiling.
 */
export function assertWithinPerTxnLimit(
  amount: number,
  currency: string,
  limitUsd: number = DEFAULT_PER_TXN_LIMIT_USD,
): void {
  const usd = toUsdEquivalent(amount, currency);
  if (usd === null) {
    throw new UnsupportedLimitCurrencyError(currency);
  }
  // Compare in integer cents so IEEE-754 noise (e.g. amount * (1/1100)) can't flip
  // a boundary decision; the boundary stays inclusive (amount == limit is allowed).
  if (Math.round(usd * 100) > Math.round(limitUsd * 100)) {
    throw new PerTxnLimitExceededError(amount, currency, usd, limitUsd);
  }
}
