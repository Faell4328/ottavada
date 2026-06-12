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

  // ════════════ MADEIRA ════════════

  // 1. Flautim / Piccolo
  if (
    includesAny(normalized, ["picc", "piccolo", "flauti"]) &&
    !includesAny(normalized, ["trumpet", "trompete"])
  ) {
    return 1;
  }

  // 3. Flauta Alto / Alto Flute
  if (
    includesAny(normalized, ["alt"]) &&
    includesAny(normalized, ["flut", "flaut"])
  ) {
    return 3;
  }

  // 2. Flauta / Flute
  if (includesAny(normalized, ["flut", "flaut"])) {
    return 2;
  }

  // 5. Oboé d'Amore / Oboe d'Amore
  if (includesAny(normalized, ["obo"]) && includesAny(normalized, ["amo"])) {
    return 5;
  }

  // 4. Oboé / Oboe
  if (includesAny(normalized, ["obo"])) {
    return 4;
  }

  // 6. Corne Inglês / Cor Anglais
  if (
    includesAny(normalized, ["cor", "horn"]) &&
    includesAny(normalized, ["eng", "ing"])
  ) {
    return 6;
  }

  // 7. Heckelfone / Heckelphone
  if (includesAny(normalized, ["heckel"])) {
    return 7;
  }

  // 8. Clarinete Mib (Soprinho) / E♭ Clarinet
  if (
    includesAny(normalized, ["soprinho"]) ||
    (includesAny(normalized, ["clarinet"]) &&
      includesAny(normalized, ["mib", "eb"]))
  ) {
    return 8;
  }

  // 12. Clarinete Contrabaixo / Contrabass Clarinet
  if (
    includesAny(normalized, ["clarinet"]) &&
    includesAny(normalized, ["contrabass", "contrabaixo"])
  ) {
    return 12;
  }

  // 10. Clarinete Baixo / Bass Clarinet
  if (
    includesAny(normalized, ["clarinet"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 10;
  }

  // 11. Clarinete Contralto / Contralto Clarinet
  if (
    includesAny(normalized, ["clarinet"]) &&
    includesAny(normalized, ["contralto"])
  ) {
    return 11;
  }

  // 9. Clarinete (Sib/Lá) / Clarinet (B♭/A)
  if (includesAny(normalized, ["clarinet"])) {
    return 9;
  }

  // 17. Saxofone Baixo / Bass Saxophone
  if (
    includesAny(normalized, ["sax", "saxofone"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 17;
  }

  // 16. Saxofone Barítono / Baritone Saxophone
  if (
    includesAny(normalized, ["bari", "barí"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 16;
  }

  // 15. Saxofone Tenor / Tenor Saxophone
  if (
    includesAny(normalized, ["tenor"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 15;
  }

  // 14. Saxofone Alto / Alto Saxophone
  if (
    includesAny(normalized, ["alto"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 14;
  }

  // 13. Saxofone Soprano / Soprano Saxophone
  if (
    includesAny(normalized, ["soprano"]) &&
    includesAny(normalized, ["sax", "saxofone"])
  ) {
    return 13;
  }

  // Sax genérico (fallback)
  if (includesAny(normalized, ["sax", "saxofone"])) {
    return 13;
  }

  // Standalone (sax sem token "sax")
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

  // 19. Contrafagote / Contrabassoon
  if (includesAny(normalized, ["contrabassoon", "contrafagote"])) {
    return 19;
  }

  // 18. Fagote / Bassoon
  if (includesAny(normalized, ["bassoon", "fagote"])) {
    return 18;
  }

  // ════════════ METAIS ════════════

  // 21. Trompa Wagneriana / Wagner Tuba
  if (includesAny(normalized, ["wagner"])) {
    return 21;
  }

  // 30. Eufônio (Barítono) / Euphonium / Baritone Horn
  // Must be checked before generic Horn to avoid confusion
  if (includesAny(normalized, ["euphoni", "eufoni", "baritone", "baritono"])) {
    return 30;
  }

  // 26. Fliscorno / Flugelhorn
  // Must be checked before generic Horn to avoid "flugelhorn" matching "horn"
  if (includesAny(normalized, ["flugel", "fliscorno"])) {
    return 26;
  }

  // 20. Trompa (Trompa Francesa) / Horn (French Horn)
  if (
    includesAny(normalized, ["trompa", "horn"]) &&
    !includesAny(normalized, ["baritone", "baritono", "euphoni", "eufoni"])
  ) {
    return 20;
  }

  // 22. Trompete Piccolo / Piccolo Trumpet
  if (
    includesAny(normalized, ["trumpet", "trompete"]) &&
    includesAny(normalized, ["picc"])
  ) {
    return 22;
  }

  // 24. Trompete Baixo / Bass Trumpet
  if (
    includesAny(normalized, ["trumpet", "trompete"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 24;
  }

  // 23. Trompete / Trumpet
  if (includesAny(normalized, ["trumpet", "trompete"])) {
    return 23;
  }

  // 25. Cornetim / Cornet (B♭)
  if (includesAny(normalized, ["cornet"])) {
    return 25;
  }

  // 27. Trombone Alto / Alto Trombone
  if (
    includesAny(normalized, ["trombone"]) &&
    includesAny(normalized, ["alto"])
  ) {
    return 27;
  }

  // 29. Trombone Baixo / Bass Trombone
  if (
    includesAny(normalized, ["trombone"]) &&
    includesAny(normalized, ["bass", "baixo"])
  ) {
    return 29;
  }

  // 28. Trombone (Tenor) / Trombone
  if (includesAny(normalized, ["trombone"])) {
    return 28;
  }

  // 31. Tuba / Tuba
  if (includesAny(normalized, ["tuba"])) {
    return 31;
  }

  // ════════════ PERCUSSÃO ════════════

  // 32. Tímpanos / Timpani
  if (includesAny(normalized, ["timpan"])) {
    return 32;
  }

  // 33. Caixa Clara / Snare Drum
  if (includesAny(normalized, ["snare", "caixa"])) {
    return 33;
  }

  // 34. Bumbo / Bass Drum
  if (includesAny(normalized, ["bumbo", "bombo"]) || normalized.includes("bass drum")) {
    return 34;
  }

  // 35. Tom-tom / Tom-tom (single drum)
  if (normalized.includes("tom tom")) {
    return 35;
  }

  // 36. Bateria / Drum set
  if (includesAny(normalized, ["bateria", "drum"])) {
    return 36;
  }

  // 37. Bongôs / Bongos
  if (includesAny(normalized, ["bongo"])) {
    return 37;
  }

  // 38. Congas / Congas
  if (includesAny(normalized, ["conga"])) {
    return 38;
  }

  // 39. Pratos / Cymbals (crash & ride)
  if (includesAny(normalized, ["cymbal", "prato"])) {
    return 39;
  }

  // 40. Triângulo / Triangle
  if (includesAny(normalized, ["tria", "triâ", "triangle"])) {
    return 40;
  }

  // 41. Pandeiro / Tambourine
  if (includesAny(normalized, ["tambourine", "pandeiro"])) {
    return 41;
  }

  // 42. Adufe / Tambour (frame drum)
  if (includesAny(normalized, ["adufe", "tambour"])) {
    return 42;
  }

  // 44. Sinos de Trenó / Sleigh bells
  if (
    includesAny(normalized, ["sleigh"]) ||
    (includesAny(normalized, ["sino"]) && includesAny(normalized, ["tren"]))
  ) {
    return 44;
  }

  // 43. Sinos de Mão / Handbells
  if (
    includesAny(normalized, ["handbell", "hand"]) ||
    (includesAny(normalized, ["sino"]) && includesAny(normalized, ["mao"]))
  ) {
    return 43;
  }

  // 45. Castanholas / Castanets
  if (includesAny(normalized, ["castanhola", "castanet"])) {
    return 45;
  }

  // 46. Bloco de Madeira / Wood block
  if (includesAny(normalized, ["wood"])) {
    return 46;
  }

  // 47. Blocos de Templo / Temple blocks
  if (includesAny(normalized, ["temple"])) {
    return 47;
  }

  // 48. Maracas / Maracas
  if (includesAny(normalized, ["maraca"])) {
    return 48;
  }

  // 49. Tam-Tam (Gongo) / Tam-tam (gong)
  if (includesAny(normalized, ["gong"]) || normalized.includes("tam tam")) {
    return 49;
  }

  // 50. Crótalos / Crotales
  if (includesAny(normalized, ["crotal"])) {
    return 50;
  }

  // 51. Glockenspiel / Glockenspiel
  if (includesAny(normalized, ["glo", "glocken", "sininho"])) {
    return 51;
  }

  // 52. Xilofone / Xylophone
  if (includesAny(normalized, ["xyl"])) {
    return 52;
  }

  // 53. Marimba / Marimba
  if (includesAny(normalized, ["marimba", "mari"])) {
    return 53;
  }

  // 54. Vibrafone / Vibraphone
  if (includesAny(normalized, ["vibra"])) {
    return 54;
  }

  // 55. Sinos Tubulares / Tubular bells
  if (
    includesAny(normalized, ["chime", "carri", "tubular"]) ||
    (includesAny(normalized, ["sino"]) && includesAny(normalized, ["tubu"]))
  ) {
    return 55;
  }

  // Fallback timpani (genérico "tim"/"tím")
  if (includesAny(normalized, ["tím", "tim"])) {
    return 32;
  }

  // Catch-all percussão
  if (includesAny(normalized, ["percu"])) {
    return 32;
  }

  // ════════════ TECLADOS ════════════

  // 56. Celesta / Celesta
  if (includesAny(normalized, ["celesta"])) {
    return 56;
  }

  // 57. Piano / Piano
  if (includesAny(normalized, ["piano"])) {
    return 57;
  }

  // 58. Cravo / Harpsichord
  if (includesAny(normalized, ["harps", "cravo"])) {
    return 58;
  }

  // 59. Órgão de Tubos / Pipe organ
  if (includesAny(normalized, ["órg", "org"])) {
    return 59;
  }

  // 60. Acordeão / Accordion
  if (includesAny(normalized, ["accor", "acor", "sanfona"])) {
    return 60;
  }

  // ════════════ HARPA ════════════

  // 61. Harpa / Harp

  if (includesAny(normalized, ["harpa", "harp"])) {
    return 61;
  }

  // ════════════ CORDAS DE ARCO ════════════

  // 62. Violino / Violin
  if (includesAny(normalized, ["violi"])) {
    return 62;
  }

  // 63. Viola / Viola
  if (includesAny(normalized, ["viola"])) {
    return 63;
  }

  // 64. Violoncelo / Cello (violoncello)
  if (includesAny(normalized, ["cello", "violoncello", "celo"])) {
    return 64;
  }

  // 65. Contrabaixo / Double bass / Contrabass
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
