import { describe, expect, it } from "vitest";
import {
  normalizeScoreNameForSave,
  normalizeScoreNameInput,
  normalizeSongNameForSave,
  normalizeSongNameInput,
} from "../../utils/nameFormat";

describe("nameFormat", () => {
  describe("song name", () => {
    it("uppercases on input", () => {
      expect(normalizeSongNameInput("HaLLeLujah")).toBe("HALLELUJAH");
    });

    it("trims and uppercases on save", () => {
      expect(normalizeSongNameForSave("  Amazing   Grace  ")).toBe("AMAZING GRACE");
    });
  });

  describe("score name", () => {
    it("removes only leading digits", () => {
      expect(normalizeScoreNameInput("0001 flute 1")).toBe("flute 1");
    });

    it("preserves digits that are not at the start", () => {
      expect(normalizeScoreNameInput("trumpet 3i")).toBe("trumpet 3i");
    });

    it("returns null when score name is empty after normalization", () => {
      expect(normalizeScoreNameForSave("0000")).toBeNull();
    });
  });
});
