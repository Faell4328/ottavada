import { describe, expect, it, vi } from "vitest";

const windowMocks = vi.hoisted(() => ({
  isMinimized: vi.fn(async () => true),
  isMaximized: vi.fn(async () => true),
  show: vi.fn(async () => undefined),
  unminimize: vi.fn(async () => undefined),
  unmaximize: vi.fn(async () => undefined),
  maximize: vi.fn(async () => undefined),
  setFocus: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => windowMocks),
}));

import { restoreMainWindow } from "../../utils/window";

describe("restoreMainWindow", () => {
  it("restores the window state before focusing it", async () => {
    await restoreMainWindow();

    expect(windowMocks.isMinimized).toHaveBeenCalledTimes(1);
    expect(windowMocks.isMaximized).toHaveBeenCalledTimes(1);
    expect(windowMocks.show).toHaveBeenCalledTimes(1);
    expect(windowMocks.unminimize).toHaveBeenCalledTimes(1);
    expect(windowMocks.unmaximize).toHaveBeenCalledTimes(1);
    expect(windowMocks.maximize).toHaveBeenCalledTimes(1);
    expect(windowMocks.setFocus).toHaveBeenCalledTimes(1);
  });
});