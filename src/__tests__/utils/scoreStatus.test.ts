import { describe, expect, it } from "vitest";

import { getScoreStatusLabel, isScoreAvailableForClient, normalizeScoreStatus } from "../../utils/scoreStatus";

describe("scoreStatus", () => {
  it("treats only main scores as available on the client", () => {
    expect(isScoreAvailableForClient("main")).toBe(true);
    expect(isScoreAvailableForClient("draft")).toBe(false);
    expect(isScoreAvailableForClient("not_found")).toBe(false);
  });

  it("keeps the existing labels for status badges", () => {
    expect(normalizeScoreStatus("not_found")).toBe("draft");
    expect(getScoreStatusLabel("main")).toBe("Principal");
  });
});