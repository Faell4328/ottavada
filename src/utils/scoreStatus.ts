export type ScoreStatusKey = "draft" | "pending" | "main" | "not_found";

const SCORE_STATUS_LABELS: Record<ScoreStatusKey, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  main: "Principal",
  not_found: "Não Encontrado",
};

const SCORE_STATUS_BADGE_CLASSES: Record<ScoreStatusKey, string> = {
  draft: "bg-orange-100 p-2 rounded-full",
  pending: "bg-yellow-100 p-2 rounded-full",
  main: "bg-green-100 p-2 rounded-full",
  not_found: "bg-red-100 p-2 rounded-full",
};

export function normalizeScoreStatus(status: unknown): string {
  return String(status ?? "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function getScoreStatusLabel(status: unknown): string {
  const normalized = normalizeScoreStatus(status) as ScoreStatusKey;
  return SCORE_STATUS_LABELS[normalized] ?? String(status ?? "");
}

export function getScoreStatusBadgeClass(status: unknown): string {
  const normalized = normalizeScoreStatus(status) as ScoreStatusKey;
  return SCORE_STATUS_BADGE_CLASSES[normalized] ?? "";
}
