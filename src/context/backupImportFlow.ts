import type { Dispatch } from "react";
import toast from "../utils/toast";
import i18next from "i18next";

import * as api from "../api/commands";
import type { Action } from "./reducer";
import type { RunSyncWithProgress } from "./types";

const t = i18next.t.bind(i18next);

export interface BackupImportDeps {
  dispatch: Dispatch<Action>;
  runSyncWithProgress: RunSyncWithProgress;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export interface BackupImportOptions {
  backupFileName?: string | null;
}

export async function runBackupImportFlow(
  deps: BackupImportDeps,
  options: BackupImportOptions = {},
) {
  const { dispatch, runSyncWithProgress, loadSongs, loadCategories, loadSettings } = deps;
  const backupFileName = options.backupFileName ?? null;

  dispatch({ type: "SET_SCANNING_FILES", payload: true });

  try {
    dispatch({
      type: "SET_OPERATION_STATUS",
      payload: {
        title: t("backupImportFlow.step1DownloadingBackup"),
        detail: t("backupImportFlow.downloadingBackupFiles"),
        stepCurrent: 1,
        stepTotal: 5,
      },
    });

    await runSyncWithProgress({
      direction: "download",
      relativePath: "backup",
      lockInteraction: false,
    });

    const validation = await api.validateCloudBackup();

    if (!validation.found) {
      toast.error(t("backupImportFlow.noValidBackup"));
      return;
    }

    dispatch({
      type: "SET_OPERATION_STATUS",
      payload: {
        title: t("backupImportFlow.step2RestoringDb"),
        detail: t("backupImportFlow.restoringDbDetail", { songs: validation.songs_count, scores: validation.scores_count }),
        stepCurrent: 2,
        stepTotal: 5,
      },
    });

    const dbSummary = await api.importBackupCloudFile(backupFileName);

    dispatch({
      type: "SET_OPERATION_STATUS",
      payload: {
        title: t("backupImportFlow.step3DownloadingSongs"),
        detail: t("backupImportFlow.downloadingScoresFiles"),
        stepCurrent: 3,
        stepTotal: 5,
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
        title: t("backupImportFlow.step4RestoringScores"),
        detail: t("backupImportFlow.extractingScores"),
        stepCurrent: 4,
        stepTotal: 5,
      },
    });

    const restoreResult = await api.restoreSongsFromCloudArchives();

    dispatch({
      type: "SET_OPERATION_STATUS",
      payload: {
        title: t("backupImportFlow.step5RestoringDrafts"),
        detail: t("backupImportFlow.restoringDrafts"),
        stepCurrent: 5,
        stepTotal: 5,
      },
    });

    await runSyncWithProgress({
      direction: "download",
      relativePath: "backup_scores_draft_ignored",
      lockInteraction: true,
    });

    const draftIgnoredRestored = await api.restoreDraftIgnoredFromCloud();

    dispatch({
      type: "SET_OPERATION_STATUS",
      payload: {
        title: t("backupImportFlow.updatingInterface"),
        detail: t("backupImportFlow.reloadingSongs"),
        stepCurrent: null,
        stepTotal: null,
      },
    });

    await Promise.all([loadSongs(), loadCategories(), loadSettings()]);

    const restoredInfo =
      restoreResult.songs_restored > 0 || restoreResult.scores_restored > 0
        ? t("backupImportFlow.songsRestored", { songs: restoreResult.songs_restored, scores: restoreResult.scores_restored })
        : "";

    const replacedInfo =
      restoreResult.scores_replaced > 0
        ? t("backupImportFlow.scoresReplaced", { count: restoreResult.scores_replaced })
        : "";

    const draftIgnoredInfo =
      draftIgnoredRestored > 0
        ? t("backupImportFlow.draftsRestored", { count: draftIgnoredRestored })
        : "";

    toast.success(
      t("backupImportFlow.cloudBackupImported", { timestamp: formatTimestamp(dbSummary.generated_at), restored: restoredInfo + replacedInfo, drafts: draftIgnoredInfo }),
      { duration: 8000 },
    );
  } finally {
    dispatch({ type: "SET_SCANNING_FILES", payload: false });
    dispatch({ type: "RESET_OPERATION_STATUS" });
    dispatch({ type: "RESET_RCLONE_PROGRESS" });
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const localeMap: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    de: "de-DE",
  };
  return date.toLocaleString(localeMap[i18next.language] || "en-US");
}
