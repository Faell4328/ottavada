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

const ORDER_PATTERNS: Array<{ rank: number; patterns: RegExp[] }> = [
  { rank: 1, patterns: [/^flute$/i, /^flauta$/i] },
  { rank: 2, patterns: [/^oboe$/i, /^oboe 1$/i, /^oboe 2$/i] },
  { rank: 3, patterns: [/^bassoon$/i, /^fagote$/i] },
  { rank: 4, patterns: [/^clarinet(?:\s+in)?\s+bb\s+1$/i, /^clarinet\s+sib\s+1$/i] },
  { rank: 5, patterns: [/^clarinet(?:\s+in)?\s+bb\s+2$/i, /^clarinet\s+sib\s+2$/i] },
  { rank: 6, patterns: [/^clarinet(?:\s+in)?\s+bb\s+3$/i, /^clarinet\s+sib\s+3$/i] },
  { rank: 7, patterns: [/^bass\s+clarinet$/i, /^clarinete\s+baixo$/i] },
  { rank: 8, patterns: [/^alto\s+sax(?:ophone)?\s+1$/i, /^sax(?:ophone)?\s+alto\s+1$/i] },
  { rank: 9, patterns: [/^alto\s+sax(?:ophone)?\s+2$/i, /^sax(?:ophone)?\s+alto\s+2$/i] },
  { rank: 10, patterns: [/^tenor\s+sax(?:ophone)?$/i, /^sax(?:ophone)?\s+tenor$/i] },
  { rank: 11, patterns: [/^baritone\s+sax(?:ophone)?$/i, /^sax(?:ophone)?\s+baritone$/i] },
  { rank: 12, patterns: [/^trumpet(?:\s+in)?\s+bb\s+1$/i, /^trompete\s+sib\s+1$/i] },
  { rank: 13, patterns: [/^trumpet(?:\s+in)?\s+bb\s+2$/i, /^trompete\s+sib\s+2$/i] },
  { rank: 14, patterns: [/^trumpet(?:\s+in)?\s+bb\s+3$/i, /^trompete\s+sib\s+3$/i] },
  { rank: 15, patterns: [/^horn(?:\s+in)?\s+f\s+1$/i, /^trompa\s+f\s+1$/i, /^f\s+horn\s+1$/i] },
  { rank: 16, patterns: [/^horn(?:\s+in)?\s+f\s+2$/i, /^trompa\s+f\s+2$/i, /^f\s+horn\s+2$/i] },
  { rank: 17, patterns: [/^horn(?:\s+in)?\s+f\s+3$/i, /^trompa\s+f\s+3$/i, /^f\s+horn\s+3$/i] },
  { rank: 18, patterns: [/^trombone\s+1$/i] },
  { rank: 19, patterns: [/^trombone\s+2$/i] },
  { rank: 20, patterns: [/^trombone\s+3$/i] },
  {
    rank: 21,
    patterns: [
      /^baritone\s+t\s*c$/i,
      /^baritone\s+tc$/i,
      /^baritone\s*treble\s*clef$/i,
      /^baritono\s+t\s*c$/i,
    ],
  },
  { rank: 22, patterns: [/^tuba$/i] },
  { rank: 23, patterns: [/^violino\s+1$/i, /^violin\s+1$/i] },
  { rank: 24, patterns: [/^violino\s+2$/i, /^violin\s+2$/i] },
  { rank: 25, patterns: [/^viola$/i] },
  { rank: 26, patterns: [/^cello$/i, /^violoncello$/i, /^violoncelo$/i] },
  { rank: 27, patterns: [/^contrabass$/i, /^double\s+bass$/i, /^contrabaixo$/i] },
];

function getInstrumentRank(name: string | null | undefined): number {
  if (!name || !name.trim()) {
    return 0;
  }

  const normalized = normalizeText(name);
  if (!normalized) {
    return 0;
  }

  for (const entry of ORDER_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.rank;
    }
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
