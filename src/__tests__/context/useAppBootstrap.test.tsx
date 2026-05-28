import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../api/commands";
import { useAppBootstrap } from "../../context/useAppBootstrap";
import { initialState, type Action } from "../../context/reducer";
import type { AppSettings } from "../../types";

vi.mock("../../api/commands", () => ({
  getSettings: vi.fn(),
  isFirstRun: vi.fn(),
  hasPendingChanges: vi.fn(),
  hasServerApplyChangesInProgress: vi.fn(),
}));

const clientSettings: AppSettings = {
  computer_id: "client-1",
  computer_name: "Cliente",
  organization_name: null,
  computer_type: "Client",
  google_drive_mode: "Local",
  first_run_completed: true,
  google_service_account: null,
  rclone_config: null,
};

function BootstrapHarness({
  state,
  dispatch,
  loadSongs,
  loadCategories,
  loadSettings,
  startupScan,
}: {
  state: typeof initialState;
  dispatch: (action: Action) => void;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  startupScan?: () => Promise<void>;
}) {
  useAppBootstrap({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
    startupScan,
  });

  return null;
}

describe("useAppBootstrap", () => {
  beforeEach(() => {
    vi.mocked(api.isFirstRun).mockResolvedValue(false);
    vi.mocked(api.getSettings).mockResolvedValue(clientSettings);
    vi.mocked(api.hasPendingChanges).mockResolvedValue(false);
    vi.mocked(api.hasServerApplyChangesInProgress).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("releases loading after the initial startup work and runs the scan in background", async () => {
    const loadSongs: () => Promise<void> = vi.fn().mockResolvedValue(undefined);
    const loadCategories: () => Promise<void> = vi.fn().mockResolvedValue(undefined);
    const loadSettings: () => Promise<void> = vi.fn().mockResolvedValue(undefined);
    const dispatch: (action: Action) => void = vi.fn();
    const startupScan = vi.fn(
      () => Promise.resolve(undefined)
    );

    render(
      <BootstrapHarness
        state={{
          ...initialState,
          isLoading: true,
          settings: null,
        }}
        dispatch={dispatch}
        loadSongs={loadSongs}
        loadCategories={loadCategories}
        loadSettings={loadSettings}
        startupScan={startupScan}
      />
    );

    await waitFor(() => expect(api.isFirstRun).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadSongs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadCategories).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(startupScan).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: "SET_LOADING", payload: false }));
  });
});
