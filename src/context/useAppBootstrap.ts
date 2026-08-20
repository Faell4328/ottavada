import { useEffect, useRef, type Dispatch } from "react";

import * as api from "../api/commands";
import type { Action, State } from "./reducer";
import { shouldRunStartupClientScan } from "./useAppScanFlow";

interface UseAppBootstrapParams {
  state: State;
  dispatch: Dispatch<Action>;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  startupScan?: () => Promise<void>;
  enabled?: boolean;
}

export function useAppBootstrap({
  state,
  dispatch,
  loadSongs,
  loadCategories,
  loadSettings,
  startupScan,
  enabled = true,
}: UseAppBootstrapParams) {
  const skipNextAutoSongReloadRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    void (async () => {
      try {
        const firstRun = await api.isFirstRun();
        dispatch({ type: "SET_FIRST_RUN", payload: firstRun });

        if (!firstRun) {
          skipNextAutoSongReloadRef.current = true;
          const currentSettings = await api.getSettings();
          await Promise.all([loadSongs(), loadCategories(), loadSettings()]);

          if (
            startupScan &&
            shouldRunStartupClientScan(currentSettings.computer_type)
          ) {
            void startupScan().catch((error) => {
              console.error("Failed to run startup scan:", error);
            });
          }
        }
      } catch (err) {
        console.error("Failed to initialize app:", err);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, [dispatch, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!state.isFirstRun && !state.isLoading) {
      if (skipNextAutoSongReloadRef.current) {
        skipNextAutoSongReloadRef.current = false;
        return;
      }

      void loadSongs();
    }
  }, [enabled, state.sidebarView, state.isFirstRun, state.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
}
