/* ==================================================================
 *  EU THRESHOLD — estimates the €10,000 distance-selling/OSS threshold
 *  from the amount entered. NOT a toggle: we compare the net amount the
 *  user entered against the threshold (approximate for non-EUR
 *  currencies, using a hard-coded exchange rate), and warn in the result
 *  that the threshold actually applies to the YEARLY total of EU-wide
 *  B2C sales, not a single transaction.
 * ================================================================== */

export const EU_THRESHOLD_EUR = 10_000;

/** Approximate EUR exchange rates for ESTIMATING the threshold (not for accounting!). */
const APPROX_EUR_RATE: Record<string, number> = {
  EUR: 1,
  HUF: 1 / 400,
  USD: 0.9,
  GBP: 1.17,
  AUD: 0.6,
  CHF: 1.05,
};

/** The approximate EUR value of the given amount (unknown currency: 1:1). */
export function approxEur(amount: number, currency: string): number {
  const rate = APPROX_EUR_RATE[currency] ?? 1;
  return amount * rate;
}

/** Whether the entered amount is above the €10,000 threshold (an estimate). */
export function isOverEuThreshold(amount: number, currency: string): boolean {
  return approxEur(amount, currency) > EU_THRESHOLD_EUR;
}
