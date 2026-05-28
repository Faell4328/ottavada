import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  useRef,
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
  const startupScanTriggeredRef = useRef(false);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    const message = extractErrorMessage(err);
    return message === "Erro desconhecido" ? fallback : message;
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      const songs = await (async () => {
        if (state.sidebarView === "favorites") return api.getFavoritedSongSummaries();
        if (state.sidebarView === "drafts") return api.getSongSummariesWithDrafts();

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
  }) => {
    dispatch({ type: "SET_OPERATION_STATUS", payload });
  }, [dispatch]);

  const resetOperationStatus = useCallback(() => {
    dispatch({ type: "RESET_OPERATION_STATUS" });
  }, [dispatch]);

  const resetScanReport = useCallback(() => {
    dispatch({ type: "RESET_SCAN_REPORT" });
  }, [dispatch]);

  useAppBootstrap({
    state,
    dispatch,
    loadSongs,
    loadCategories,
    loadSettings,
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
    deleteCategory,
    updateSong,
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

  const { previewScanFilesForChanges, scanFilesForChanges } = useAppScanFlow({
    dispatch,
    computerType: state.settings?.computer_type,
    loadSongs,
    loadCategories,
    loadSettings,
    refreshSelectedSong,
    getErrorMessage,
  });

  useEffect(() => {
    if (startupScanTriggeredRef.current) {
      return;
    }

    if (state.isLoading || state.isFirstRun || !state.settings) {
      return;
    }

    if (state.settings.computer_type !== "Server" && state.settings.computer_type !== "Client") {
      return;
    }

    startupScanTriggeredRef.current = true;

    if (state.settings.computer_type === "Server") {
      return;
    }

    void (async () => {
      void scanFilesForChanges({ isAutomatic: true });
    })();
  }, [state.isLoading, state.isFirstRun, state.settings, scanFilesForChanges]);

  const value: AppContextValue = useMemo(
    () => ({
      state,
      loadSongs,
      loadCategories,
      loadSettings,
      refreshSelectedSong,
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
      deleteCategory,
      updateSong,
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
      loadSongs,
      loadCategories,
      loadSettings,
      refreshSelectedSong,
      setOperationStatus,
      resetOperationStatus,
      resetScanReport,
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
      useScoreAsBase,
      saveSettings,
      completeFirstRun,
      previewScanFilesForChanges,
      scanFilesForChanges,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
