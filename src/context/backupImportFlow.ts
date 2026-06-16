import type { Dispatch } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import type { Action } from "./reducer";
import type { RunSyncWithProgress } from "./types";

export interface BackupImportDeps {
  dispatch: Dispatch<Action>;
  runSyncWithProgress: RunSyncWithProgress;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export async function runBackupImportFlow(deps: BackupImportDeps) {
  const { dispatch, runSyncWithProgress, loadSongs, loadCategories, loadSettings } = deps;

  dispatch({ type: "SET_SCANNING_FILES", payload: true });

  dispatch({
    type: "SET_OPERATION_STATUS",
    payload: {
      title: "Etapa 1 - Baixando backup",
      detail: "Baixando arquivos de backup da nuvem",
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
    toast.error("Nenhum backup válido encontrado na nuvem.");
    dispatch({ type: "SET_SCANNING_FILES", payload: false });
    dispatch({ type: "RESET_OPERATION_STATUS" });
    dispatch({ type: "RESET_RCLONE_PROGRESS" });
    return;
  }

  dispatch({
    type: "SET_OPERATION_STATUS",
    payload: {
      title: "Etapa 2 - Restaurando banco",
      detail: `Restaurando ${validation.songs_count} músicas e ${validation.scores_count} partituras`,
      stepCurrent: 2,
      stepTotal: 5,
    },
  });

  const dbSummary = await api.restoreBackupDbFromCloud();

  dispatch({
    type: "SET_OPERATION_STATUS",
    payload: {
      title: "Etapa 3 - Baixando músicas",
      detail: "Baixando arquivos de partituras da nuvem",
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
      title: "Etapa 4 - Restaurando partituras",
      detail: "Extraindo partituras para os diretórios",
      stepCurrent: 4,
      stepTotal: 5,
    },
  });

  const restoreResult = await api.restoreSongsFromCloudArchives();

  dispatch({
    type: "SET_OPERATION_STATUS",
    payload: {
      title: "Etapa 5 - Restaurando rascunhos",
      detail: "Restaurando partituras draft e ignored",
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
      title: "Atualizando interface",
      detail: "Recarregando músicas e partituras",
      stepCurrent: null,
      stepTotal: null,
    },
  });

  await Promise.all([loadSongs(), loadCategories(), loadSettings()]);

  const restoredInfo =
    restoreResult.songs_restored > 0 || restoreResult.scores_restored > 0
      ? ` ${restoreResult.songs_restored} música(s) e ${restoreResult.scores_restored} partitura(s) foram restauradas da nuvem.`
      : "";

  const draftIgnoredInfo =
    draftIgnoredRestored > 0
      ? ` ${draftIgnoredRestored} partitura(s) draft/ignored restauradas.`
      : "";

  toast.success(
    `Backup da nuvem importado com sucesso. Ele é de ${formatTimestamp(dbSummary.generated_at)}; mudanças feitas depois disso não entram nesse backup.${restoredInfo}${draftIgnoredInfo}`,
    { duration: 8000 },
  );

  dispatch({ type: "SET_SCANNING_FILES", payload: false });
  dispatch({ type: "RESET_OPERATION_STATUS" });
  dispatch({ type: "RESET_RCLONE_PROGRESS" });
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("pt-BR");
}
