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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the startup screen", () => {
    const { container } = render(<LoadingScreen />);
    const shell = container.firstElementChild;

    expect(shell).toHaveClass(
      "fixed",
      "inset-0",
      "z-9999",
      "flex",
      "h-screen",
      "w-screen",
      "items-center",
      "justify-center",
      "overflow-hidden"
    );
    expect(shell).toHaveClass("bg-linear-to-br");
    expect(container).toHaveTextContent("Carregando Score Maestro");
    expect(container).toHaveTextContent("Preparando a interface inicial");
    expect(container.querySelectorAll('img[src="/metronome1.avif"]').length).toBe(1);
    expect(container.querySelectorAll('img[src="/metronome2.avif"]').length).toBe(1);
  });

  it("finishes the startup gate after checking updates", async () => {
    const onReady = vi.fn();

    render(<StartupUpdateGate onReady={onReady} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(null);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("finishes the startup gate and passes an available update", async () => {
    const update = {
      current_version: "1.0.2",
      version: "1.0.3",
      date: null,
      body: "Nova versão",
    };
    vi.mocked(api.checkForUpdates).mockResolvedValue({
      configured: true,
      update,
    });

    const onReady = vi.fn();

    render(<StartupUpdateGate onReady={onReady} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(update);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("releases the startup gate after the update timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(api.checkForUpdates).mockImplementation(
      () =>
        new Promise(() => {})
    );

    const onReady = vi.fn();

    render(<StartupUpdateGate onReady={onReady} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
