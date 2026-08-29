import { describe, expect, it } from "vitest";
import {
  compareInstrumentNames,
  getInstrumentRank,
  getScoreBaseInstrumentName,
} from "../../utils/instrumentOrder";

describe("compareInstrumentNames", () => {
  it("prioritizes unnamed instruments first", () => {
    const names = ["flute", "", "oboe", null] as Array<string | null>;
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted[0]).toBe("");
    expect(sorted[1]).toBeNull();
    expect(sorted[2]).toBe("flute");
    expect(sorted[3]).toBe("oboe");
  });

  it("keeps score/grade names at the top with unnamed", () => {
    const names = ["violin 1", "grade", "score", "flute", "", "full score"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted.slice(0, 4)).toEqual(["", "full score", "grade", "score"]);
    expect(sorted[4]).toBe("flute");
    expect(sorted[5]).toBe("violin 1");
  });

  it("respects orchestral custom order for known instruments", () => {
    const names = [
      "trombone 2",
      "flute",
      "clarinet in Bb 1",
      "tuba",
      "violino 1",
      "alto saxophone 2",
      "clarinet Bb 3",
    ];

    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual([
      "flute",
      "clarinet Bb 3",
      "clarinet in Bb 1",
      "alto saxophone 2",
      "trombone 2",
      "tuba",
      "violino 1",
    ]);
  });

  it("matches by first instrument name (e.g., Flute 1)", () => {
    const names = ["violin 1", "flute 1", "oboe", "trombone 2"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["flute 1", "oboe", "trombone 2", "violin 1"]);
  });

  it("accepts Portuguese variants preserving the same order", () => {
    const names = ["fagote", "flauta 1", "saxofone tenor", "violino 1"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["flauta 1", "saxofone tenor", "fagote", "violino 1"]);
  });

  it("accepts naming variations like 'in Bb'", () => {
    const names = ["clarinet Bb 2", "clarinet in Bb 1", "clarinet Bb 3"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["clarinet Bb 2", "clarinet Bb 3", "clarinet in Bb 1"]);
  });

  it("supports violin with arabic and roman numerals", () => {
    const names = ["Violin II", "Violin I", "viola", "cello"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["Violin I", "Violin II", "viola", "cello"]);
  });

  it("keeps orchestra order with flexible/non-exact names", () => {
    const names = [
      "Horn in F II",
      "Trombone III",
      "Clarinet Sib 3",
      "Clarinet in Bb I",
      "Alto Saxophone 2",
      "Trumpet Bb 1",
      "Violino I",
      "Violin II",
      "Contrabass",
    ];

    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual([
      "Clarinet in Bb I",
      "Clarinet Sib 3",
      "Alto Saxophone 2",
      "Horn in F II",
      "Trumpet Bb 1",
      "Trombone III",
      "Violin II",
      "Violino I",
      "Contrabass",
    ]);
  });

  it("sorts unknown instruments alphabetically after known ones", () => {
    const names = ["zither", "oboe", "accordion", "Bass Guitar", "xylophone"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["oboe", "xylophone", "accordion", "Bass Guitar", "zither"]);
  });

  it("recognizes English instrument names", () => {
    expect(getInstrumentRank("piccolo")).toBe(1);
    expect(getInstrumentRank("flute")).toBe(2);
    expect(getInstrumentRank("alto flute")).toBe(3);
    expect(getInstrumentRank("oboe")).toBe(4);
    expect(getInstrumentRank("oboe d'amore")).toBe(5);
    expect(getInstrumentRank("english horn")).toBe(6);
    expect(getInstrumentRank("heckelphone")).toBe(7);
    expect(getInstrumentRank("Eb clarinet")).toBe(8);
    expect(getInstrumentRank("clarinet")).toBe(9);
    expect(getInstrumentRank("bass clarinet")).toBe(10);
    expect(getInstrumentRank("contralto clarinet")).toBe(11);
    expect(getInstrumentRank("contrabass clarinet")).toBe(12);
    expect(getInstrumentRank("soprano saxophone")).toBe(13);
    expect(getInstrumentRank("alto saxophone")).toBe(14);
    expect(getInstrumentRank("tenor saxophone")).toBe(15);
    expect(getInstrumentRank("baritone saxophone")).toBe(16);
    expect(getInstrumentRank("bass saxophone")).toBe(17);
    expect(getInstrumentRank("bassoon")).toBe(18);
    expect(getInstrumentRank("contrabassoon")).toBe(19);
    expect(getInstrumentRank("horn")).toBe(20);
    expect(getInstrumentRank("wagner tuba")).toBe(21);
    expect(getInstrumentRank("piccolo trumpet")).toBe(22);
    expect(getInstrumentRank("trumpet")).toBe(23);
    expect(getInstrumentRank("bass trumpet")).toBe(24);
    expect(getInstrumentRank("cornet")).toBe(25);
    expect(getInstrumentRank("flugelhorn")).toBe(26);
    expect(getInstrumentRank("alto trombone")).toBe(27);
    expect(getInstrumentRank("trombone")).toBe(28);
    expect(getInstrumentRank("bass trombone")).toBe(29);
    expect(getInstrumentRank("euphonium")).toBe(30);
    expect(getInstrumentRank("tuba")).toBe(31);
    expect(getInstrumentRank("timpani")).toBe(32);
    expect(getInstrumentRank("snare drum")).toBe(33);
    expect(getInstrumentRank("bass drum")).toBe(34);
    expect(getInstrumentRank("tom tom")).toBe(35);
    expect(getInstrumentRank("drum set")).toBe(36);
    expect(getInstrumentRank("bongos")).toBe(37);
    expect(getInstrumentRank("congas")).toBe(38);
    expect(getInstrumentRank("cymbals")).toBe(39);
    expect(getInstrumentRank("triangle")).toBe(40);
    expect(getInstrumentRank("tambourine")).toBe(41);
    expect(getInstrumentRank("tambour")).toBe(42);
    expect(getInstrumentRank("handbell")).toBe(43);
    expect(getInstrumentRank("sleigh bells")).toBe(44);
    expect(getInstrumentRank("castanets")).toBe(45);
    expect(getInstrumentRank("wood block")).toBe(46);
    expect(getInstrumentRank("temple blocks")).toBe(47);
    expect(getInstrumentRank("maracas")).toBe(48);
    expect(getInstrumentRank("gong")).toBe(49);
    expect(getInstrumentRank("crotales")).toBe(50);
    expect(getInstrumentRank("glockenspiel")).toBe(51);
    expect(getInstrumentRank("xylophone")).toBe(52);
    expect(getInstrumentRank("marimba")).toBe(53);
    expect(getInstrumentRank("vibraphone")).toBe(54);
    expect(getInstrumentRank("tubular bells")).toBe(55);
    expect(getInstrumentRank("celesta")).toBe(56);
    expect(getInstrumentRank("piano")).toBe(57);
    expect(getInstrumentRank("harpsichord")).toBe(58);
    expect(getInstrumentRank("pipe organ")).toBe(59);
    expect(getInstrumentRank("accordion")).toBe(60);
    expect(getInstrumentRank("harp")).toBe(61);
    expect(getInstrumentRank("violin")).toBe(62);
    expect(getInstrumentRank("viola")).toBe(63);
    expect(getInstrumentRank("cello")).toBe(64);
    expect(getInstrumentRank("violoncello")).toBe(64);
    expect(getInstrumentRank("double bass")).toBe(65);
    expect(getInstrumentRank("contrabass")).toBe(65);
  });

  it("maps baritone horn to euphonium rank (not french horn or sax)", () => {
    expect(getInstrumentRank("baritone horn")).toBe(30);
    expect(getInstrumentRank("baritone")).toBe(30);
    expect(getInstrumentRank("baritone saxophone")).toBe(16);
  });

  it("sorts english names in proper orchestral order", () => {
    const names = [
      "harp",
      "violin",
      "piccolo",
      "euphonium",
      "bass drum",
      "horn",
      "bass clarinet",
      "triangle",
    ];

    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual([
      "piccolo",
      "bass clarinet",
      "horn",
      "euphonium",
      "bass drum",
      "triangle",
      "harp",
      "violin",
    ]);
  });
});

describe("getScoreBaseInstrumentName", () => {
  it("strips roman numeral section markers", () => {
    expect(getScoreBaseInstrumentName("Flauta I")).toBe("Flauta");
    expect(getScoreBaseInstrumentName("Flauta II")).toBe("Flauta");
    expect(getScoreBaseInstrumentName("Trumpet III")).toBe("Trumpet");
  });

  it("strips arabic numeral section markers", () => {
    expect(getScoreBaseInstrumentName("Flauta 1")).toBe("Flauta");
    expect(getScoreBaseInstrumentName("Flauta 2")).toBe("Flauta");
    expect(getScoreBaseInstrumentName("Violino 1st")).toBe("Violino");
  });

  it("keeps names without a trailing section marker unchanged", () => {
    expect(getScoreBaseInstrumentName("Flauta Transversal")).toBe(
      "Flauta Transversal",
    );
    expect(getScoreBaseInstrumentName("Grade")).toBe("Grade");
  });

  it("returns empty for empty or null names", () => {
    expect(getScoreBaseInstrumentName(null)).toBe("");
    expect(getScoreBaseInstrumentName("")).toBe("");
    expect(getScoreBaseInstrumentName("   ")).toBe("");
  });
});
