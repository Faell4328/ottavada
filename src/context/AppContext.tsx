import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import type {
  SongListItem,
  ScoreListItem,
  AppSettings,
  SidebarView,
} from "../types";
import * as api from "../api/commands";
import { type State, initialState, reducer } from "./reducer";

// ── Context ──

interface AppContextValue {
  state: State;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setSidebarView: (view: SidebarView) => void;
  selectSong: (song: SongListItem | null) => void;
  selectScore: (score: ScoreListItem | null) => void;
  setSearchQuery: (query: string) => void;
  toggleFavorite: (songId: string) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSong: (
    songId: string,
    name: string,
    composer: string | null,
    arranger: string | null,
    categoryIds: string[]
  ) => Promise<void>;
  updateScore: (
    scoreId: string,
    instrumentName: string | null,
    filePath: string
  ) => Promise<void>;
  completeFirstRun: (
    computerId: string,
    computerName: string,
    googleDriveMode: string,
    googleServiceAccountJson?: string | null
  ) => Promise<void>;
  scanFilesForChanges: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

// ── Provider ──

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSongs = useCallback(async () => {
    try {
      let songs: SongListItem[];
      if (state.searchQuery.trim()) {
        songs = await api.searchSongs(state.searchQuery);
      } else if (state.sidebarView === "favorites") {
        songs = await api.getFavoritedSongs();
      } else if (state.sidebarView === "drafts") {
        songs = await api.getSongsWithDrafts();
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

  // Initialize app
  useEffect(() => {
    (async () => {
      try {
        const firstRun = await api.isFirstRun();
        dispatch({ type: "SET_FIRST_RUN", payload: firstRun });

        if (!firstRun) {
          await Promise.all([loadSongs(), loadCategories(), loadSettings()]);
          // Iniciar verificação de alterações após carregar os dados
          setTimeout(() => {
            handleScanFilesForChanges(true);
          }, 500);
        }
      } catch (err) {
        console.error("Failed to initialize app:", err);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.isFirstRun && !state.isLoading) {
      loadSongs();
    }
  }, [state.sidebarView, state.searchQuery, state.isFirstRun, state.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSidebarView = useCallback((view: SidebarView) => {
    dispatch({ type: "SET_SIDEBAR_VIEW", payload: view });
    dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
  }, []);

  const selectSong = useCallback((song: SongListItem | null) => {
    dispatch({ type: "SET_SELECTED_SONG", payload: song });
  }, []);

  const selectScore = useCallback((score: ScoreListItem | null) => {
    dispatch({ type: "SET_SELECTED_SCORE", payload: score });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: query });
  }, []);

  const handleToggleFavorite = useCallback(async (songId: string) => {
    try {
      const isFavorite = await api.toggleFavorite(songId);
      dispatch({
        type: "TOGGLE_FAVORITE",
        payload: { songId, isFavorite },
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }, []);

  const handleCreateCategory = useCallback(
    async (name: string) => {
      try {
        await api.createCategory(name);
        await loadCategories();
      } catch (err) {
        console.error("Failed to create category:", err);
      }
    },
    [loadCategories]
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
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
    },
    [loadCategories, state.sidebarView]
  );

  const handleUpdateSong = useCallback(
    async (
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
        const errorMsg = err instanceof Error ? err.message : "Erro ao atualizar música";
        toast.error(errorMsg);
        throw err;
      }
    },
    [loadSongs, loadCategories]
  );

  const handleUpdateScore = useCallback(
    async (
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
        const errorMsg = err instanceof Error ? err.message : "Erro ao atualizar partitura";
        toast.error(errorMsg);
        throw err;
      }
    },
    [state.selectedScore, loadSongs]
  );

  const handleSaveSettings = useCallback(
    async (settings: AppSettings) => {
      try {
        await api.saveSettings(settings);
        dispatch({ type: "SET_SETTINGS", payload: settings });
        toast.success("Configurações salvas com sucesso!");
      } catch (err) {
        console.error("Failed to save settings:", err);
        toast.error("Erro ao salvar configurações");
      }
    },
    []
  );

  const handleCompleteFirstRun = useCallback(
    async (computerId: string, computerName: string, googleDriveMode: string, googleServiceAccountJson?: string | null) => {
      try {
        await api.completeFirstRun(computerId, computerName, googleDriveMode, googleServiceAccountJson);
        dispatch({ type: "SET_FIRST_RUN", payload: false });
        await Promise.all([loadSongs(), loadCategories(), loadSettings()]);
        toast.success("Configuração inicial concluída!");
      } catch (err) {
        console.error("Failed to complete first run:", err);
        toast.error("Erro ao completar configuração inicial");
      }
    },
    [loadSongs, loadCategories, loadSettings]
  );

  const handleScanFilesForChanges = useCallback(
    async (isAutomatic: boolean = false) => {
      try {
        dispatch({ type: "SET_SCANNING_FILES", payload: true });
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: { total: 0, completed: 0, changedFiles: 0 },
        });

        const result = await api.scanFilesForChanges();

        const totalFiles = result.changed_files.length + result.failed_files.length;
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: {
            total: totalFiles,
            completed: totalFiles,
            changedFiles: result.changed_files.length,
          },
        });

        if (result.changed_files.length > 0) {
          if (!isAutomatic) {
            toast.success(
              `${result.changed_files.length} arquivo(s) alterado(s) detectado(s)`
            );
          }
          await loadSongs();
        } else if (!isAutomatic) {
          toast.success("Nenhuma alteração detectada");
        }

        if (result.failed_files.length > 0) {
          if (!isAutomatic) {
            toast.error(
              `${result.failed_files.length} arquivo(s) falharam durante verificação`
            );
          }
        }

        // Limpar progresso após tempo apropriado
        const delay = result.changed_files.length > 0 ? 3000 : 1500;
        setTimeout(() => {
          dispatch({ type: "SET_SCANNING_FILES", payload: false });
          dispatch({
            type: "SET_SCAN_PROGRESS",
            payload: { total: 0, completed: 0, changedFiles: 0 },
          });
        }, delay);
      } catch (err) {
        console.error("Failed to scan files for changes:", err);
        if (!isAutomatic) {
          toast.error("Erro ao verificar alterações nos arquivos");
        }
        dispatch({ type: "SET_SCANNING_FILES", payload: false });
      }
    },
    [loadSongs]
  );

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
      toggleFavorite: handleToggleFavorite,
      createCategory: handleCreateCategory,
      deleteCategory: handleDeleteCategory,
      updateSong: handleUpdateSong,
      updateScore: handleUpdateScore,
      saveSettings: handleSaveSettings,
      completeFirstRun: handleCompleteFirstRun,
      scanFilesForChanges: handleScanFilesForChanges,
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
      handleToggleFavorite,
      handleCreateCategory,
      handleDeleteCategory,
      handleUpdateSong,
      handleUpdateScore,
      handleSaveSettings,
      handleCompleteFirstRun,
      handleScanFilesForChanges,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
