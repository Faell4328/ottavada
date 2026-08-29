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

function includesAny(text: string, fragments: string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment));
}

// function getSectionNumber(name: string): number | null {
//   const tokens = normalizeText(name).split(" ").filter(Boolean);

//   for (const token of tokens) {
//     if (token === "1" || token === "i") return 1;
//     if (token === "2" || token === "ii") return 2;
//     if (token === "3" || token === "iii") return 3;

//     if (/^0*1$/.test(token)) return 1;
//     if (/^0*2$/.test(token)) return 2;
//     if (/^0*3$/.test(token)) return 3;
//   }

//   return null;
// }

// function numberedRank(baseRank: number, sectionNumber: number | null): number {
//   if (sectionNumber === 2) return baseRank + 1;
//   if (sectionNumber === 3) return baseRank + 2;
//   return baseRank;
// }

function isSectionMarker(token: string): boolean {
  if (/^\d+(?:st|nd|rd|th)?$/i.test(token)) {
    return true;
  }
  return /^(?=[ivxlcdm]+$)[ivxlcdm]+$/i.test(token);
}

export function getScoreBaseInstrumentName(
  name: string | null | undefined,
): string {
  const value = (name ?? "").trim().replace(/\s+/g, " ");
  if (!value) {
    return "";
  }

  const tokens = value.split(" ");
  const last = tokens[tokens.length - 1];
  if (tokens.length > 1 && isSectionMarker(last)) {
    return tokens.slice(0, -1).join(" ");
  }

  return value;
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

export function getInstrumentRank(name: string | null | undefined): number {
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

  // ════════════ WOODWINDS ════════════

  // 1. Piccolo
  if (
    includesAny(normalized, ["picc", "piccolo", "flauti"]) &&
    !includesAny(normalized, ["trumpet", "trompete"])
  ) {
    return 1;
  }

  // 3. Alto Flute
  if (
    includesAny(normalized, ["alt"]) &&
    includesAny(normalized, ["flut", "flaut"])
  ) {
    return 3;
  }

  // 2. Flute
  if (includesAny(normalized, ["flut", "flaut"])) {
    return 2;
  }

  // 5. Oboe d'Amore
  if (includesAny(normalized, ["obo"]) && includesAny(normalized, ["amo"])) {
    return 5;
  }

  // 4. Oboe
  if (includesAny(normalized, ["obo"])) {
    return 4;
  }

  // 6. Cor Anglais
  if (
    includesAny(normalized, ["cor", "horn"]) &&
    includesAny(normalized, ["eng", "ing"])
  ) {
    return 6;
  }

  // 7. Heckelphone
  if (includesAny(normalized, ["heckel"])) {
    return 7;
  }

  // 8. E♭ Clarinet
  if (
    includesAny(normalized, ["soprinho"]) ||
    (includesAny(normalized, ["clarinet"]) &&
      includesAny(normalized, ["mib", "eb"]))
  ) {
    return 8;
  }

  // 12. Contrabass Clarinet
  if (
    includesAny(normalized, ["clarinet"]) &&
    includesAny(normalized, ["contrabass", "contrabaixo"])
  ) {
    return 12;
  }

  // 10. Bass Clarinet
  if (
    includesAny(normalized, ["clarinet"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 10;
  }

  // 11. Contralto Clarinet
  if (
    includesAny(normalized, ["clarinet"]) &&
    includesAny(normalized, ["contralto"])
  ) {
    return 11;
  }

  // 9. Clarinet (B♭/A)
  if (includesAny(normalized, ["clarinet"])) {
    return 9;
  }

  // 17. Bass Saxophone
  if (
    includesAny(normalized, ["sax", "saxofone"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 17;
  }

  // 16. Baritone Saxophone
  if (
    includesAny(normalized, ["bari", "barí"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 16;
  }

  // 15. Tenor Saxophone
  if (
    includesAny(normalized, ["tenor"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 15;
  }

  // 14. Alto Saxophone
  if (
    includesAny(normalized, ["alto"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 14;
  }

  // 13. Soprano Saxophone
  if (
    includesAny(normalized, ["soprano"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 13;
  }

  // Generic sax (fallback)
  if (includesAny(normalized, ["sax", "saxofone"])) {
    return 13;
  }

  // Standalone (sax without the "sax" token)
  if (includesAny(normalized, ["soprano"])) {
    return 13;
  }

  if (
    includesAny(normalized, ["alto"]) &&
    !includesAny(normalized, ["trombone", "clarinet"])
  ) {
    return 14;
  }

  if (
    includesAny(normalized, ["tenor"]) &&
    !includesAny(normalized, ["trombone"])
  ) {
    return 15;
  }

  // 19. Contrabassoon
  if (includesAny(normalized, ["contrabassoon", "contrafagote"])) {
    return 19;
  }

  // 18. Bassoon
  if (includesAny(normalized, ["bassoon", "fagote"])) {
    return 18;
  }

  // ════════════ BRASS ════════════

  // 21. Wagner Tuba
  if (includesAny(normalized, ["wagner"])) {
    return 21;
  }

  // 30. Euphonium / Baritone Horn
  // Must be checked before generic Horn to avoid confusion
  if (includesAny(normalized, ["euphoni", "eufoni", "baritone", "baritono"])) {
    return 30;
  }

  // 26. Flugelhorn
  // Must be checked before generic Horn to avoid "flugelhorn" matching "horn"
  if (includesAny(normalized, ["flugel", "fliscorno"])) {
    return 26;
  }

  // 20. Horn (French Horn)
  if (
    includesAny(normalized, ["trompa", "horn"]) &&
    !includesAny(normalized, ["baritone", "baritono", "euphoni", "eufoni"])
  ) {
    return 20;
  }

  // 22. Piccolo Trumpet
  if (
    includesAny(normalized, ["trumpet", "trompete"]) &&
    includesAny(normalized, ["picc"])
  ) {
    return 22;
  }

  // 24. Bass Trumpet
  if (
    includesAny(normalized, ["trumpet", "trompete"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 24;
  }

  // 23. Trumpet
  if (includesAny(normalized, ["trumpet", "trompete"])) {
    return 23;
  }

  // 25. Cornet (B♭)
  if (includesAny(normalized, ["cornet"])) {
    return 25;
  }

  // 27. Alto Trombone
  if (
    includesAny(normalized, ["trombone"]) &&
    includesAny(normalized, ["alto"])
  ) {
    return 27;
  }

  // 29. Bass Trombone
  if (
    includesAny(normalized, ["trombone"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 29;
  }

  // 28. Trombone
  if (includesAny(normalized, ["trombone"])) {
    return 28;
  }

  // 31. Tuba
  if (includesAny(normalized, ["tuba"])) {
    return 31;
  }

  // ════════════ PERCUSSION ════════════

  // 32. Timpani
  if (includesAny(normalized, ["timpan"])) {
    return 32;
  }

  // 33. Snare Drum
  if (includesAny(normalized, ["snare", "caixa"])) {
    return 33;
  }

  // 34. Bass Drum
  if (includesAny(normalized, ["bumbo", "bombo"]) || normalized.includes("bass drum")) {
    return 34;
  }

  // 35. Tom-tom (single drum)
  if (normalized.includes("tom tom")) {
    return 35;
  }

  // 36. Drum set
  if (includesAny(normalized, ["bateria", "drum"])) {
    return 36;
  }

  // 37. Bongos
  if (includesAny(normalized, ["bongo"])) {
    return 37;
  }

  // 38. Congas
  if (includesAny(normalized, ["conga"])) {
    return 38;
  }

  // 39. Cymbals (crash & ride)
  if (includesAny(normalized, ["cymbal", "prato"])) {
    return 39;
  }

  // 40. Triangle
  if (includesAny(normalized, ["tria", "triâ", "triangle"])) {
    return 40;
  }

  // 41. Tambourine
  if (includesAny(normalized, ["tambourine", "pandeiro"])) {
    return 41;
  }

  // 42. Tambour (frame drum)
  if (includesAny(normalized, ["adufe", "tambour"])) {
    return 42;
  }

  // 44. Sleigh bells
  if (
    includesAny(normalized, ["sleigh"]) ||
    (includesAny(normalized, ["sino"]) && includesAny(normalized, ["tren"]))
  ) {
    return 44;
  }

  // 43. Handbells
  if (
    includesAny(normalized, ["handbell", "hand"]) ||
    (includesAny(normalized, ["sino"]) && includesAny(normalized, ["mao"]))
  ) {
    return 43;
  }

  // 45. Castanets
  if (includesAny(normalized, ["castanhola", "castanet"])) {
    return 45;
  }

  // 46. Wood block
  if (includesAny(normalized, ["wood"])) {
    return 46;
  }

  // 47. Temple blocks
  if (includesAny(normalized, ["temple"])) {
    return 47;
  }

  // 48. Maracas
  if (includesAny(normalized, ["maraca"])) {
    return 48;
  }

  // 49. Tam-tam (gong)
  if (includesAny(normalized, ["gong"]) || normalized.includes("tam tam")) {
    return 49;
  }

  // 50. Crotales
  if (includesAny(normalized, ["crotal"])) {
    return 50;
  }

  // 51. Glockenspiel
  if (includesAny(normalized, ["glo", "glocken", "sininho"])) {
    return 51;
  }

  // 52. Xylophone
  if (includesAny(normalized, ["xyl"])) {
    return 52;
  }

  // 53. Marimba
  if (includesAny(normalized, ["marimba", "mari"])) {
    return 53;
  }

  // 54. Vibraphone
  if (includesAny(normalized, ["vibra"])) {
    return 54;
  }

  // 55. Tubular bells
  if (
    includesAny(normalized, ["chime", "carri", "tubular"]) ||
    (includesAny(normalized, ["sino"]) && includesAny(normalized, ["tubu"]))
  ) {
    return 55;
  }

  // Fallback timpani (generic "tim"/"tím")
  if (includesAny(normalized, ["tím", "tim"])) {
    return 32;
  }

  // Catch-all percussion
  if (includesAny(normalized, ["percu"])) {
    return 32;
  }

  // ════════════ KEYBOARDS ════════════

  // 56. Celesta
  if (includesAny(normalized, ["celesta"])) {
    return 56;
  }

  // 57. Piano
  if (includesAny(normalized, ["piano"])) {
    return 57;
  }

  // 58. Harpsichord
  if (includesAny(normalized, ["harps", "cravo"])) {
    return 58;
  }

  // 59. Pipe organ
  if (includesAny(normalized, ["órg", "org"])) {
    return 59;
  }

  // 60. Accordion
  if (includesAny(normalized, ["accor", "acor", "sanfona"])) {
    return 60;
  }

  // ════════════ HARP ════════════

  // 61. Harp

  if (includesAny(normalized, ["harpa", "harp"])) {
    return 61;
  }

  // ════════════ BOWED STRINGS ════════════

  // 62. Violin
  if (includesAny(normalized, ["violi"])) {
    return 62;
  }

  // 63. Viola
  if (includesAny(normalized, ["viola"])) {
    return 63;
  }

  // 64. Cello (violoncello)
  if (includesAny(normalized, ["cello", "violoncello", "celo"])) {
    return 64;
  }

  // 65. Double bass / Contrabass
  if (includesAny(normalized, ["contrabass", "double", "contrabaixo"])) {
    return 65;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function compareInstrumentNames(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const rankA = getInstrumentRank(a);
  const rankB = getInstrumentRank(b);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  const normalizedA = normalizeText(a ?? "");
  const normalizedB = normalizeText(b ?? "");

  return normalizedA.localeCompare(normalizedB, "pt-BR");
}
