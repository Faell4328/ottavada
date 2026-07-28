import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import pt from "./locales/pt.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import de from "./locales/de.json";

const SUPPORTED_LANGS = ["pt", "en", "es", "fr", "it", "de"] as const;
const FALLBACK_LANG = "pt";

function detectLanguage(): string {
  const saved = localStorage.getItem("ottavada-lang");
  if (saved) return saved;

  if (typeof navigator !== "undefined") {
    const raw = navigator.language?.slice(0, 2).toLowerCase();
    if (raw && SUPPORTED_LANGS.includes(raw as typeof SUPPORTED_LANGS[number])) {
      return raw;
    }
  }

  return FALLBACK_LANG;
}

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    it: { translation: it },
    de: { translation: de },
  },
  lng: detectLanguage(),
  fallbackLng: FALLBACK_LANG,
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("ottavada-lang", lng);
});

export default i18n;
