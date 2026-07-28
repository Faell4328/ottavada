import { useCallback, type Dispatch } from "react";
import i18n from "../i18n";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import type { AppSettings, ScoreListItem, SidebarView, SongListItem } from "../types";
import type { Action, State } from "./reducer";
import type { AuthorFilterValue } from "./types";
import { normalizeAuthorName } from "../utils/songSearch";

const t = i18n.t.bind(i18n);

function isActionLocked(state: State, t: (key: string) => string): boolean {
  if (
    state.settings?.computer_type === "Client" ||
    state.isScanningFiles ||
    state.rcloneProgress.direction !== null ||
    state.operationStatus.stepCurrent !== null
  ) {
    toast.error(
      state.settings?.computer_type === "Client"
        ? t("crudActions.clientBlocked")
        : t("crudActions.syncBlocked")
    );
    return true;
  }
  return false;
}

function updateSongAuthorField(
  songs: SongListItem[],
  kind: "composer" | "arranger",
  oldName: string,
  newName: string | null
): SongListItem[] {
  const normalizedOldName = normalizeAuthorName(oldName);

  return songs.map((song) => {
    const currentName = kind === "composer" ? song.composer : song.arranger;
    if (!currentName || normalizeAuthorName(currentName) !== normalizedOldName) {
      return song;
    }

    return {
      ...song,
      [kind]: newName,
    };
  });
}

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

  const setAuthorFilters = useCallback((payload: { composer: AuthorFilterValue; arranger: AuthorFilterValue }) => {
    dispatch({ type: "SET_AUTHOR_FILTERS", payload });
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
    if (isActionLocked(state, t)) return;

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

  const updateCategory = useCallback(async (categoryId: string, name: string) => {
    if (isActionLocked(state, t)) return;

    try {
      await api.updateCategory(categoryId, name);
      await loadCategories();

      if (
        typeof state.sidebarView === "object" &&
        state.sidebarView.type === "category" &&
        state.sidebarView.id === categoryId
      ) {
        dispatch({
          type: "UPDATE_SIDEBAR_CATEGORY_NAME",
          payload: { categoryId, name: name.trim() },
        });
      }
    } catch (err) {
      console.error("Failed to update category:", err);
      toast.error(t("crudActions.categorySaveError"));
      throw err;
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

  const deleteCategory = useCallback(async (categoryId: string) => {
    if (isActionLocked(state, t)) return;

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

  const updateAuthor = useCallback(async (
    kind: "composer" | "arranger",
    oldName: string,
    newName: string
  ) => {
    if (isActionLocked(state, t)) return;

    try {
      if (kind === "composer") {
        await api.updateComposer(oldName, newName);
      } else {
        await api.updateArranger(oldName, newName);
      }

      dispatch({
        type: "SET_SONGS",
        payload: updateSongAuthorField(state.songs, kind, oldName, newName.trim()),
      });

      if (normalizeAuthorName(state.authorFilters[kind]) === normalizeAuthorName(oldName)) {
        dispatch({
          type: "SET_AUTHOR_FILTERS",
          payload: {
            ...state.authorFilters,
            [kind]: newName.trim(),
          },
        });
      }

      await loadSongs();
    } catch (err) {
      console.error(`Failed to update ${kind}:`, err);
      toast.error(t("crudActions.authorSaveError"));
      throw err;
    }
  }, [
    dispatch,
    loadSongs,
    state.authorFilters,
    state.isScanningFiles,
    state.operationStatus.stepCurrent,
    state.rcloneProgress.direction,
    state.settings?.computer_type,
  ]);

  const deleteAuthor = useCallback(async (
    kind: "composer" | "arranger",
    oldName: string
  ) => {
    if (isActionLocked(state, t)) return;

    try {
      if (kind === "composer") {
        await api.deleteComposer(oldName);
      } else {
        await api.deleteArranger(oldName);
      }

      dispatch({
        type: "SET_SONGS",
        payload: updateSongAuthorField(state.songs, kind, oldName, null),
      });

      if (normalizeAuthorName(state.authorFilters[kind]) === normalizeAuthorName(oldName)) {
        dispatch({
          type: "SET_AUTHOR_FILTERS",
          payload: {
            ...state.authorFilters,
            [kind]: "all",
          },
        });
      }

      await loadSongs();
    } catch (err) {
      console.error(`Failed to delete ${kind}:`, err);
      toast.error(t("crudActions.authorDeleteError"));
      throw err;
    }
  }, [
    dispatch,
    loadSongs,
    state.authorFilters,
    state.isScanningFiles,
    state.operationStatus.stepCurrent,
    state.rcloneProgress.direction,
    state.settings?.computer_type,
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
      dispatch({ type: "SET_SONGS", payload: state.songs.map((song) => song.id === updatedSong.id ? updatedSong : song) });
      await Promise.all([loadSongs(), loadCategories()]);
      await refreshSelectedSong();
      await loadSettings();
      toast.success(t("crudActions.songUpdated"));
    } catch (err) {
      console.error("Failed to update song:", err);
      toast.error(t("crudActions.songSaveError"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadCategories, loadSettings, loadSongs, refreshSelectedSong]);

    const updateSongStatus = useCallback(async (
      songId: string,
      status: "main" | "draft"
    ) => {
      try {
        const updatedSong = await api.updateSongStatus(songId, status);
        dispatch({ type: "SET_SONGS", payload: state.songs.map((song) => song.id === updatedSong.id ? updatedSong : song) });

        await refreshSelectedSong();
        await loadSettings();
        toast.success(t("crudActions.songStatusUpdated"));
      } catch (err) {
        console.error("Failed to update song status:", err);
        toast.error(t("crudActions.songStatusError"));
        throw err;
      }
    }, [dispatch, loadSettings, refreshSelectedSong, state.songs]);

  const updateScore = useCallback(async (
    scoreId: string,
    instrumentName: string | null,
  ) => {
    try {
      await api.updateScore(scoreId, instrumentName);
      if (state.selectedScore?.id === scoreId) {
        dispatch({ type: "SET_SELECTED_SCORE", payload: null });
      }
      await loadSongs();
      await refreshSelectedSong();
      await loadSettings();
      toast.success(t("crudActions.scoreUpdated"));
    } catch (err) {
      console.error("Failed to update score:", err);
      toast.error(t("crudActions.scoreSaveError"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSettings, loadSongs, refreshSelectedSong, state.selectedScore]);

  const updateScoreStatus = useCallback(async (
    scoreId: string,
    status: "main" | "draft" | "ignored"
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

      toast.success(t("crudActions.scoreStatusUpdated"));
    } catch (err) {
      console.error("Failed to update score status:", err);
      toast.error(t("crudActions.scoreStatusError"));
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
      toast.success(t("crudActions.scoreDeleted"));
    } catch (err) {
      console.error("Failed to delete score:", err);
      toast.error(t("crudActions.scoreDeleteError"));
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
      toast.success(t("crudActions.songDeleted"));
    } catch (err) {
      console.error("Failed to delete song:", err);
      toast.error(t("crudActions.songDeleteError"));
      throw err;
    }
  }, [dispatch, getErrorMessage, loadSettings, loadSongs, refreshSelectedSong, state.selectedSong]);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    try {
      await api.saveSettings(settings);
      dispatch({ type: "SET_SETTINGS", payload: settings });
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error(t("crudActions.settingsSaveError"));
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
      toast.success(t("crudActions.firstRunCompleted"));
    } catch (err) {
      console.error("Failed to complete first run:", err);
      toast.error(t("crudActions.firstRunError"));
      throw err;
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
      toast.success(t("crudActions.scoreDuplicated"));
    } catch (err) {
      console.error("Failed to use score as base:", err);
      toast.error(t("crudActions.scoreDuplicateError"));
      throw err;
    }
  }, [dispatch, loadSettings, loadSongs, refreshSelectedSong]);

  return {
    setSidebarView,
    selectSong,
    selectScore,
    setSearchQuery,
    setAuthorFilters,
    toggleFavorite,
    createCategory,
    updateCategory,
    deleteCategory,
    updateAuthor,
    deleteAuthor,
    updateSong,
    updateSongStatus,
    updateScore,
    updateScoreStatus,
    deleteScore,
    deleteSong,
    saveSettings,
    completeFirstRun,
    useScoreAsBase,
  };
}
