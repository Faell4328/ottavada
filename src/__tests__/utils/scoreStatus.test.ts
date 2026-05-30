import { describe, expect, it } from "vitest";

import { getScoreStatusLabel, normalizeScoreStatus } from "../../utils/scoreStatus";

describe("scoreStatus", () => {
  it("keeps the current labels for status badges", () => {
    expect(normalizeScoreStatus("draft")).toBe("draft");
    expect(normalizeScoreStatus("ignored")).toBe("ignored");
    expect(normalizeScoreStatus("main")).toBe("main");
    expect(getScoreStatusLabel("main")).toBe("Principal");
    expect(getScoreStatusLabel("ignored")).toBe("Ignorada");
  });
});