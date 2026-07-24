/* Display formatting. Rate resolution comes from the lib (src/lib/vat.ts).
 * Every formatter reads i18n.language — which is pinned to "en", since the
 * app is single-language (see src/i18n.ts). */
export { resolveRate } from "../lib/vat";
import i18n from "../i18n";
import { byCode } from "../data/countries";

export function fmtMoney(n: number, currency: string): string {
  // currencyDisplay: "code" — this way it ALWAYS matches the currency
  // picker next to Net (HUF/USD/…), never mixed up with "Ft" / "$".
  return new Intl.NumberFormat(i18n.language, {
    style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

/** Just the formatted number, without the currency code — in the calculator
 *  row's cells the code sits separately, in smaller type, before the big
 *  number. */
export function fmtAmount(n: number, currency: string): string {
  return new Intl.NumberFormat(i18n.language, {
    style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2,
  }).formatToParts(isFinite(n) ? n : 0)
    .map((p) => (p.type === "currency" ? "" : p.value)).join("").trim();
}

export function fmtPct(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
}

/* Country name in the active language — Intl.DisplayNames gives the
 * browser's built-in translation for any language; falls back to
 * countries.json's (English) name. */
const displayNamesCache = new Map<string, Intl.DisplayNames>();

export function countryName(code: string): string {
  const lang = i18n.language;
  try {
    let dn = displayNamesCache.get(lang);
    if (!dn) {
      dn = new Intl.DisplayNames([lang], { type: "region" });
      displayNamesCache.set(lang, dn);
    }
    const name = dn.of(code);
    if (name && name !== code) return name;
  } catch { /* unknown language/code — fallback */ }
  return byCode(code)?.name ?? code;
}
