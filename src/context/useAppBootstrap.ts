import { useEffect, useRef, type Dispatch } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import * as api from "../api/commands";
import type { Action, State } from "./reducer";
import { formatBackupTimestamp } from "../utils/formatters";
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
  const { t } = useTranslation();
  const skipNextAutoSongReloadRef = useRef(false);
  const automaticBackupStartedRef = useRef(false);

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

          if (
            !automaticBackupStartedRef.current &&
            currentSettings.computer_type === "Server" &&
            currentSettings.rclone_config
          ) {
            automaticBackupStartedRef.current = true;

            void (async () => {
              try {
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
                      t("autoBackup.generated", { timestamp: formatBackupTimestamp(backupSummary.generated_at) }),
                      {
                        duration: 8000,
                      }
                    );
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
