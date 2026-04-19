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

    expect(shell).toHaveClass(
      "fixed",
      "inset-0",
      "z-[9999]",
      "flex",
      "h-screen",
      "w-screen",
      "items-center",
      "justify-center",
      "overflow-hidden"
    );
    expect(shell).toHaveClass("bg-gradient-to-br");
    expect(container).toHaveTextContent("Carregando Score Maestro");
    expect(container).toHaveTextContent("Preparando a interface inicial");
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
