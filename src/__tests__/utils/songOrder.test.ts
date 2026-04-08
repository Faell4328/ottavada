import { describe, expect, it } from "vitest";
import { compareSongNames } from "../../utils/songOrder";

describe("compareSongNames", () => {
  it("ignores accents and punctuation", () => {
    const names = ["ÁGUA", "A-GUA", "AGUA"];
    const sorted = [...names].sort((a, b) => compareSongNames(a, b));

    expect(sorted).toEqual(["ÁGUA", "A-GUA", "AGUA"]);
  });

  it("sorts songs with numbers naturally", () => {
    const names = ["HINO 10", "HINO 2", "HINO 1"];
    const sorted = [...names].sort((a, b) => compareSongNames(a, b));

    expect(sorted).toEqual(["HINO 1", "HINO 2", "HINO 10"]);
  });
});
