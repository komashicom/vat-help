/* ==================================================================
 *  LANGUAGE — picks the UI language and keeps <html lang/dir> in sync.
 *
 *  Startup order of preference:
 *    1. the language the user explicitly picked before (localStorage),
 *    2. the language of the country they come from (detectCountry),
 *    3. English.
 *  We only pick a language we actually ship a translation for; anything
 *  else degrades to English via i18next's fallbackLng.
 * ================================================================== */
import i18n from "../i18n";
import { detectCountry } from "./locale";
import { languageForCountry, RTL_LANGUAGES } from "../data/country-language";

const STORAGE_KEY = "vat.lang";

function hasResource(lang: string): boolean {
  return i18n.hasResourceBundle(lang, "translation");
}

/** Reflect the active language on the document (right-to-left for ar/he). */
function applyDocument(lang: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGUAGES.has(lang) ? "rtl" : "ltr";
}

/** Resolve and apply the startup language. Call once before/at first render. */
export function initLanguage(): void {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  // No "HU" fallback here: when we can't tell the country, default the UI to
  // English (understood widest), not Hungarian. detectCountry("") returns ""
  // on failure, and languageForCountry("") → "en".
  const detected = languageForCountry(detectCountry(""));
  const lang = saved && hasResource(saved) ? saved
    : hasResource(detected) ? detected
    : "en";
  void i18n.changeLanguage(lang);
  applyDocument(lang);
}

/** The user picked a language in the selector — persist and apply it. */
export function setLanguage(lang: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode / storage disabled — the choice just won't persist */
  }
  void i18n.changeLanguage(lang);
  applyDocument(lang);
}
