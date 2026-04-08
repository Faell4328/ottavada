import { describe, expect, it } from "vitest";
import { compareInstrumentNames } from "../../utils/instrumentOrder";

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
      "clarinet in Bb 1",
      "clarinet Bb 3",
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

    expect(sorted).toEqual(["flauta 1", "fagote", "saxofone tenor", "violino 1"]);
  });

  it("accepts naming variations like 'in Bb'", () => {
    const names = ["clarinet Bb 2", "clarinet in Bb 1", "clarinet Bb 3"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["clarinet in Bb 1", "clarinet Bb 2", "clarinet Bb 3"]);
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
      "Trumpet Bb 1",
      "Horn in F II",
      "Trombone III",
      "Violino I",
      "Violin II",
      "Contrabass",
    ]);
  });

  it("sorts unknown instruments alphabetically after known ones", () => {
    const names = ["zither", "oboe", "accordion", "Bass Guitar", "xylophone"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["oboe", "accordion", "Bass Guitar", "xylophone", "zither"]);
  });
});
