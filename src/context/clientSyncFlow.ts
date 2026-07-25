import type { Dispatch } from "react";
import toast from "react-hot-toast";
import i18next from "i18next";

import * as api from "../api/commands";
import type { Action } from "./reducer";

const t = i18next.t.bind(i18next);

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
      title: t("clientSyncFlow.step1CheckingChanges"),
      detail: t("clientSyncFlow.verifyingSnapshot"),
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
      title: t("clientSyncFlow.step2DownloadingSongs"),
      detail: t("clientSyncFlow.updatingLocalFiles"),
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
      title: t("clientSyncFlow.step2ApplyingChanges"),
      detail: t("clientSyncFlow.updatingLocalDb"),
      stepCurrent: 1,
      stepTotal: 1,
    },
  });

  const syncSummary = await api.applyServerChangesOnClient();

  dispatch({
    type: "SET_OPERATION_STATUS",
    payload: {
      title: t("clientSyncFlow.step2UpdatingInterface"),
      detail: t("backupImportFlow.reloadingSongs"),
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
    toast.success(t("clientSyncFlow.cloudChangesApplied"));
  }

  scheduleScanReset(1500);
}
