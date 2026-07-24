/* Rate-summary text shared by the country picker (src/ui/CountrySelect.tsx)
 * and the review-sheet generator (scripts/report.ts). */
import type { Country } from "../schema/country";

/** Minimal translator shape: satisfied both by i18next's `t` and by the
 *  report script's plain en.json lookup. */
export type TranslateFn = (key: string) => string;

/** True if the country's rate ACTUALLY varies by state/province.
 *  AU also has a subRegions list, but GST is a flat national 10% — the
 *  Wizard (needsStateInput) doesn't ask for a state there for this same
 *  reason, so we need to exclude it here too, otherwise the min–max range
 *  would print a bogus "10–10%" for a country that really has just one
 *  rate. */
export function hasRegionalRates(c: Country): boolean {
  return Boolean(c.subRegions?.length) && (c.system === "us" || c.system === "ca" || c.system === "br");
}

/** The country's rates as plain text, with a consistent separator, each one
 *  labeled: "VAT standard 27% · reduced 18%, 5%". The "standard" / "reduced"
 *  prefix always sits right before the number, so the text alone (even
 *  without the tooltip) makes it clear which number is which rate type. */
export function ratesText(c: Country, t: TranslateFn): string {
  if (c.system === "none") return t("countrySelect.system.none");
  if (hasRegionalRates(c)) {
    const rates = c.subRegions!.map((r) => r.rate);
    return `${t(`countrySelect.system.${c.system}`)} · ${Math.min(...rates)}–${Math.max(...rates)}%`;
  }
  const base = `${t(`countrySelect.system.${c.system}`)} ${t("countrySelect.stdShort")} ${c.std}%`;
  return c.reduced.length
    ? `${base} · ${t("countrySelect.reducedShort")} ${c.reduced.map((r) => `${r}%`).join(", ")}`
    : base;
}
