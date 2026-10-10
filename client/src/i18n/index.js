import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.js";
import hi from "./locales/hi.js";

/**
 * Wording of the screens a signer sees. The signer's language is chosen by the sender and can be
 * switched on the signing page.
 *
 * English is complete. Hindi was written by the development team and must be reviewed by a native
 * speaker before launch; the consent sentence also needs the lawyer's approval in each language.
 * A language without its own wording falls back to English.
 *
 * To add a language: add a file in ./locales with the same keys as en.js, then list it here.
 */
export const SIGNING_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

const resources = {
  en: { translation: en },
  hi: { translation: hi },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
