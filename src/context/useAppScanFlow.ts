import { useCallback, useEffect, useRef, type Dispatch } from "react";
import toast from "../utils/toast";
import i18n from "../i18n";

import * as api from "../api/commands";
import type { Action } from "./reducer";
import { runClientSyncFlow } from "./clientSyncFlow";
import type { RunSyncWithProgressOptions } from "./clientSyncFlow";
import type { RcloneProgressSnapshot } from "../utils/rcloneProgress";
import { shouldDispatchRcloneProgressUpdate } from "../utils/rcloneProgress";

const t = i18n.t.bind(i18n);

interface UseAppScanFlowParams {
  dispatch: Dispatch<Action>;
  computerType: "Server" | "Client" | undefined;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  refreshSelectedSong: () => Promise<void>;
  getErrorMessage: (err: unknown, fallback: string) => string;
}

type ScanFilesForChangesOptions =
  | boolean
  | {
      isAutomatic?: boolean;
      forceCloudSync?: boolean;
      snapshotSummary?: api.SnapshotFileSummary | null;
      rethrowOnError?: boolean;
      overrides?: api.ScoreStatusOverride[];
    };

const SNAPSHOT_AUTO_THRESHOLD_BYTES = 1 * 1024 * 1024;

export function shouldRunStartupClientScan(
  computerType: "Server" | "Client" | undefined,
) {
  return computerType === "Client";
}

export function shouldUseFullCloudSync(params: {
  forceCloudSync: boolean;
  snapshotGenerated: boolean;
  eventsCount: number;
  hasPendingChanges: boolean;
  hasDetectedFileChanges: boolean;
}) {
  const {
    forceCloudSync,
    snapshotGenerated,
    eventsCount,
    hasPendingChanges,
    hasDetectedFileChanges,
  } = params;

  return (
    forceCloudSync ||
    snapshotGenerated ||
    eventsCount === 0 ||
    (!hasPendingChanges && !hasDetectedFileChanges)
  );
}

export function getScanFailureToastMessage(
  err: unknown,
  getErrorMessage: (err: unknown, fallback: string) => string,
  computerType: "Server" | "Client" | undefined,
  t: (key: string) => string,
) {
  const fallbackMessage =
    computerType === "Client"
      ? t("scanFlow.scanFailedClient")
      : t("scanFlow.scanFailedServer");

  return getErrorMessage(err, fallbackMessage);
}

export function useAppScanFlow({
  dispatch,
  computerType,
  loadSongs,
  loadCategories,
  loadSettings,
  refreshSelectedSong,
  getErrorMessage,
}: UseAppScanFlowParams) {
  const scanResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanInProgressRef = useRef(false);
  const lastRcloneProgressRef = useRef<RcloneProgressSnapshot | null>(null);

  const clearScanTimer = useCallback(() => {
    if (scanResetTimerRef.current !== null) {
      clearTimeout(scanResetTimerRef.current);
      scanResetTimerRef.current = null;
    }
  }, []);

  const resetScanState = useCallback(() => {
    dispatch({ type: "SET_SCANNING_FILES", payload: false });
    dispatch({ type: "RESET_RCLONE_PROGRESS" });
    dispatch({ type: "RESET_OPERATION_STATUS" });
    dispatch({
      type: "SET_SCAN_PROGRESS",
      payload: { total: 0, completed: 0, changedFiles: 0 },
    });
  }, [dispatch]);

  const scheduleScanReset = useCallback(
    (delayMs: number) => {
      clearScanTimer();
      scanResetTimerRef.current = setTimeout(() => {
        resetScanState();
        scanResetTimerRef.current = null;
      }, delayMs);
    },
    [clearScanTimer, resetScanState],
  );

  useEffect(() => {
    return () => {
      clearScanTimer();
    };
  }, [clearScanTimer]);

  const dispatchRcloneProgress = useCallback(
    (progress: RcloneProgressSnapshot) => {
      if (
        !shouldDispatchRcloneProgressUpdate(
          lastRcloneProgressRef.current,
          progress,
        )
      ) {
        return;
      }

      lastRcloneProgressRef.current = progress;
      dispatch({ type: "SET_RCLONE_PROGRESS", payload: progress });
    },
    [dispatch],
  );

  const runSyncWithProgress = useCallback(
    async ({
      direction,
      relativePath,
      lockInteraction = true,
    }: RunSyncWithProgressOptions) => {
      let stopPolling = false;
      lastRcloneProgressRef.current = null;
      const progressDirection = lockInteraction ? direction : null;

      dispatch({
        type: "SET_RCLONE_PROGRESS",
        payload: {
          active: true,
          direction: progressDirection,
          bytes: 0,
          totalBytes: null,
          percentage: null,
          speedBytesPerSec: 0,
          etaSeconds: null,
        },
      });

      const syncPromise = api.syncCloudWithRclone(direction, relativePath);

      const pollingPromise = (async () => {
        while (!stopPolling) {
          try {
            const stats = await api.getRcloneRcStats();
            if (stats) {
              dispatchRcloneProgress({
                active: stats.active,
                direction: progressDirection,
                bytes: Math.max(stats.bytes, 0),
                totalBytes: stats.total_bytes,
                percentage:
                  stats.percentage !== null
                    ? Math.round(stats.percentage)
                    : null,
                speedBytesPerSec: stats.speed_bytes_per_sec,
                etaSeconds: stats.eta_seconds,
              });
            }
          } catch {
            // Ignore transient RC polling errors.
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      })();

      try {
        return await syncPromise;
      } finally {
        stopPolling = true;
        lastRcloneProgressRef.current = null;
        dispatch({ type: "RESET_RCLONE_PROGRESS" });
        void pollingPromise.catch(() => undefined);
      }
    },
    [dispatch, dispatchRcloneProgress],
  );

  const runSelectiveUploadWithProgress = useCallback(
    async (relativePaths: string[]) => {
      let stopPolling = false;
      lastRcloneProgressRef.current = null;

      dispatch({
        type: "SET_RCLONE_PROGRESS",
        payload: {
          active: true,
          direction: "upload",
          bytes: 0,
          totalBytes: null,
          percentage: null,
          speedBytesPerSec: 0,
          etaSeconds: null,
        },
      });

      const uploadPromise = api.uploadCloudPathsWithRclone(relativePaths);

      const pollingPromise = (async () => {
        while (!stopPolling) {
          try {
            const stats = await api.getRcloneRcStats();
            if (stats) {
              dispatchRcloneProgress({
                active: stats.active,
                direction: "upload",
                bytes: Math.max(stats.bytes, 0),
                totalBytes: stats.total_bytes,
                percentage:
                  stats.percentage !== null
                    ? Math.round(stats.percentage)
                    : null,
                speedBytesPerSec: stats.speed_bytes_per_sec,
                etaSeconds: stats.eta_seconds,
              });
            }
          } catch {
            // Ignore transient RC polling errors.
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      })();

      try {
        return await uploadPromise;
      } finally {
        stopPolling = true;
        lastRcloneProgressRef.current = null;
        dispatch({ type: "RESET_RCLONE_PROGRESS" });
        void pollingPromise.catch(() => undefined);
      }
    },
    [dispatch, dispatchRcloneProgress],
  );

  const previewScanFilesForChanges = useCallback(async () => {
    if (scanInProgressRef.current) {
      toast.error(t("scanFlow.operationInProgress"));
      return;
    }

    scanInProgressRef.current = true;
    dispatch({ type: "RESET_SCAN_REPORT" });

    try {
      clearScanTimer();
      dispatch({ type: "SET_SCANNING_FILES", payload: true });
      dispatch({
        type: "SET_OPERATION_STATUS",
        payload: {
          title: t("scanFlow.step1Verifying"),
          detail: t("scanFlow.generatingReport"),
          stepCurrent: 1,
          stepTotal: 1,
        },
      });
      dispatch({
        type: "SET_SCAN_PROGRESS",
        payload: { total: 1, completed: 0, changedFiles: 0 },
      });

      const result = await api.previewScanFilesForChanges();
      dispatch({ type: "SET_SCAN_REPORT", payload: result });
      resetScanState();
    } catch (err) {
      console.error("Failed to preview files for changes:", err);
      toast.error(
        getScanFailureToastMessage(err, getErrorMessage, computerType, t),
      );
      resetScanState();
    } finally {
      scanInProgressRef.current = false;
    }
  }, [clearScanTimer, computerType, dispatch, getErrorMessage, resetScanState]);

  const scanFilesForChanges = useCallback(
    async (options: ScanFilesForChangesOptions = false) => {
      const isAutomatic =
        typeof options === "boolean" ? options : (options.isAutomatic ?? false);
      const forceCloudSync =
        typeof options === "boolean"
          ? false
          : (options.forceCloudSync ?? false);
      const preGeneratedSnapshotSummary =
        typeof options === "boolean" ? null : (options.snapshotSummary ?? null);
      const rethrowOnError =
        typeof options === "boolean"
          ? false
          : (options.rethrowOnError ?? false);
      const overrides =
        typeof options === "boolean"
          ? []
          : (options.overrides ?? []);

      if (scanInProgressRef.current) {
        if (!isAutomatic) {
          toast.error(t("scanFlow.operationInProgress"));
        }
        return;
      }

      scanInProgressRef.current = true;

      try {
        clearScanTimer();

        const hasInternet = await api.hasInternetConnection();
        if (!hasInternet) {
          if (!isAutomatic) {
            toast.error(t("scanFlow.noInternet"));
          }
          return;
        }

        const currentSettings = await api.getSettings();
        const isClient = currentSettings.computer_type === "Client";

        if (isClient) {
          await runClientSyncFlow({
            isAutomatic,
            deps: {
              dispatch,
              runSyncWithProgress,
              resetScanState,
              loadSongs,
              loadCategories,
              loadSettings,
              refreshSelectedSong,
              scheduleScanReset,
            },
          });
          return;
        }

        dispatch({ type: "SET_SCANNING_FILES", payload: true });
        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: t("scanFlow.step1Starting"),
            detail: t("scanFlow.preparingSync"),
            stepCurrent: 1,
            stepTotal: 1,
          },
        });
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: { total: 0, completed: 0, changedFiles: 0 },
        });

        const baseSteps = 1;
        let completedSteps = 0;
        let currentTotalSteps = baseSteps;
        const updateStepProgress = (changedFiles: number) => {
          dispatch({
            type: "SET_SCAN_PROGRESS",
            payload: {
              total: currentTotalSteps,
              completed: completedSteps,
              changedFiles,
            },
          });
        };

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: t("scanFlow.step1Verifying"),
            detail: t("scanFlow.comparingLocalFiles"),
            stepCurrent: 1,
            stepTotal: currentTotalSteps,
          },
        });
        updateStepProgress(0);
        const result = await api.scanFilesForChanges({
          applyMissingDeletions: forceCloudSync,
          overrides,
        });
        completedSteps += 1;

        const changedCount = result.changed_files.length;
        const addedCount = result.added_files.length;
        const failedCount = result.failed_files.length;
        const recoveredCount = result.recovered_files?.length ?? 0;
        const deletedCount = result.deleted_files?.length ?? 0;
        const reportItemsCount = result.report_items?.length ?? 0;

        const hasPendingChanges = await api.hasPendingChanges();
        const hasDetectedFileChanges =
          changedCount > 0 ||
          addedCount > 0 ||
          recoveredCount > 0 ||
          deletedCount > 0 ||
          reportItemsCount > 0;

        if (!forceCloudSync && !hasPendingChanges && !hasDetectedFileChanges) {
          resetScanState();
          return;
        }

        currentTotalSteps = 4;
        updateStepProgress(reportItemsCount || changedCount);

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: t("scanFlow.savingChanges"),
            detail: t("scanFlow.generatingArchives"),
            stepCurrent: 2,
            stepTotal: currentTotalSteps,
          },
        });
        const archiveSummary = await api.generateSongArchivesFiles();
        completedSteps += 1;

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: t("scanFlow.step3GeneratingEvents"),
            detail: t("scanFlow.updatingEvents"),
            stepCurrent: 3,
            stepTotal: currentTotalSteps,
          },
        });
        const eventsSummary = await api.generateEventsFile();
        completedSteps += 1;
        const failedArchives = archiveSummary.failed ?? 0;
        updateStepProgress(changedCount);

        let snapshotGenerated = false;
        let snapshotSummary: api.SnapshotFileSummary | null = null;

        if (eventsSummary.payload_size >= SNAPSHOT_AUTO_THRESHOLD_BYTES) {
          currentTotalSteps = 6;
          updateStepProgress(changedCount);
          dispatch({
            type: "SET_OPERATION_STATUS",
            payload: {
              title: t("scanFlow.step4GeneratingSnapshot"),
              detail: t("scanFlow.eventsReached2MB"),
              stepCurrent: 4,
              stepTotal: currentTotalSteps,
            },
          });
          snapshotSummary = await api.generateSnapshotFile(false);
          snapshotGenerated = true;
          completedSteps += 1;
          updateStepProgress(changedCount);

          if (!isAutomatic) {
            toast(t("scanFlow.snapshotGenerated"), {
              icon: "✔️",
            });
          }
        }

        const backupStep = snapshotGenerated ? 5 : 4;
        currentTotalSteps = snapshotGenerated ? 6 : 5;
        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: t("scanFlow.stepGeneratingBackup", { step: backupStep }),
            detail: t("scanFlow.generatingAutomaticBackup"),
            stepCurrent: backupStep,
            stepTotal: currentTotalSteps,
          },
        });
        updateStepProgress(changedCount);
        const backupSummary = await api.forceGenerateBackupCloudFile();
        completedSteps += 1;
        updateStepProgress(changedCount);

        if (backupSummary && !isAutomatic) {
          try {
            await loadSettings();
          } catch (loadSettingsError) {
            console.error(
              "Failed to refresh settings after automatic backup:",
              loadSettingsError,
            );
          }
        }

        const uploadStep = snapshotGenerated ? 6 : 5;
        const hasDatabaseChanges = eventsSummary.events_count > 0;

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: t("scanFlow.stepUploadToCloud", { step: uploadStep }),
            detail:
              hasPendingChanges || hasDetectedFileChanges || forceCloudSync
                ? hasDatabaseChanges && !hasDetectedFileChanges
                  ? t("scanFlow.uploadingDatabaseChanges")
                  : t("scanFlow.uploadingChangedFiles")
                : t("scanFlow.validatingCloudSync"),
            stepCurrent: uploadStep,
            stepTotal: currentTotalSteps,
          },
        });

        const shouldUseFullSync =
          forceCloudSync ||
          (!isAutomatic &&
            shouldUseFullCloudSync({
              forceCloudSync,
              snapshotGenerated,
              eventsCount: eventsSummary.events_count,
              hasPendingChanges,
              hasDetectedFileChanges,
            }));

        let applyChangesMarked = false;

        if (shouldUseFullSync) {
          await api.markServerApplyChangesInProgress();
          applyChangesMarked = true;

          if (snapshotGenerated) {
            let uploadError: unknown = null;

            for (let attempt = 1; attempt <= 2; attempt += 1) {
              try {
                await runSyncWithProgress({ direction: "upload" });
                uploadError = null;
                break;
              } catch (error) {
                uploadError = error;
                if (attempt === 1 && !isAutomatic) {
                  toast(t("scanFlow.uploadFailedRetry"), {
                    icon: "⚠️",
                  });
                }
              }
            }

            if (uploadError) {
              throw uploadError;
            }
          } else {
            await runSyncWithProgress({ direction: "upload" });
          }
        } else {
          const uploadPaths: string[] = [];

          const addUploadPath = (relativePath: string) => {
            if (!uploadPaths.includes(relativePath)) {
              uploadPaths.push(relativePath);
            }
          };

          if (snapshotGenerated || eventsSummary.events_count > 0) {
            addUploadPath("actions");
          }

          for (const archiveResult of archiveSummary.results ?? []) {
            if (archiveResult.generated && archiveResult.song_id) {
              addUploadPath(`songs/${archiveResult.song_id}.tar.zst`);
            }
          }

          if (uploadPaths.length === 0) {
            if (!isAutomatic) {
              await api.markServerApplyChangesInProgress();
              applyChangesMarked = true;
              await runSyncWithProgress({ direction: "upload" });
            }
          } else {
            await api.markServerApplyChangesInProgress();
            applyChangesMarked = true;
            await runSelectiveUploadWithProgress(uploadPaths);
          }
        }

        completedSteps += 1;
        updateStepProgress(changedCount);

        const appliedSnapshotSummary =
          snapshotSummary ?? preGeneratedSnapshotSummary;

        if (appliedSnapshotSummary) {
          await api.markSnapshotAsUploaded(
            appliedSnapshotSummary.generated_at,
            appliedSnapshotSummary.last_change_timestamp,
          );
        } else {
          await api.markLocalChangesAsApplied();
        }
        if (applyChangesMarked) {
          await api.clearServerApplyChangesInProgress();
        }
        await loadSettings();
        updateStepProgress(changedCount);

        if (failedCount > 0 && !isAutomatic) {
          toast.error(t("scanFlow.filesNotVerified", { count: failedCount }));
        }

        if (!isAutomatic && failedArchives > 0) {
          toast.error(t("scanFlow.scoresNotCompressed", { count: failedArchives }));
        }

        if (!isAutomatic && failedCount === 0 && failedArchives === 0) {
          toast.success(t("scanFlow.changesSent"));
        }

        if (
          changedCount > 0 ||
          recoveredCount > 0 ||
          deletedCount > 0 ||
          (result.report_items?.length ?? 0) > 0
        ) {
          await loadSongs();
        }

        await refreshSelectedSong();

        const delay = 1000;
        scheduleScanReset(delay);
      } catch (err) {
        console.error("Failed to scan files for changes:", err);
        if (!isAutomatic) {
          toast.error(
        getScanFailureToastMessage(err, getErrorMessage, computerType, t),
          );
        }
        clearScanTimer();
        resetScanState();
        if (rethrowOnError) {
          throw err;
        }
      } finally {
        scanInProgressRef.current = false;
      }
    },
    [
      clearScanTimer,
      dispatch,
      getErrorMessage,
      loadCategories,
      loadSongs,
      loadSettings,
      resetScanState,
      refreshSelectedSong,
      runSelectiveUploadWithProgress,
      runSyncWithProgress,
      scheduleScanReset,
    ],
  );

  return { previewScanFilesForChanges, scanFilesForChanges, runSyncWithProgress };
}
