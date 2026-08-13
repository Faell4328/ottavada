import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const SUPPORTED_LANGS = ["pt", "en", "es", "fr", "it", "de"] as const;
const FALLBACK_LANG = "en";
const STORAGE_KEY = "ottavada-lang";

type LocaleCode = (typeof SUPPORTED_LANGS)[number];

const localeLoaders: Record<LocaleCode, () => Promise<{ default: Record<string, unknown> }>> = {
  pt: () => import("./locales/pt.json"),
  en: () => import("./locales/en.json"),
  es: () => import("./locales/es.json"),
  fr: () => import("./locales/fr.json"),
  it: () => import("./locales/it.json"),
  de: () => import("./locales/de.json"),
};

function isSupported(lng: string): lng is LocaleCode {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng);
}

function detectLanguage(): LocaleCode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && isSupported(saved)) {
    return saved;
  }

  if (typeof navigator !== "undefined") {
    const raw = navigator.language?.slice(0, 2).toLowerCase();
    if (raw && isSupported(raw)) {
      return raw;
    }
  }

  return FALLBACK_LANG;
}

async function loadLanguage(lng: LocaleCode): Promise<void> {
  const loader = localeLoaders[lng];
  const { default: bundle } = await loader();
  i18n.addResourceBundle(lng, "translation", bundle, true, true);
}

export async function initI18n(): Promise<void> {
  const initial = detectLanguage();

  if (!i18n.isInitialized) {
    await i18n.init({
      lng: initial,
      fallbackLng: FALLBACK_LANG,
      interpolation: {
        escapeValue: false,
      },
    });
  }

  if (!i18n.hasResourceBundle(initial, "translation")) {
    await loadLanguage(initial);
  }
  await i18n.changeLanguage(initial);
}

i18n.use(initReactI18next);

export async function changeLanguage(lng: string): Promise<void> {
  if (!isSupported(lng)) {
    throw new Error(`Unsupported language: ${lng}`);
  }

  if (!i18n.hasResourceBundle(lng, "translation")) {
    await loadLanguage(lng);
  }

  await i18n.changeLanguage(lng);
}

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
