import { act, render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { LoadingScreen, StartupUpdateGate } from "../../App";
import * as api from "../../api/commands";

vi.mock("../../api/commands", () => ({
  checkForUpdates: vi.fn(),
  installUpdate: vi.fn(),
}));

describe("startup loading screen", () => {
  beforeEach(() => {
    vi.mocked(api.checkForUpdates).mockResolvedValue({
      configured: true,
      update: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the startup screen", () => {
    const { container } = render(<LoadingScreen />);
    const shell = container.firstElementChild;

    expect(shell).toHaveClass("flex", "min-h-screen", "items-center", "justify-center");
    expect(shell).toHaveClass("bg-[#5d6d82]");
    expect(container).toHaveTextContent("Carregando...");
  });

  it("finishes the startup gate after checking updates", async () => {
    const onReady = vi.fn();

    render(<StartupUpdateGate onReady={onReady} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
