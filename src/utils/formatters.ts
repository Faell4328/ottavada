import i18n from "../i18n";

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let current = value;

  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }

  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatEta(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatBackupTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const localeMap: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    de: "de-DE",
  };
  const locale = localeMap[i18n.language] || "en-US";
  const formattedDate = date.toLocaleDateString(locale);
  const formattedTime = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const separatorMap: Record<string, string> = {
    en: " at ",
    pt: " às ",
    es: " a las ",
    fr: " à ",
    it: " alle ",
    de: " um ",
  };
  const separator = separatorMap[i18n.language] || " às ";
  return `${formattedDate}${separator}${formattedTime}`;
}
