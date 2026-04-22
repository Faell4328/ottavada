import { useCallback, useEffect, useRef, type Dispatch } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import type { Action } from "./reducer";

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
    };

type RunSyncWithProgressOptions = {
  direction: "upload" | "download";
  relativePath?: string;
  lockInteraction?: boolean;
};

export interface RcloneProgressSnapshot {
  active: boolean;
  direction: "upload" | "download" | null;
  bytes: number;
  totalBytes: number | null;
  percentage: number | null;
  speedBytesPerSec: number;
  etaSeconds: number | null;
}

const SNAPSHOT_AUTO_THRESHOLD_BYTES = 2 * 1024 * 1024;

export function shouldRunStartupServerScan(
  computerType: "Server" | "Client" | undefined,
  hasPendingChanges: boolean,
  hasInterruptedApply: boolean
) {
  return computerType !== "Server" || hasPendingChanges || hasInterruptedApply;
}

function normalizeRcloneProgressForUi(progress: RcloneProgressSnapshot) {
  return {
    active: progress.active,
    direction: progress.direction,
    bytesBucket: Math.floor(Math.max(progress.bytes, 0) / 256_000),
    totalBytes: progress.totalBytes,
    percentageBucket: progress.percentage === null ? null : Math.floor(progress.percentage),
    speedBucket: Math.floor(Math.max(progress.speedBytesPerSec, 0) / 64_000),
    etaSeconds: progress.etaSeconds,
  };
}

export function shouldDispatchRcloneProgressUpdate(
  previous: RcloneProgressSnapshot | null,
  next: RcloneProgressSnapshot
) {
  if (previous === null) {
    return true;
  }

  const normalizedPrevious = normalizeRcloneProgressForUi(previous);
  const normalizedNext = normalizeRcloneProgressForUi(next);

  return Object.entries(normalizedPrevious).some(
    ([key, value]) => normalizedNext[key as keyof typeof normalizedNext] !== value
  );
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
  computerType: "Server" | "Client" | undefined
) {
  const fallbackMessage =
    computerType === "Client"
      ? "Não foi possível consultar as alterações."
      : "Não foi possível concluir a verificação.";

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

  const scheduleScanReset = useCallback((delayMs: number) => {
    clearScanTimer();
    scanResetTimerRef.current = setTimeout(() => {
      resetScanState();
      scanResetTimerRef.current = null;
    }, delayMs);
  }, [clearScanTimer, resetScanState]);

  useEffect(() => {
    return () => {
      clearScanTimer();
    };
  }, [clearScanTimer]);

  const dispatchRcloneProgress = useCallback((progress: RcloneProgressSnapshot) => {
    if (!shouldDispatchRcloneProgressUpdate(lastRcloneProgressRef.current, progress)) {
      return;
    }

    lastRcloneProgressRef.current = progress;
    dispatch({ type: "SET_RCLONE_PROGRESS", payload: progress });
  }, [dispatch]);

  const runSyncWithProgress = useCallback(async ({
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
              percentage: stats.percentage !== null ? Math.round(stats.percentage) : null,
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
  }, [dispatch, dispatchRcloneProgress]);

  const runSelectiveUploadWithProgress = useCallback(async (relativePaths: string[]) => {
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
              percentage: stats.percentage !== null ? Math.round(stats.percentage) : null,
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
  }, [dispatch, dispatchRcloneProgress]);

  const scanFilesForChanges = useCallback(async (options: ScanFilesForChangesOptions = false) => {
    const isAutomatic =
      typeof options === "boolean" ? options : (options.isAutomatic ?? false);
    const forceCloudSync =
      typeof options === "boolean" ? false : (options.forceCloudSync ?? false);
    const preGeneratedSnapshotSummary =
      typeof options === "boolean" ? null : (options.snapshotSummary ?? null);

    if (scanInProgressRef.current) {
      if (!isAutomatic) {
        toast.error("Já existe uma operação em andamento. Aguarde ela terminar.");
      }
      return;
    }

    scanInProgressRef.current = true;

    try {
      clearScanTimer();

      const hasInternet = await api.hasInternetConnection();
      if (!hasInternet) {
        if (!isAutomatic) {
          toast.error("Não foi possível acessar a internet. Verifique sua conexão e tente novamente.");
        }
        return;
      }

      const isClient = computerType === "Client";

      if (!isClient) {
        dispatch({ type: "SET_SCANNING_FILES", payload: true });
        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 1 - Iniciando verificação",
            detail: "Preparando fluxo de sincronização",
            stepCurrent: 1,
            stepTotal: 1,
          },
        });
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: { total: 0, completed: 0, changedFiles: 0 },
        });
      }

      if (isClient) {
        await runSyncWithProgress({
          direction: "download",
          relativePath: "actions",
          lockInteraction: false,
        });

        const hasPendingChanges = await api.hasPendingChanges();

        if (!hasPendingChanges) {
          return;
        }

        dispatch({
          type: "SET_SCANNING_FILES",
          payload: true,
        });
        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 2 - Baixando músicas",
            detail: "Atualizando arquivos locais do cliente",
            stepCurrent: 1,
            stepTotal: 1,
          },
        });

        await runSyncWithProgress({
          direction: "download",
          relativePath: "songs",
          lockInteraction: true,
        });

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 2 - Aplicando alterações",
            detail: "Atualizando banco local do cliente",
            stepCurrent: 1,
            stepTotal: 1,
          },
        });

        const syncSummary = await api.applyServerChangesOnClient();

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 2 - Atualizando interface",
            detail: "Recarregando músicas e partituras",
            stepCurrent: 1,
            stepTotal: 1,
          },
        });

        await Promise.all([loadSongs(), loadCategories(), loadSettings()]);
        await refreshSelectedSong();

        if (!isAutomatic && (syncSummary.snapshot_applied || syncSummary.events_applied > 0)) {
          toast.success("Alterações da nuvem aplicadas com sucesso.");
        }

        scheduleScanReset(1500);
        return;
      }

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
          title: "Etapa 1 - Verificando alterações",
          detail: "Comparando arquivos locais (servidor)",
          stepCurrent: 1,
          stepTotal: currentTotalSteps,
        },
      });
      updateStepProgress(0);
      const result = await api.scanFilesForChanges();
      completedSteps += 1;

      const changedCount = result.changed_files.length;
      const failedCount = result.failed_files.length;
      const recoveredCount = result.recovered_files?.length ?? 0;
      const notFoundCount = result.not_found_files?.length ?? 0;

      const hasPendingChanges = await api.hasPendingChanges();
      const hasDetectedFileChanges =
        changedCount > 0 || recoveredCount > 0 || notFoundCount > 0;

      if (!forceCloudSync && !hasPendingChanges && !hasDetectedFileChanges) {
        resetScanState();
        return;
      }

      // Fluxo base do servidor: verificar, compactar, gerar events e subir para a nuvem.
      // Snapshot adiciona uma etapa extra ao total.
      currentTotalSteps = 4;
      updateStepProgress(changedCount);

      dispatch({
        type: "SET_OPERATION_STATUS",
        payload: {
          title: "Salvando alterações",
          detail: "Gerando .tar.zst das músicas",
          stepCurrent: 2,
          stepTotal: currentTotalSteps,
        },
      });
      const archiveSummary = await api.generateSongArchivesFiles();
      completedSteps += 1;

      dispatch({
        type: "SET_OPERATION_STATUS",
        payload: {
          title: "Etapa 3 - Gerando eventos",
          detail: "Atualizando events.msgpack.zst",
          stepCurrent: 3,
          stepTotal: currentTotalSteps,
        },
      });
      const eventsSummary = await api.generateEventsFile();
      completedSteps += 1;
      const generatedArchives = archiveSummary.generated ?? 0;
      const failedArchives = archiveSummary.failed ?? 0;
      updateStepProgress(changedCount);

      let snapshotGenerated = false;
      let snapshotSummary: api.SnapshotFileSummary | null = null;

      if (eventsSummary.payload_size >= SNAPSHOT_AUTO_THRESHOLD_BYTES) {
        currentTotalSteps = 5;
        updateStepProgress(changedCount);
        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 4 - Gerando snapshot",
            detail: "Events atingiu 2MB",
            stepCurrent: 4,
            stepTotal: currentTotalSteps,
          },
        });
        snapshotSummary = await api.generateSnapshotFile(false);
        snapshotGenerated = true;
        completedSteps += 1;
        updateStepProgress(changedCount);

        if (!isAutomatic) {
          toast("Cópia de segurança gerada para manter o histórico organizado.", {
            icon: "📦",
          });
        }
      }

      const uploadStep = snapshotGenerated ? 5 : 4;
      const hasDatabaseChanges = eventsSummary.events_count > 0;

      dispatch({
        type: "SET_OPERATION_STATUS",
        payload: {
          title: `Etapa ${uploadStep} - Upload para nuvem`,
          detail: hasPendingChanges || hasDetectedFileChanges || forceCloudSync
            ? hasDatabaseChanges && !hasDetectedFileChanges
              ? "Enviando alterações do banco para a nuvem"
              : "Enviando arquivos alterados para a nuvem"
            : "Sem alterações locais, validando sincronização da nuvem",
          stepCurrent: uploadStep,
          stepTotal: currentTotalSteps,
        },
      });

      const shouldUseFullSync = forceCloudSync || (!isAutomatic && shouldUseFullCloudSync({
        forceCloudSync,
        snapshotGenerated,
        eventsCount: eventsSummary.events_count,
        hasPendingChanges,
        hasDetectedFileChanges,
      }));

      if (shouldUseFullSync) {
        // Full sync garante que a etapa de upload sempre exista no fluxo do servidor.
        await api.markServerApplyChangesInProgress();

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
                toast("Falha ao enviar a cópia de segurança. Nova tentativa em instantes.", {
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
            await runSyncWithProgress({ direction: "upload" });
          }
        } else {
          await api.markServerApplyChangesInProgress();
          await runSelectiveUploadWithProgress(uploadPaths);
        }
      }

      completedSteps += 1;
      updateStepProgress(changedCount);

      // Atualiza o marcador de "alterações aplicadas" somente ao concluir com sucesso.
      const appliedSnapshotSummary = snapshotSummary ?? preGeneratedSnapshotSummary;

      if (appliedSnapshotSummary) {
        await api.markSnapshotAsUploaded(
          appliedSnapshotSummary.generated_at,
          appliedSnapshotSummary.last_change_timestamp
        );
      } else {
        await api.markLocalChangesAsApplied();
      }
      await api.clearServerApplyChangesInProgress();
      await loadSettings();
      updateStepProgress(changedCount);

      if (failedCount > 0 && !isAutomatic) {
        toast.error(`${failedCount} arquivo(s) não puderam ser verificados.`);
      }

      if (!isAutomatic && failedArchives > 0) {
        toast.error(`${failedArchives} partitura(s) não puderam ser compactadas.`);
      }

      if (!isAutomatic) {
        const summaryParts: string[] = [];
        if (recoveredCount > 0) {
          summaryParts.push(`${recoveredCount} recuperado(s)`);
        }
        if (notFoundCount > 0) {
          summaryParts.push(`${notFoundCount} não encontrado(s)`);
        }
        if (generatedArchives > 0) {
          summaryParts.push(`${generatedArchives} arquivo(s) compactado(s)`);
        }
        if (hasDatabaseChanges) {
          summaryParts.push(`${eventsSummary.events_count} alteração(ões) de banco`);
        }

        const hasFailures = failedCount > 0 || failedArchives > 0;
        if (summaryParts.length > 0) {
          const summaryText = `Verificação concluída: ${summaryParts.join(", ")}`;

          if (hasFailures) {
            toast.error(`${summaryText} Mas algumas partes falharam.`);
          } else {
            toast.success(summaryText);
          }
        }
      }

      if (changedCount > 0 || recoveredCount > 0 || notFoundCount > 0) {
        await loadSongs();
      }

      await refreshSelectedSong();

      const delay = 1000;
      scheduleScanReset(delay);
    } catch (err) {
      console.error("Failed to scan files for changes:", err);
      if (!isAutomatic) {
        toast.error(getScanFailureToastMessage(err, getErrorMessage, computerType));
      }
      clearScanTimer();
      resetScanState();
    } finally {
      scanInProgressRef.current = false;
    }
  }, [
    clearScanTimer,
    computerType,
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
  ]);

  return { scanFilesForChanges };
}
