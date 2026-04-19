import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../api/commands";
import { useAppBootstrap } from "../../context/useAppBootstrap";
import { initialState, type Action } from "../../context/reducer";
import type { AppSettings } from "../../types";

vi.mock("../../api/commands", () => ({
  getSettings: vi.fn(),
  isFirstRun: vi.fn(),
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
}: {
  state: typeof initialState;
  dispatch: (action: Action) => void;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
}) {
  useAppBootstrap({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
  });

  return null;
}

describe("useAppBootstrap", () => {
  beforeEach(() => {
    vi.mocked(api.isFirstRun).mockResolvedValue(false);
    vi.mocked(api.getSettings).mockResolvedValue(clientSettings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs the client startup check before loading songs and categories", async () => {
    const loadSongs: () => Promise<void> = vi.fn().mockResolvedValue(undefined);
    const loadCategories: () => Promise<void> = vi.fn().mockResolvedValue(undefined);
    const loadSettings: () => Promise<void> = vi.fn().mockResolvedValue(undefined);
    const dispatch: (action: Action) => void = vi.fn();

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
      />
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(api.isFirstRun).toHaveBeenCalledTimes(1);
    expect(api.getSettings).toHaveBeenCalledTimes(1);
    expect(loadSongs).not.toHaveBeenCalled();
    expect(loadCategories).not.toHaveBeenCalled();
  });
});
