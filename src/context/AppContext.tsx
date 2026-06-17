import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import * as api from "../api/commands";
import { getErrorMessage as extractErrorMessage } from "../utils/errors";
import { initialState, reducer } from "./reducer";
import type { AppContextValue } from "./types";
import { useAppBootstrap } from "./useAppBootstrap";
import { useAppCrudActions } from "./useAppCrudActions";
import { useAppScanFlow } from "./useAppScanFlow";
import { compareSongNames } from "../utils/songOrder";

const AppContext = createContext<AppContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

// ── Provider ──

interface AppProviderProps {
  children: ReactNode;
  disableBootstrap?: boolean;
}

export function AppProvider({ children, disableBootstrap = false }: AppProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    const message = extractErrorMessage(err);
    return message === "Erro desconhecido" ? fallback : message;
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      const songs = await (async () => {
        if (state.sidebarView === "favorites") return api.getFavoritedSongSummaries();
        if (state.sidebarView === "drafts") return api.getSongSummariesWithDrafts();
        if (state.sidebarView === "not_found") return api.getSongSummariesWithNotFound();

        if (typeof state.sidebarView === "object" && state.sidebarView.type === "category") {
          return api.getSongSummariesByCategory(state.sidebarView.id);
        }

        return api.getAllSongSummaries();
      })();

      dispatch({
        type: "SET_SONGS",
        payload: [...songs].sort((a, b) => compareSongNames(a.name, b.name)),
      });
    } catch (err) {
      console.error("Failed to load songs:", err);
    }
  }, [state.sidebarView]);

  const loadCategories = useCallback(async () => {
    try {
      const categories = await api.getCategories();
      dispatch({ type: "SET_CATEGORIES", payload: categories });
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await api.getSettings();
      dispatch({ type: "SET_SETTINGS", payload: settings });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  const refreshSelectedSong = useCallback(async () => {
    if (!state.selectedSong) {
      return;
    }

    try {
      const refreshedSong = await api.getSongListItemById(state.selectedSong.id);
      dispatch({ type: "UPDATE_SELECTED_SONG", payload: refreshedSong });
    } catch (err) {
      console.error("Failed to refresh selected song:", err);
    }
  }, [dispatch, state.selectedSong]);

  const setOperationStatus = useCallback((payload: {
    title: string;
    detail?: string | null;
    stepCurrent?: number | null;
    stepTotal?: number | null;
    itemCurrent?: number | null;
    itemTotal?: number | null;
  }) => {
    dispatch({ type: "SET_OPERATION_STATUS", payload });
  }, [dispatch]);

  const resetOperationStatus = useCallback(() => {
    dispatch({ type: "RESET_OPERATION_STATUS" });
  }, [dispatch]);

  const resetScanReport = useCallback(() => {
    dispatch({ type: "RESET_SCAN_REPORT" });
  }, [dispatch]);

  const { previewScanFilesForChanges, scanFilesForChanges, runSyncWithProgress } = useAppScanFlow({
    dispatch,
    computerType: state.settings?.computer_type,
    loadSongs,
    loadCategories,
    loadSettings,
    refreshSelectedSong,
    getErrorMessage,
  });

  useAppBootstrap({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
    startupScan: () => scanFilesForChanges({ isAutomatic: true }),
    enabled: !disableBootstrap,
  });

  const {
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
    useScoreAsBase,
    saveSettings,
    completeFirstRun,
  } = useAppCrudActions({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
    refreshSelectedSong,
    getErrorMessage,
  });

  const value: AppContextValue = useMemo(
    () => ({
      state,
      dispatch,
      loadSongs,
      loadCategories,
      loadSettings,
      refreshSelectedSong,
      runSyncWithProgress,
      setOperationStatus,
      resetOperationStatus,
      resetScanReport,
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
      useScoreAsBase,
      saveSettings,
      completeFirstRun,
      previewScanFilesForChanges,
      scanFilesForChanges,
    }),
    [
      state,
      dispatch,
      loadSongs,
      loadCategories,
      loadSettings,
      refreshSelectedSong,
      setOperationStatus,
      resetOperationStatus,
      runSyncWithProgress,
      resetScanReport,
      setSidebarView,
      selectSong,
      selectScore,
      setSearchQuery,
      toggleFavorite,
      createCategory,
      deleteCategory,
      updateAuthor,
      deleteAuthor,
      updateSong,
      updateSongStatus,
      updateScore,
      updateScoreStatus,
      deleteScore,
      deleteSong,
      useScoreAsBase,
      saveSettings,
      completeFirstRun,
      previewScanFilesForChanges,
      scanFilesForChanges,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
