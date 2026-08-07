/* ==================================================================
 *  I18N — i18next setup. English is the source language; every other
 *  locale in ./locales is a one-time machine translation of the UI
 *  chrome (see scripts/translate.ts). The user sees the language of the
 *  country they come from (lib/language.ts); missing keys/languages fall
 *  back to English.
 * ================================================================== */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/* Bundle every locale JSON at build time: en.json + the generated
 * <lang>.json files. Adding a language is just dropping in a new file. */
const modules = import.meta.glob("./locales/*.json", { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const [path, mod] of Object.entries(modules)) {
  const lng = path.match(/\/([^/]+)\.json$/)![1];
  resources[lng] = { translation: mod.default };
}

/** The languages we actually ship a translation for (used by the selector). */
export const LANGUAGES = Object.keys(resources).sort();

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes on its own
});

export default i18n;
