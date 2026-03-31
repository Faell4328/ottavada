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
  getErrorMessage: (err: unknown, fallback: string) => string;
}

export function useAppCrudActions({
  state,
  dispatch,
  loadSongs,
  loadCategories,
  loadSettings,
  getErrorMessage,
}: UseAppCrudActionsParams) {
  const setSidebarView = useCallback((view: SidebarView) => {
    dispatch({ type: "SET_SIDEBAR_VIEW", payload: view });
    dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
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
    if (state.settings?.computer_type === "Client") {
      toast.error("Operação não permitida para cliente");
      return;
    }

    try {
      const isFavorite = await api.toggleFavorite(songId);
      dispatch({
        type: "TOGGLE_FAVORITE",
        payload: { songId, isFavorite },
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }, [dispatch, state.settings?.computer_type]);

  const createCategory = useCallback(async (name: string) => {
    try {
      await api.createCategory(name);
      await loadCategories();
    } catch (err) {
      console.error("Failed to create category:", err);
    }
  }, [loadCategories]);

  const deleteCategory = useCallback(async (categoryId: string) => {
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
  }, [dispatch, loadCategories, state.sidebarView]);

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
      toast.success("Música atualizada com sucesso!");
    } catch (err) {
      console.error("Failed to update song:", err);
      toast.error(getErrorMessage(err, "Erro ao atualizar música"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadCategories, loadSongs]);

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
      toast.success("Partitura atualizada com sucesso!");
    } catch (err) {
      console.error("Failed to update score:", err);
      toast.error(getErrorMessage(err, "Erro ao atualizar partitura"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSongs, state.selectedScore]);

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

      toast.success("Partitura definida como Principal!");
    } catch (err) {
      console.error("Failed to update score status:", err);
      toast.error(getErrorMessage(err, "Erro ao atualizar status da partitura"));
      throw err;
    }
  }, [dispatch, getErrorMessage, state.songs]);

  const deleteScore = useCallback(async (scoreId: string) => {
    try {
      await api.deleteScore(scoreId);
      if (state.selectedScore?.id === scoreId) {
        dispatch({ type: "SET_SELECTED_SCORE", payload: null });
      }
      await loadSongs();
      toast.success("Partitura deletada com sucesso!");
    } catch (err) {
      console.error("Failed to delete score:", err);
      toast.error(getErrorMessage(err, "Erro ao deletar partitura"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSongs, state.selectedScore]);

  const deleteSong = useCallback(async (songId: string) => {
    try {
      await api.deleteSong(songId);

      if (state.selectedSong?.id === songId) {
        dispatch({ type: "SET_SELECTED_SONG", payload: null });
      }
      dispatch({ type: "SET_SELECTED_SCORE", payload: null });

      await loadSongs();
      toast.success("Música deletada com sucesso!");
    } catch (err) {
      console.error("Failed to delete song:", err);
      toast.error(getErrorMessage(err, "Erro ao deletar música"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSongs, state.selectedSong]);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    try {
      await api.saveSettings(settings);
      dispatch({ type: "SET_SETTINGS", payload: settings });
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Erro ao salvar configurações");
    }
  }, [dispatch]);

  const completeFirstRun = useCallback(async (
    computerId: string,
    computerName: string,
    computerType: string,
    rcloneConfigJson: string
  ) => {
    try {
      await api.completeFirstRun(computerId, computerName, computerType, rcloneConfigJson);
      dispatch({ type: "SET_FIRST_RUN", payload: false });
      await Promise.all([loadSongs(), loadCategories(), loadSettings()]);
      toast.success("Configuração inicial concluída!");
    } catch (err) {
      console.error("Failed to complete first run:", err);
      toast.error("Erro ao completar configuração inicial");
    }
  }, [dispatch, loadCategories, loadSettings, loadSongs]);

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
  };
}
