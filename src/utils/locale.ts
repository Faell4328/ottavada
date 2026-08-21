const LOCALE_MAP: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
};

export function getLocale(language: string): string {
  return LOCALE_MAP[language] || "en-US";
}
