export type ScoreStatusKey = "draft" | "ignored" | "main";

const SCORE_STATUS_LABELS: Record<ScoreStatusKey, string> = {
  draft: "Rascunho",
  ignored: "Ignorada",
  main: "Principal",
};

const SCORE_STATUS_BADGE_CLASSES: Record<ScoreStatusKey, string> = {
  draft: "bg-orange-100 p-2 rounded-full",
  ignored: "bg-slate-100 p-2 rounded-full",
  main: "bg-green-100 p-2 rounded-full",
};

export function normalizeScoreStatus(status: unknown): string {
  const normalized = String(status ?? "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

  return normalized;
}

export function getScoreStatusLabel(status: unknown): string {
  const normalized = normalizeScoreStatus(status) as ScoreStatusKey;
  return SCORE_STATUS_LABELS[normalized] ?? String(status ?? "");
}

export function getScoreStatusBadgeClass(status: unknown): string {
  const normalized = normalizeScoreStatus(status) as ScoreStatusKey;
  return SCORE_STATUS_BADGE_CLASSES[normalized] ?? "";
}
