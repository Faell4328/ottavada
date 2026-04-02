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

  it("accepts naming variations like 'in Bb'", () => {
    const names = ["clarinet Bb 2", "clarinet in Bb 1", "clarinet Bb 3"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["clarinet in Bb 1", "clarinet Bb 2", "clarinet Bb 3"]);
  });

  it("sorts unknown instruments alphabetically after known ones", () => {
    const names = ["zither", "oboe", "accordion", "xylophone"];
    const sorted = [...names].sort((a, b) => compareInstrumentNames(a, b));

    expect(sorted).toEqual(["oboe", "accordion", "xylophone", "zither"]);
  });
});
