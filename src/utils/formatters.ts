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
  const locale = i18n.language === "en" ? "en-US" : "pt-BR";
  const formattedDate = date.toLocaleDateString(locale);
  const formattedTime = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const separator = i18n.language === "en" ? " at " : " às ";
  return `${formattedDate}${separator}${formattedTime}`;
}
