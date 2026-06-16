import { describe, expect, it } from "vitest";

import { getScoreStatusLabel, normalizeScoreStatus } from "../../utils/scoreStatus";

describe("scoreStatus", () => {
  it("keeps the current labels for status badges", () => {
    expect(normalizeScoreStatus("draft")).toBe("draft");
    expect(normalizeScoreStatus("ignored")).toBe("ignored");
    expect(normalizeScoreStatus("main")).toBe("main");
    expect(getScoreStatusLabel("main")).toBe("Envio permitido");
    expect(getScoreStatusLabel("ignored")).toBe("Ignorada");
    expect(getScoreStatusLabel("not_found")).toBe("Sem partitura");
  });
});