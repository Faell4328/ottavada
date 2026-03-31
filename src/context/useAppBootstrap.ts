import { useEffect, useRef, type Dispatch } from "react";

import * as api from "../api/commands";
import type { Action, State } from "./reducer";

interface UseAppBootstrapParams {
  state: State;
  dispatch: Dispatch<Action>;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export function useAppBootstrap({
  state,
  dispatch,
  loadSongs,
  loadCategories,
  loadSettings,
}: UseAppBootstrapParams) {
  const skipNextAutoSongReloadRef = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const firstRun = await api.isFirstRun();
        dispatch({ type: "SET_FIRST_RUN", payload: firstRun });

        if (!firstRun) {
          skipNextAutoSongReloadRef.current = true;
          await Promise.all([loadSongs(), loadCategories(), loadSettings()]);

          void (async () => {
            let attempts = 0;
            const maxAttempts = 60;

            while (attempts < maxAttempts) {
              const completed = await api.isInitialScanCompleted();
              if (completed) {
                await loadSongs();
                break;
              }

              attempts += 1;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          })();
        }
      } catch (err) {
        console.error("Failed to initialize app:", err);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.isFirstRun && !state.isLoading) {
      if (skipNextAutoSongReloadRef.current) {
        skipNextAutoSongReloadRef.current = false;
        return;
      }

      void loadSongs();
    }
  }, [state.sidebarView, state.searchQuery, state.isFirstRun, state.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
}
