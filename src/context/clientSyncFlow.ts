import type { Dispatch } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import type { Action } from "./reducer";

export interface ClientSyncDeps {
  dispatch: Dispatch<Action>;
  runSyncWithProgress: (opts: RunSyncWithProgressOptions) => Promise<api.RcloneSyncSummary>;
  resetScanState: () => void;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  refreshSelectedSong: () => Promise<void>;
  scheduleScanReset: (delayMs: number) => void;
}

export type RunSyncWithProgressOptions = {
  direction: "upload" | "download";
  relativePath?: string;
  lockInteraction?: boolean;
};

export async function runClientSyncFlow(params: { isAutomatic: boolean; deps: ClientSyncDeps }) {
  const { isAutomatic, deps } = params;
  const {
    dispatch,
    runSyncWithProgress,
    resetScanState,
    loadSongs,
    loadCategories,
    loadSettings,
    refreshSelectedSong,
    scheduleScanReset,
  } = deps;

  dispatch({
    type: "SET_SCANNING_FILES",
    payload: true,
  });
  dispatch({
    type: "SET_OPERATION_STATUS",
    payload: {
      title: "Etapa 1 - Consultando alterações",
      detail: "Verificando snapshot e events da nuvem",
      stepCurrent: 1,
      stepTotal: 1,
    },
  });

  await runSyncWithProgress({
    direction: "download",
    relativePath: "actions",
    lockInteraction: false,
  });

  const hasPendingChanges = await api.hasPendingChanges();

  if (!hasPendingChanges) {
    resetScanState();
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
      detail: "Atualizando arquivos locais do computador de ensaio",
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
      detail: "Atualizando banco local do computador de ensaio",
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

  if (
    !isAutomatic &&
    (syncSummary.snapshot_applied || syncSummary.events_applied > 0)
  ) {
    toast.success("Alterações da nuvem aplicadas com sucesso.");
  }

  scheduleScanReset(1500);
}
