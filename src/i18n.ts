/* ==================================================================
 *  I18N — i18next setup. The app itself is single-language (English).
 * ================================================================== */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes on its own
});

export default i18n;
