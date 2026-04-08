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
  getErrorMessage: (err: unknown, fallback: string) => string;
}

type ScanFilesForChangesOptions =
  | boolean
  | {
      isAutomatic?: boolean;
      forceCloudSync?: boolean;
    };

const SNAPSHOT_AUTO_THRESHOLD_BYTES = 2 * 1024 * 1024;

export function useAppScanFlow({
  dispatch,
  computerType,
  loadSongs,
  loadCategories,
  loadSettings,
  getErrorMessage,
}: UseAppScanFlowParams) {
  const scanResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const runSyncWithProgress = useCallback(async (direction: "upload" | "download") => {
    let stopPolling = false;

    dispatch({
      type: "SET_RCLONE_PROGRESS",
      payload: {
        active: true,
        direction,
        bytes: 0,
        totalBytes: null,
        percentage: null,
        speedBytesPerSec: 0,
        etaSeconds: null,
      },
    });

    const syncPromise = api.syncCloudWithRclone(direction);

    const pollingPromise = (async () => {
      while (!stopPolling) {
        try {
          const stats = await api.getRcloneRcStats();
          if (stats) {
            dispatch({
              type: "SET_RCLONE_PROGRESS",
              payload: {
                active: stats.active,
                direction,
                bytes: Math.max(stats.bytes, 0),
                totalBytes: stats.total_bytes,
                percentage: stats.percentage !== null ? Math.round(stats.percentage) : null,
                speedBytesPerSec: stats.speed_bytes_per_sec,
                etaSeconds: stats.eta_seconds,
              },
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
      dispatch({ type: "RESET_RCLONE_PROGRESS" });
      void pollingPromise.catch(() => undefined);
    }
  }, [dispatch]);

  const runSelectiveUploadWithProgress = useCallback(async (relativePaths: string[]) => {
    let stopPolling = false;

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
            dispatch({
              type: "SET_RCLONE_PROGRESS",
              payload: {
                active: stats.active,
                direction: "upload",
                bytes: Math.max(stats.bytes, 0),
                totalBytes: stats.total_bytes,
                percentage: stats.percentage !== null ? Math.round(stats.percentage) : null,
                speedBytesPerSec: stats.speed_bytes_per_sec,
                etaSeconds: stats.eta_seconds,
              },
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
      dispatch({ type: "RESET_RCLONE_PROGRESS" });
      void pollingPromise.catch(() => undefined);
    }
  }, [dispatch]);

  const scanFilesForChanges = useCallback(async (options: ScanFilesForChangesOptions = false) => {
    const isAutomatic =
      typeof options === "boolean" ? options : (options.isAutomatic ?? false);
    const forceCloudSync =
      typeof options === "boolean" ? false : (options.forceCloudSync ?? false);

    try {
      clearScanTimer();

      const hasInternet = await api.hasInternetConnection();
      if (!hasInternet) {
        if (!isAutomatic) {
          toast.error("Sem conexão com a internet");
        }
        return;
      }

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

      const isClient = computerType === "Client";

      if (isClient) {
        const clientTotalSteps = 2;
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: { total: clientTotalSteps, completed: 0, changedFiles: 0 },
        });

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 1 - Download da nuvem",
            detail: "Baixando alterações da nuvem",
            stepCurrent: 1,
            stepTotal: clientTotalSteps,
          },
        });
        await runSyncWithProgress("download");

        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: { total: clientTotalSteps, completed: 1, changedFiles: 0 },
        });

        dispatch({
          type: "SET_OPERATION_STATUS",
          payload: {
            title: "Etapa 2 - Aplicando alterações",
            detail: "Atualizando base local do cliente",
            stepCurrent: 2,
            stepTotal: clientTotalSteps,
          },
        });
        const syncSummary = await api.applyServerChangesOnClient();

        await Promise.all([loadSongs(), loadCategories(), loadSettings()]);

        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: {
            total: clientTotalSteps,
            completed: clientTotalSteps,
            changedFiles: syncSummary.events_applied,
          },
        });

        if (!isAutomatic) {
          const appliedSummary = syncSummary.snapshot_applied
            ? `snapshot aplicado + ${syncSummary.events_applied} evento(s)`
            : `${syncSummary.events_applied} evento(s) aplicado(s)`;
          toast.success(`Sincronização concluída: ${appliedSummary}`);
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

      // Fluxo base do servidor: verificar, compactar e gerar events.
      // A etapa 4/5 só aparece quando houver upload ou snapshot automático.
      currentTotalSteps = 3;
      updateStepProgress(changedCount);

      dispatch({
        type: "SET_OPERATION_STATUS",
        payload: {
          title: "Etapa 2 - Junção e compressão",
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
        await api.generateSnapshotFile(false);
        snapshotGenerated = true;
        completedSteps += 1;
        updateStepProgress(changedCount);

        if (!isAutomatic) {
          toast("Snapshot forçado: events.msgpack atingiu 2MB", {
            icon: "📦",
          });
        }
      }

      const uploadStep = snapshotGenerated ? 5 : 4;

      dispatch({
        type: "SET_OPERATION_STATUS",
        payload: {
          title: `Etapa ${uploadStep} - Upload para nuvem`,
          detail: hasPendingChanges || hasDetectedFileChanges || forceCloudSync
            ? "Enviando arquivos alterados para a nuvem"
            : "Sem alterações locais, validando sincronização da nuvem",
          stepCurrent: uploadStep,
          stepTotal: currentTotalSteps,
        },
      });

      const shouldUseFullSync =
        snapshotGenerated || eventsSummary.events_count === 0 || (!hasPendingChanges && !hasDetectedFileChanges);

      if (shouldUseFullSync) {
        // Full sync garante que a etapa de upload sempre exista no fluxo do servidor.
        if (snapshotGenerated) {
          let uploadError: unknown = null;

          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              await runSyncWithProgress("upload");
              uploadError = null;
              break;
            } catch (error) {
              uploadError = error;
              if (attempt === 1 && !isAutomatic) {
                toast("Falha no upload do snapshot. Tentando novamente...", {
                  icon: "⚠️",
                });
              }
            }
          }

          if (uploadError) {
            throw uploadError;
          }
        } else {
          await runSyncWithProgress("upload");
        }
      } else {
        const uploadPaths = new Set<string>();

        for (const archiveResult of archiveSummary.results ?? []) {
          if (archiveResult.generated && archiveResult.song_id) {
            uploadPaths.add(`songs/${archiveResult.song_id}.tar.zst`);
          }
        }

        if (eventsSummary.events_count > 0) {
          uploadPaths.add("events/events.msgpack.zst");
        }

        if (uploadPaths.size === 0) {
          await runSyncWithProgress("upload");
        } else {
          await runSelectiveUploadWithProgress(Array.from(uploadPaths));
        }
      }

      completedSteps += 1;
      updateStepProgress(changedCount);

      // Atualiza o marcador de "alterações aplicadas" somente ao concluir com sucesso.
      await api.markLocalChangesAsApplied();
      await api.refreshLibrarySummaryCache();
      await loadSettings();
      updateStepProgress(changedCount);

      if (!hasPendingChanges && !hasDetectedFileChanges && !forceCloudSync && !isAutomatic) {
        toast.success("Verificação concluída sem alterações");
      }

      if (notFoundCount > 0 && !isAutomatic) {
        toast(`⚠ ${notFoundCount} arquivo(s) não encontrado(s)`, { icon: "⚠️" });
      }

      if (failedCount > 0 && !isAutomatic) {
        toast.error(`${failedCount} arquivo(s) falharam durante verificação`);
      }

      if (!isAutomatic && failedArchives > 0) {
        toast.error(`${failedArchives} arquivo(s) .tar.zst falharam ao gerar`);
      }

      if (!isAutomatic) {
        const summaryParts: string[] = [];
        if (changedCount > 0) {
          summaryParts.push(`${changedCount} alterado(s)`);
        }
        if (recoveredCount > 0) {
          summaryParts.push(`${recoveredCount} recuperado(s)`);
        }
        if (notFoundCount > 0) {
          summaryParts.push(`${notFoundCount} não encontrado(s)`);
        }
        if (generatedArchives > 0) {
          summaryParts.push(`${generatedArchives} arquivo(s) compactado(s)`);
        }

        const hasFailures = failedCount > 0 || failedArchives > 0;
        const summaryText =
          summaryParts.length > 0
            ? `Verificação concluída: ${summaryParts.join(", ")}`
            : "Verificação concluída sem alterações";

        if (hasFailures) {
          toast.error(`${summaryText}. Houve falhas durante o processo.`);
        } else {
          toast.success(summaryText);
        }
      }

      if (changedCount > 0 || recoveredCount > 0 || notFoundCount > 0) {
        await loadSongs();
      }

      const delay = 1000;
      scheduleScanReset(delay);
    } catch (err) {
      console.error("Failed to scan files for changes:", err);
      if (!isAutomatic) {
        toast.error(getErrorMessage(err, "Erro ao verificar alterações nos arquivos"));
      }
      clearScanTimer();
      resetScanState();
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
    runSelectiveUploadWithProgress,
    runSyncWithProgress,
    scheduleScanReset,
  ]);

  return { scanFilesForChanges };
}
