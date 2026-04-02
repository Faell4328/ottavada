function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeSongNameInput(value: string): string {
  return value.toUpperCase();
}

export function normalizeSongNameForSave(value: string): string {
  return collapseWhitespace(value).toUpperCase();
}

export function normalizeScoreNameInput(value: string): string {
  return normalizeScoreCore(value);
}

export function normalizeScoreNameForSave(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeScoreCore(value);
  return normalized ? normalized : null;
}

function normalizeScoreCore(value: string): string {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^(.*?)(\d+)?$/);
  if (!match) {
    return normalized.replace(/\d+/g, "");
  }

  const baseRaw = match[1] ?? "";
  const trailingDigits = match[2] ?? "";
  const base = collapseWhitespace(baseRaw.replace(/\d+/g, ""));

  if (!base) {
    return "";
  }

  return trailingDigits ? `${base} ${trailingDigits}` : base;
}
