/* ==================================================================
 *  LOCALE — estimates the user's country from the browser's language
 *  settings (navigator.languages). No network call, no permission
 *  prompt: we read the region code out of the language tag (hu-HU → HU,
 *  en-US → US); for a tag without a region (e.g. "de"), Intl's
 *  maximize() gives a likely region (de → DE). We only accept a country
 *  that actually EXISTS in the dataset — otherwise we fall back.
 * ================================================================== */
import { byCode } from "../data/countries";

/** The country code implied by the browser's locale; falls back if it can't be determined. */
export function detectCountry(fallback = "HU"): string {
  const langs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const lang of langs) {
    if (!lang) continue;
    try {
      const loc = new Intl.Locale(lang);
      const region = loc.region ?? loc.maximize().region;
      if (region && byCode(region)) return region;
    } catch {
      /* invalid language tag — try the next one */
    }
  }
  return fallback;
}
