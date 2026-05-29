import { describe, expect, it } from "vitest";

import { getScoreStatusLabel, normalizeScoreStatus } from "../../utils/scoreStatus";

describe("scoreStatus", () => {
  it("keeps the existing labels for status badges", () => {
    expect(normalizeScoreStatus("not_found")).toBe("draft");
    expect(normalizeScoreStatus("ignored")).toBe("ignored");
    expect(getScoreStatusLabel("main")).toBe("Principal");
    expect(getScoreStatusLabel("ignored")).toBe("Ignorada");
  });
});