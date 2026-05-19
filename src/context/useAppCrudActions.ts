import { useCallback, type Dispatch } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import type { AppSettings, ScoreListItem, SidebarView, SongListItem } from "../types";
import type { Action, State } from "./reducer";

interface UseAppCrudActionsParams {
  state: State;
  dispatch: Dispatch<Action>;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  refreshSelectedSong: () => Promise<void>;
  getErrorMessage: (err: unknown, fallback: string) => string;
}

export function useAppCrudActions({
  state,
  dispatch,
  loadSongs,
  loadCategories,
  loadSettings,
  refreshSelectedSong,
  getErrorMessage,
}: UseAppCrudActionsParams) {
  const setSidebarView = useCallback((view: SidebarView) => {
    dispatch({ type: "SET_SIDEBAR_VIEW", payload: view });
  }, [dispatch]);

  const selectSong = useCallback((song: SongListItem | null) => {
    dispatch({ type: "SET_SELECTED_SONG", payload: song });
  }, [dispatch]);

  const selectScore = useCallback((score: ScoreListItem | null) => {
    dispatch({ type: "SET_SELECTED_SCORE", payload: score });
  }, [dispatch]);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: query });
  }, [dispatch]);

  const toggleFavorite = useCallback(async (songId: string) => {
    try {
      const isFavorite = await api.toggleFavorite(songId);
      dispatch({
        type: "TOGGLE_FAVORITE",
        payload: { songId, isFavorite },
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }, [dispatch]);

  const createCategory = useCallback(async (name: string) => {
    if (
      state.settings?.computer_type === "Client" ||
      state.isScanningFiles ||
      state.rcloneProgress.direction !== null ||
      state.operationStatus.stepCurrent !== null
    ) {
      toast.error(
        state.settings?.computer_type === "Client"
          ? "Esse recurso só está disponível no computador principal."
          : "Espere a sincronização terminar para continuar."
      );
      return;
    }

    try {
      await api.createCategory(name);
      await loadCategories();
    } catch (err) {
      console.error("Failed to create category:", err);
    }
  }, [
    loadCategories,
    state.isScanningFiles,
    state.operationStatus.stepCurrent,
    state.rcloneProgress.direction,
    state.settings?.computer_type,
  ]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    if (
      state.settings?.computer_type === "Client" ||
      state.isScanningFiles ||
      state.rcloneProgress.direction !== null ||
      state.operationStatus.stepCurrent !== null
    ) {
      toast.error(
        state.settings?.computer_type === "Client"
          ? "Esse recurso só está disponível no computador principal."
          : "Espere a sincronização terminar para continuar."
      );
      return;
    }

    try {
      await api.deleteCategory(categoryId);
      await loadCategories();

      if (
        typeof state.sidebarView === "object" &&
        state.sidebarView.type === "category" &&
        state.sidebarView.id === categoryId
      ) {
        dispatch({ type: "SET_SIDEBAR_VIEW", payload: "all" });
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  }, [
    dispatch,
    loadCategories,
    state.isScanningFiles,
    state.operationStatus.stepCurrent,
    state.rcloneProgress.direction,
    state.settings?.computer_type,
    state.sidebarView,
  ]);

  const updateSong = useCallback(async (
    songId: string,
    name: string,
    composer: string | null,
    arranger: string | null,
    categoryIds: string[]
  ) => {
    try {
      const updatedSong = await api.updateSong(
        songId,
        name,
        composer,
        arranger,
        categoryIds
      );
      dispatch({ type: "UPDATE_SELECTED_SONG", payload: updatedSong });
      await Promise.all([loadSongs(), loadCategories()]);
      await refreshSelectedSong();
      await loadSettings();
      toast.success("Música atualizada.");
    } catch (err) {
      console.error("Failed to update song:", err);
      toast.error("Não foi possível salvar a música.");
      throw err;
    }
  }, [dispatch, getErrorMessage, loadCategories, loadSettings, loadSongs, refreshSelectedSong]);

  const updateScore = useCallback(async (
    scoreId: string,
    instrumentName: string | null,
    filePath: string
  ) => {
    try {
      await api.updateScore(scoreId, instrumentName, filePath);
      if (state.selectedScore?.id === scoreId) {
        dispatch({ type: "SET_SELECTED_SCORE", payload: null });
      }
      await loadSongs();
      await refreshSelectedSong();
      await loadSettings();
      toast.success("Partitura atualizada.");
    } catch (err) {
      console.error("Failed to update score:", err);
      toast.error("Não foi possível salvar a partitura.");
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSettings, loadSongs, refreshSelectedSong, state.selectedScore]);

  const updateScoreStatus = useCallback(async (
    scoreId: string,
    status: "main"
  ) => {
    try {
      const updatedSong = await api.updateScoreStatus(scoreId, status);
      dispatch({ type: "UPDATE_SELECTED_SONG", payload: updatedSong });

      const updatedSongs = state.songs.map((song) =>
        song.id === updatedSong.id ? updatedSong : song
      );
      dispatch({ type: "SET_SONGS", payload: updatedSongs });

      await refreshSelectedSong();
      await loadSettings();

      toast.success("Partitura marcada como principal.");
    } catch (err) {
      console.error("Failed to update score status:", err);
      toast.error("Não foi possível mudar o status da partitura.");
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSettings, refreshSelectedSong, state.songs]);

  const deleteScore = useCallback(async (scoreId: string) => {
    try {
      await api.deleteScore(scoreId);
      if (state.selectedScore?.id === scoreId) {
        dispatch({ type: "SET_SELECTED_SCORE", payload: null });
      }
      await loadSongs();
      await refreshSelectedSong();
      await loadSettings();
      toast.success("Partitura removida.");
    } catch (err) {
      console.error("Failed to delete score:", err);
      toast.error("Não foi possível remover a partitura.");
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSettings, loadSongs, refreshSelectedSong, state.selectedScore]);

  const deleteSong = useCallback(async (songId: string) => {
    try {
      await api.deleteSong(songId);

      if (state.selectedSong?.id === songId) {
        dispatch({ type: "SET_SELECTED_SONG", payload: null });
      }
      dispatch({ type: "SET_SELECTED_SCORE", payload: null });

      await loadSongs();
      await refreshSelectedSong();
      await loadSettings();
      toast.success("Música removida.");
    } catch (err) {
      console.error("Failed to delete song:", err);
      toast.error("Não foi possível remover a música.");
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSettings, loadSongs, refreshSelectedSong, state.selectedSong]);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    try {
      await api.saveSettings(settings);
      dispatch({ type: "SET_SETTINGS", payload: settings });
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Não foi possível salvar as configurações.");
      throw err;
    }
  }, [dispatch]);

  const completeFirstRun = useCallback(async (
    computerId: string,
    computerName: string,
    organizationName: string | null,
    computerType: string,
    rcloneConfigJson: string
  ) => {
    try {
      await api.completeFirstRun(
        computerId,
        computerName,
        organizationName,
        computerType,
        rcloneConfigJson
      );
      dispatch({ type: "SET_FIRST_RUN", payload: false });
      await Promise.all([loadSongs(), loadCategories(), loadSettings()]);
      toast.success("Configuração inicial concluída.");
    } catch (err) {
      console.error("Failed to complete first run:", err);
      toast.error("Não foi possível concluir a configuração inicial.");
    }
  }, [dispatch, loadCategories, loadSettings, loadSongs, refreshSelectedSong]);

  const useScoreAsBase = useCallback(async (
    sourceScoreId: string,
    newScoreName: string
  ) => {
    try {
      const updatedSong = await api.useScoreAsBase(sourceScoreId, newScoreName);
      dispatch({ type: "UPDATE_SELECTED_SONG", payload: updatedSong });
      await loadSongs();
      await refreshSelectedSong();
      await loadSettings();
      toast.success("Partitura duplicada com sucesso.");
    } catch (err) {
      console.error("Failed to use score as base:", err);
      toast.error("Não foi possível duplicar a partitura.");
      throw err;
    }
  }, [dispatch, loadSettings, loadSongs, refreshSelectedSong]);

  return {
    setSidebarView,
    selectSong,
    selectScore,
    setSearchQuery,
    toggleFavorite,
    createCategory,
    deleteCategory,
    updateSong,
    updateScore,
    updateScoreStatus,
    deleteScore,
    deleteSong,
    saveSettings,
    completeFirstRun,
    useScoreAsBase,
  };
}
