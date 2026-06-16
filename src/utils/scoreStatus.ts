export type ScoreStatusKey = "main" | "draft" | "ignored" | "not_found";

const SCORE_STATUS_LABELS: Record<ScoreStatusKey, string> = {
  main: "Envio permitido",
  draft: "Envio não permitido",
  ignored: "Ignorada",
  not_found: "Sem partitura",
};

const SCORE_STATUS_BADGE_CLASSES: Record<ScoreStatusKey, string> = {
  main: "inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800",
  draft: "inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800",
  ignored: "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700",
  not_found: "inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800",
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
