import { useEffect, useRef, type Dispatch } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import type { Action, State } from "./reducer";
import { formatBackupTimestamp } from "../utils/formatters";

interface UseAppBootstrapParams {
  state: State;
  dispatch: Dispatch<Action>;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

let automaticBackupStarted = false;

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

          if (!automaticBackupStarted) {
            automaticBackupStarted = true;

            void (async () => {
              try {
                const currentSettings = await api.getSettings();

                if (
                  currentSettings.computer_type === "Server" &&
                  currentSettings.rclone_config
                ) {
                  const backupSummary = await api.generateAutomaticBackupFile();
                  if (backupSummary) {
                    try {
                      await loadSettings();
                    } catch (loadSettingsError) {
                      console.error(
                        "Failed to refresh settings after automatic backup:",
                        loadSettingsError
                      );
                    }
                    toast.success(
                      `Backup automático gerado em ${formatBackupTimestamp(backupSummary.generated_at)}`,
                      {
                        duration: 8000,
                      }
                    );
                  }
                }
              } catch (backupError) {
                console.error("Failed to generate automatic backup:", backupError);
              }
            })();
          }
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
  }, [state.sidebarView, state.isFirstRun, state.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
}
