function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()\.]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasToken(text: string, token: string): boolean {
  return text.split(" ").includes(token);
}

function hasAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((token) => hasToken(text, token));
}

function includesAny(text: string, fragments: string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment));
}

function getSectionNumber(name: string): number | null {
  const tokens = normalizeText(name).split(" ").filter(Boolean);

  for (const token of tokens) {
    if (token === "1" || token === "i") return 1;
    if (token === "2" || token === "ii") return 2;
    if (token === "3" || token === "iii") return 3;

    if (/^0*1$/.test(token)) return 1;
    if (/^0*2$/.test(token)) return 2;
    if (/^0*3$/.test(token)) return 3;
  }

  return null;
}

function numberedRank(baseRank: number, sectionNumber: number | null): number {
  if (sectionNumber === 2) return baseRank + 1;
  if (sectionNumber === 3) return baseRank + 2;
  return baseRank;
}

function isScoreOrGrade(text: string): boolean {
  return (
    text === "grade" ||
    text === "score" ||
    text === "full score" ||
    text === "conductor score" ||
    text === "partitura completa" ||
    text === "partitura geral" ||
    text === "regencia"
  );
}

function getInstrumentRank(name: string | null | undefined): number {
  if (!name || !name.trim()) {
    return 0;
  }

  const normalized = normalizeText(name);
  if (!normalized) {
    return 0;
  }

  if (isScoreOrGrade(normalized)) {
    return 0;
  }

  if (hasAnyToken(normalized, ["flute", "flauta"])) {
    return 1;
  }

  if (hasToken(normalized, "oboe")) {
    return 2;
  }

  if (hasAnyToken(normalized, ["bassoon", "fagote"])) {
    return 3;
  }

  if (
    (hasToken(normalized, "clarinet") || hasToken(normalized, "clarinete")) &&
    hasAnyToken(normalized, ["bass", "baixo"])
  ) {
    return 7;
  }

  if (hasToken(normalized, "clarinet") || hasToken(normalized, "clarinete")) {
    return numberedRank(4, getSectionNumber(normalized));
  }

  const hasSax = includesAny(normalized, ["sax", "saxophone", "saxofone"]);
  if (hasSax && hasToken(normalized, "alto")) {
    return numberedRank(8, getSectionNumber(normalized));
  }

  if (hasSax && hasToken(normalized, "tenor")) {
    return 10;
  }

  if (hasSax && hasAnyToken(normalized, ["baritone", "baritono"])) {
    return 11;
  }

  if (hasAnyToken(normalized, ["trumpet", "trompete"])) {
    return numberedRank(12, getSectionNumber(normalized));
  }

  if (hasAnyToken(normalized, ["horn", "trompa"])) {
    return numberedRank(15, getSectionNumber(normalized));
  }

  if (hasToken(normalized, "trombone")) {
    return numberedRank(18, getSectionNumber(normalized));
  }

  if (
    (hasToken(normalized, "baritone") || hasToken(normalized, "baritono")) &&
    (hasToken(normalized, "tc") ||
      (hasToken(normalized, "treble") && hasToken(normalized, "clef")) ||
      (hasToken(normalized, "t") && hasToken(normalized, "c")))
  ) {
    return 21;
  }

  if (hasToken(normalized, "tuba")) {
    return 22;
  }

  if (hasAnyToken(normalized, ["violin", "violino"])) {
    return numberedRank(23, getSectionNumber(normalized));
  }

  if (includesAny(normalized, ["viola"])) {
    return 25;
  }

  if (hasAnyToken(normalized, ["cello", "violoncello", "violoncelo"])) {
    return 26;
  }

  if (includesAny(normalized, ["contrabass", "double bass", "contrabaixo"])) {
    return 27;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function compareInstrumentNames(a: string | null | undefined, b: string | null | undefined): number {
  const rankA = getInstrumentRank(a);
  const rankB = getInstrumentRank(b);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  const normalizedA = normalizeText(a ?? "");
  const normalizedB = normalizeText(b ?? "");

  return normalizedA.localeCompare(normalizedB, "pt-BR");
}
