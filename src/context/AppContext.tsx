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
  updateScoreStatus: (
    scoreId: string,
    status: "main"
  ) => Promise<void>;
  deleteScore: (scoreId: string) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  completeFirstRun: (
    computerId: string,
    computerName: string,
    computerType: string,
    googleDriveMode: string,
    googleServiceAccountJson?: string | null,
    rcloneConfigJson?: string | null
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

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    return err instanceof Error ? err.message : fallback;
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      let songs: SongListItem[];
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

  // Initialize app
  useEffect(() => {
    (async () => {
      try {
        const firstRun = await api.isFirstRun();
        dispatch({ type: "SET_FIRST_RUN", payload: firstRun });

        if (!firstRun) {
          // Carregar dados imediatamente
          await Promise.all([loadSongs(), loadCategories(), loadSettings()]);
          
          // Fazer polling para aguardar scan inicial terminar
          const checkScanCompleted = async () => {
            let attempts = 0;
            const maxAttempts = 60; // 60 segundos máximo
            
            while (attempts < maxAttempts) {
              const completed = await api.isInitialScanCompleted();
              if (completed) {
                console.log("Initial scan completed, reloading data...");
                await loadSongs();
                break;
              }
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000)); // Verificar a cada 1 segundo
            }
          };
          
          checkScanCompleted();
        }
      } catch (err) {
        console.error("Failed to initialize app:", err);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-load songs when sidebar or search changes
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
  }, [state.settings?.computer_type]);

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
        toast.error(getErrorMessage(err, "Erro ao atualizar música"));
        throw err;
      }
    },
    [loadSongs, loadCategories, getErrorMessage]
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
        toast.error(getErrorMessage(err, "Erro ao atualizar partitura"));
        throw err;
      }
    },
    [state.selectedScore, loadSongs, getErrorMessage]
  );

  const handleUpdateScoreStatus = useCallback(
    async (
      scoreId: string,
      status: "main"
    ) => {
      try {
        const updatedSong = await api.updateScoreStatus(scoreId, status);
        
        // Atualizar a música selecionada com os dados atualizados
        dispatch({ type: "UPDATE_SELECTED_SONG", payload: updatedSong });
        
        // Atualizar a lista de músicas
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
    },
    [state.songs, getErrorMessage]
  );

  const handleDeleteScore = useCallback(
    async (scoreId: string) => {
      try {
        await api.deleteScore(scoreId);
        
        // Limpar a seleção se o score deletado estava selecionado
        if (state.selectedScore?.id === scoreId) {
          dispatch({ type: "SET_SELECTED_SCORE", payload: null });
        }
        
        // Recarregar a lista de músicas
        await loadSongs();
        toast.success("Partitura deletada com sucesso!");
      } catch (err) {
        console.error("Failed to delete score:", err);
        toast.error(getErrorMessage(err, "Erro ao deletar partitura"));
        throw err;
      }
    },
    [state.selectedScore, loadSongs, getErrorMessage]
  );

  const handleDeleteSong = useCallback(
    async (songId: string) => {
      try {
        await api.deleteSong(songId);
        
        // Limpar a seleção se a música deletada estava selecionada
        if (state.selectedSong?.id === songId) {
          dispatch({ type: "SET_SELECTED_SONG", payload: null });
        }
        dispatch({ type: "SET_SELECTED_SCORE", payload: null });
        
        // Recarregar a lista de músicas
        await loadSongs();
        toast.success("Música deletada com sucesso!");
      } catch (err) {
        console.error("Failed to delete song:", err);
        toast.error(getErrorMessage(err, "Erro ao deletar música"));
        throw err;
      }
    },
    [state.selectedSong, loadSongs, getErrorMessage]
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
    async (computerId: string, computerName: string, computerType: string, googleDriveMode: string, googleServiceAccountJson?: string | null, rcloneConfigJson?: string | null) => {
      try {
        await api.completeFirstRun(computerId, computerName, computerType, googleDriveMode, googleServiceAccountJson, rcloneConfigJson);
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
        // Bloquear cliente de verificar alterações
        if (state.settings?.computer_type === "Client") {
          if (!isAutomatic) {
            toast("Funcionalidade não implementada para cliente", {
              icon: "ℹ️",
            });
          }
          return;
        }

        dispatch({ type: "SET_SCANNING_FILES", payload: true });
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: { total: 0, completed: 0, changedFiles: 0 },
        });

        const result = await api.scanFilesForChanges();
        const archiveSummary = await api.generateSongArchivesFiles();
        const eventsSummary = await api.generateEventsFile();
        const changedCount = result.changed_files.length;
        const failedCount = result.failed_files.length;
        const recoveredCount = result.recovered_files?.length ?? 0;
        const notFoundCount = result.not_found_files?.length ?? 0;
        const generatedArchives = archiveSummary.generated ?? 0;
        const failedArchives = archiveSummary.failed ?? 0;
        const generatedEventsCount = eventsSummary.events_count ?? 0;

        const totalFiles = changedCount + failedCount;
        dispatch({
          type: "SET_SCAN_PROGRESS",
          payload: {
            total: totalFiles,
            completed: totalFiles,
            changedFiles: changedCount,
          },
        });

        // Verificar se há arquivos recuperados (não mais not_found)
        if (recoveredCount > 0) {
          if (!isAutomatic) {
            toast.success(
              `✓ ${recoveredCount} arquivo(s) encontrado(s) novamente`
            );
          }
        }

        // Verificar se há arquivos não encontrados (marcados como not_found)
        if (notFoundCount > 0) {
          if (!isAutomatic) {
            toast(
              `⚠ ${notFoundCount} arquivo(s) não encontrado(s)`,
              { icon: "⚠️" }
            );
          }
        }

        if (changedCount > 0) {
          if (!isAutomatic) {
            toast.success(
              `${changedCount} arquivo(s) alterado(s) detectado(s)`
            );
          }
        } else if (!isAutomatic && recoveredCount === 0 && notFoundCount === 0) {
          toast.success("Nenhuma alteração detectada");
        }

        if (failedCount > 0) {
          if (!isAutomatic) {
            toast.error(
              `${failedCount} arquivo(s) falharam durante verificação`
            );
          }
        }

        if (!isAutomatic && generatedArchives > 0) {
          toast.success(`${generatedArchives} arquivo(s) .tar.zst gerado(s)`);
        }

        if (!isAutomatic && failedArchives > 0) {
          toast.error(`${failedArchives} arquivo(s) .tar.zst falharam ao gerar`);
        }

        if (!isAutomatic) {
          toast.success(`events.msgpack.zst atualizado com ${generatedEventsCount} evento(s)`);
        }

        if (changedCount > 0 || recoveredCount > 0 || notFoundCount > 0) {
          await loadSongs();
        }

        // Limpar progresso após tempo apropriado
        const delay = changedCount > 0 || recoveredCount > 0 ? 3000 : 1500;
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
      updateScoreStatus: handleUpdateScoreStatus,
      deleteScore: handleDeleteScore,
      deleteSong: handleDeleteSong,
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
      handleUpdateScoreStatus,
      handleDeleteScore,
      handleDeleteSong,
      handleSaveSettings,
      handleCompleteFirstRun,
      handleScanFilesForChanges,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
