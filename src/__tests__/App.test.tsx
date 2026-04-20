import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkForUpdates: vi.fn(() => new Promise(() => {})),
  installUpdate: vi.fn(),
  restoreMainWindow: vi.fn(),
}));

vi.mock("../api/commands", () => ({
  checkForUpdates: mocks.checkForUpdates,
  installUpdate: mocks.installUpdate,
}));

vi.mock("../utils/window", () => ({
  restoreMainWindow: mocks.restoreMainWindow,
}));

import App from "../App";

describe("App startup", () => {
  it("restores the window when the app boots", () => {
    render(<App />);

    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.restoreMainWindow).toHaveBeenCalledTimes(1);
  });
});
