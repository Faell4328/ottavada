function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeSongNameInput(value: string): string {
  return value.toUpperCase();
}

export function normalizeSongNameForSave(value: string): string {
  return collapseWhitespace(value)
    .toUpperCase()
    .replace(/\b([1-9])\b/g, "0$1");
}

export function normalizeScoreNameInput(value: string): string {
  // Keep raw typing behavior (including leading/trailing spaces) to avoid
  // cursor jumps and unexpected input changes while the user is editing.
  return value;
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

  return normalized.replace(/^\d+\s*/, "");
}
