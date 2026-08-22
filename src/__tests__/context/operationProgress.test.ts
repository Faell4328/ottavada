import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/commands", () => ({
  getOperationProgress: vi.fn(),
}));

import * as api from "../../api/commands";
import { runOperationWithProgress } from "../../context/operationProgress";

describe("runOperationWithProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("polls progress and forwards active snapshots while the operation runs", async () => {
    vi.mocked(api.getOperationProgress)
      .mockResolvedValueOnce({ active: true, kind: "decompress", current: 1, total: 5 })
      .mockResolvedValue({ active: false, kind: null, current: 0, total: 0 });

    const onSnapshot = vi.fn();
    const result = await runOperationWithProgress({
      operation: () => Promise.resolve("done"),
      onSnapshot,
    });

    expect(result).toBe("done");
    expect(api.getOperationProgress).toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalledWith({
      active: true,
      kind: "decompress",
      current: 1,
      total: 5,
    });
  });

  it("does not forward inactive snapshots", async () => {
    vi.mocked(api.getOperationProgress).mockResolvedValue({
      active: false,
      kind: null,
      current: 0,
      total: 0,
    });

    const onSnapshot = vi.fn();
    await runOperationWithProgress({
      operation: () => Promise.resolve("done"),
      onSnapshot,
    });

    expect(onSnapshot).not.toHaveBeenCalled();
  });
});