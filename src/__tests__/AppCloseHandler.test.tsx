import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import i18n, { changeLanguage } from "../i18n";

const mocks = vi.hoisted(() => ({
  hasPendingChanges: vi.fn(),
  exitApplication: vi.fn(),
  checkForUpdates: vi.fn(() => Promise.resolve()),
  installUpdate: vi.fn(),
  getCurrentWindow: vi.fn(),
}));

let closeListener: ((event: { preventDefault: () => void }) => void) | null = null;

const windowMocks = {
  onCloseRequested: vi.fn((cb: (event: { preventDefault: () => void }) => void) => {
    closeListener = cb;
    return () => {
      closeListener = null;
    };
  }),
};

mocks.getCurrentWindow.mockReturnValue(windowMocks);

vi.mock("../api/commands", () => ({
  hasPendingChanges: mocks.hasPendingChanges,
  exitApplication: mocks.exitApplication,
  checkForUpdates: mocks.checkForUpdates,
  installUpdate: mocks.installUpdate,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

import { AppContent } from "../App";
import { AppProvider } from "../context/AppContext";

function renderApp() {
  return render(
    <AppProvider disableBootstrap>
      <AppContent startupUpdate={null} />
    </AppProvider>
  );
}

describe("App close handler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    closeListener = null;
    await i18n.changeLanguage("pt");
  });

  it("registers the close listener exactly once", async () => {
    renderApp();
    await waitFor(() => expect(windowMocks.onCloseRequested).toHaveBeenCalledTimes(1));
  });

  it("uses the current language for pending-changes message", async () => {
    mocks.hasPendingChanges.mockResolvedValue(true);

    renderApp();
    await waitFor(() => expect(closeListener).not.toBeNull());

    act(() => {
      closeListener?.({ preventDefault: vi.fn() });
    });
    await waitFor(() =>
      expect(
        screen.getByText("Há alterações pendentes para aplicar. Deseja sair mesmo assim?")
      ).toBeInTheDocument()
    );

    await act(async () => {
      await changeLanguage("en");
    });

    act(() => {
      closeListener?.({ preventDefault: vi.fn() });
    });
    await waitFor(() =>
      expect(
        screen.getByText("There are pending changes to apply. Do you still want to exit?")
      ).toBeInTheDocument()
    );
  });

  it("does not call exitApplication while pending changes exist", async () => {
    mocks.hasPendingChanges.mockResolvedValue(true);

    renderApp();
    await waitFor(() => expect(closeListener).not.toBeNull());

    act(() => {
      closeListener?.({ preventDefault: vi.fn() });
    });
    await waitFor(() => expect(screen.getByText("Sair do aplicativo?")).toBeInTheDocument());

    expect(mocks.exitApplication).not.toHaveBeenCalled();
  });

  it("calls exitApplication when there are no pending changes", async () => {
    mocks.hasPendingChanges.mockResolvedValue(false);

    renderApp();
    await waitFor(() => expect(closeListener).not.toBeNull());

    act(() => {
      closeListener?.({ preventDefault: vi.fn() });
    });

    await waitFor(() => expect(mocks.exitApplication).toHaveBeenCalledTimes(1));
  });
});
