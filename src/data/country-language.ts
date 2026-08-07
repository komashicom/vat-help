/* ==================================================================
 *  COUNTRY → LANGUAGE — the primary UI language shown for each country.
 *
 *  The app detects which country the user comes from (see lib/locale.ts)
 *  and shows the UI in that country's language. One primary language per
 *  country: multilingual countries fall back to their most common
 *  business language (BE→nl, CH→de, CA→en, LU→fr). Countries whose
 *  language we don't ship a translation for fall back to English via
 *  i18next's fallbackLng.
 *
 *  The VAT *rules* themselves stay in English on purpose — only the UI
 *  chrome is translated. See scripts/translate.ts.
 * ================================================================== */

/** Primary UI language (i18next code) for each country code. */
export const COUNTRY_LANGUAGE: Record<string, string> = {
  AE: "ar", AR: "es", AT: "de", AU: "en", BE: "nl", BG: "bg", BH: "ar",
  BR: "pt", CA: "en", CH: "de", CL: "es", CN: "zh", CO: "es", CY: "el",
  CZ: "cs", DE: "de", DK: "da", EE: "et", EG: "ar", ES: "es", FI: "fi",
  FR: "fr", GB: "en", GE: "ka", GR: "el", HK: "zh", HR: "hr", HU: "hu",
  ID: "id", IE: "en", IL: "he", IN: "en", IS: "is", IT: "it", JP: "ja",
  KR: "ko", KW: "ar", LT: "lt", LU: "fr", LV: "lv", MA: "ar", MD: "ro",
  MT: "en", MX: "es", MY: "ms", NG: "en", NL: "nl", NO: "no", NZ: "en",
  OM: "ar", PH: "en", PL: "pl", PT: "pt", QA: "ar", RO: "ro", RS: "sr",
  SA: "ar", SE: "sv", SG: "en", SI: "sl", SK: "sk", TH: "th", TR: "tr",
  TW: "zh", UA: "uk", US: "en", VN: "vi", ZA: "en",
};

/** Languages written right-to-left — the document dir is flipped for these. */
export const RTL_LANGUAGES = new Set(["ar", "he"]);

/** The UI language for a country code; English if we don't map it. */
export function languageForCountry(code: string): string {
  return COUNTRY_LANGUAGE[code] ?? "en";
}
