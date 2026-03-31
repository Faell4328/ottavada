import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import * as api from "../api/commands";
import { initialState, reducer } from "./reducer";
import type { AppContextValue } from "./types";
import { useAppBootstrap } from "./useAppBootstrap";
import { useAppCrudActions } from "./useAppCrudActions";
import { useAppScanFlow } from "./useAppScanFlow";

const AppContext = createContext<AppContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

// ── Provider ──

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    return err instanceof Error ? err.message : fallback;
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      let songs;
      if (state.searchQuery.trim()) {
        songs = await api.searchSongs(state.searchQuery);
      } else if (state.sidebarView === "favorites") {
        songs = await api.getFavoritedSongs();
      } else if (state.sidebarView === "drafts") {
        songs = await api.getSongsWithDrafts();
      } else if (state.sidebarView === "not_found") {
        songs = await api.getSongsWithNotFound();
      } else if (
        typeof state.sidebarView === "object" &&
        state.sidebarView.type === "category"
      ) {
        songs = await api.getSongsByCategory(state.sidebarView.id);
      } else {
        songs = await api.getAllSongs();
      }
      dispatch({ type: "SET_SONGS", payload: songs });
    } catch (err) {
      console.error("Failed to load songs:", err);
    }
  }, [state.sidebarView, state.searchQuery]);

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

  useAppBootstrap({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
  });

  const {
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
  } = useAppCrudActions({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
    getErrorMessage,
  });

  const { scanFilesForChanges } = useAppScanFlow({
    dispatch,
    computerType: state.settings?.computer_type,
    loadSongs,
    loadCategories,
    getErrorMessage,
  });

  const value: AppContextValue = useMemo(
    () => ({
      state,
      loadSongs,
      loadCategories,
      loadSettings,
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
      scanFilesForChanges,
    }),
    [
      state,
      loadSongs,
      loadCategories,
      loadSettings,
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
      scanFilesForChanges,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
