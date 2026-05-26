import { describe, expect, it } from "vitest";

import {
  normalizeSelectedCategoryIds,
  toggleSelectedCategoryId,
} from "../../utils/categorySelection";

describe("categorySelection", () => {
  it("keeps default category when no real category is selected", () => {
    expect(normalizeSelectedCategoryIds([])).toEqual(["default-category"]);
    expect(normalizeSelectedCategoryIds(["default-category"])).toEqual(["default-category"]);
  });

  it("removes default category when any real category exists", () => {
    expect(
      normalizeSelectedCategoryIds(["default-category", "c1", "c1", "c2"])
    ).toEqual(["c1", "c2"]);
  });

  it("toggles category ids while preserving the default invariant", () => {
    expect(toggleSelectedCategoryId(["default-category"], "c1")).toEqual(["c1"]);
    expect(toggleSelectedCategoryId(["c1"], "c1")).toEqual(["default-category"]);
  });
});