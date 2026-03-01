import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  ScoreListItem,
  ScoreFileItem,
  FileVersion,
  Category,
  AppSettings,
  SidebarView,
} from "../types";
import * as api from "../api/commands";

// ── State ──

interface State {
  scores: ScoreListItem[];
  categories: Category[];
  settings: AppSettings | null;
  sidebarView: SidebarView;
  selectedScore: ScoreListItem | null;
  selectedFile: ScoreFileItem | null;
  versions: FileVersion[];
  searchQuery: string;
  isFirstRun: boolean;
  isLoading: boolean;
}

const initialState: State = {
  scores: [],
  categories: [],
  settings: null,
  sidebarView: "all",
  selectedScore: null,
  selectedFile: null,
  versions: [],
  searchQuery: "",
  isFirstRun: false,
  isLoading: true,
};

// ── Actions ──

type Action =
  | { type: "SET_SCORES"; payload: ScoreListItem[] }
  | { type: "SET_CATEGORIES"; payload: Category[] }
  | { type: "SET_SETTINGS"; payload: AppSettings }
  | { type: "SET_SIDEBAR_VIEW"; payload: SidebarView }
  | { type: "SET_SELECTED_SCORE"; payload: ScoreListItem | null }
  | { type: "SET_SELECTED_FILE"; payload: ScoreFileItem | null }
  | { type: "SET_VERSIONS"; payload: FileVersion[] }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_FIRST_RUN"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "TOGGLE_FAVORITE"; payload: { scoreId: string; favorited: boolean } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SCORES":
      return { ...state, scores: action.payload };
    case "SET_CATEGORIES":
      return { ...state, categories: action.payload };
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };
    case "SET_SIDEBAR_VIEW":
      return {
        ...state,
        sidebarView: action.payload,
        selectedScore: null,
        selectedFile: null,
        versions: [],
      };
    case "SET_SELECTED_SCORE":
      return {
        ...state,
        selectedScore: action.payload,
        selectedFile: null,
        versions: [],
      };
    case "SET_SELECTED_FILE":
      return { ...state, selectedFile: action.payload };
    case "SET_VERSIONS":
      return { ...state, versions: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
    case "SET_FIRST_RUN":
      return { ...state, isFirstRun: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "TOGGLE_FAVORITE":
      return {
        ...state,
        scores: state.scores.map((s) =>
          s.id === action.payload.scoreId
            ? { ...s, favorited: action.payload.favorited }
            : s
        ),
      };
    default:
      return state;
  }
}

// ── Context ──

interface AppContextValue {
  state: State;
  loadScores: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setSidebarView: (view: SidebarView) => void;
  selectScore: (score: ScoreListItem | null) => void;
  selectFile: (file: ScoreFileItem | null) => void;
  loadVersions: (scoreFileId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  toggleFavorite: (scoreId: string) => Promise<void>;
  promoteDraft: (versionId: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  completeFirstRun: (
    organizationName: string | null,
    googleDriveMode: string
  ) => Promise<void>;
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

  const loadScores = useCallback(async () => {
    try {
      let scores: ScoreListItem[];
      if (state.searchQuery.trim()) {
        scores = await api.searchScores(state.searchQuery);
      } else if (state.sidebarView === "favorites") {
        scores = await api.getFavoritedScores();
      } else if (state.sidebarView === "drafts") {
        scores = await api.getScoresWithDrafts();
      } else if (
        typeof state.sidebarView === "object" &&
        state.sidebarView.type === "category"
      ) {
        scores = await api.getScoresByCategory(state.sidebarView.id);
      } else {
        scores = await api.getAllScores();
      }
      dispatch({ type: "SET_SCORES", payload: scores });
    } catch (err) {
      console.error("Failed to load scores:", err);
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

  const loadVersions = useCallback(async (scoreFileId: string) => {
    try {
      const versions = await api.getVersions(scoreFileId);
      dispatch({ type: "SET_VERSIONS", payload: versions });
    } catch (err) {
      console.error("Failed to load versions:", err);
    }
  }, []);

  // Initialize app
  useEffect(() => {
    (async () => {
      try {
        const firstRun = await api.isFirstRun();
        dispatch({ type: "SET_FIRST_RUN", payload: firstRun });

        if (!firstRun) {
          await Promise.all([loadScores(), loadCategories(), loadSettings()]);
        }
      } catch (err) {
        console.error("Failed to initialize app:", err);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload scores when sidebar view or search query changes
  useEffect(() => {
    if (!state.isFirstRun && !state.isLoading) {
      loadScores();
    }
  }, [state.sidebarView, state.searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSidebarView = useCallback((view: SidebarView) => {
    dispatch({ type: "SET_SIDEBAR_VIEW", payload: view });
    dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
  }, []);

  const selectScore = useCallback((score: ScoreListItem | null) => {
    dispatch({ type: "SET_SELECTED_SCORE", payload: score });
  }, []);

  const selectFile = useCallback(
    (file: ScoreFileItem | null) => {
      dispatch({ type: "SET_SELECTED_FILE", payload: file });
      if (file) {
        loadVersions(file.id);
      } else {
        dispatch({ type: "SET_VERSIONS", payload: [] });
      }
    },
    [loadVersions]
  );

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: query });
  }, []);

  const handleToggleFavorite = useCallback(async (scoreId: string) => {
    try {
      const favorited = await api.toggleFavorite(scoreId);
      dispatch({
        type: "TOGGLE_FAVORITE",
        payload: { scoreId, favorited },
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }, []);

  const handlePromoteDraft = useCallback(
    async (versionId: string) => {
      try {
        await api.promoteDraft(versionId);
        if (state.selectedFile) {
          await loadVersions(state.selectedFile.id);
        }
        await loadScores();
      } catch (err) {
        console.error("Failed to promote draft:", err);
      }
    },
    [state.selectedFile, loadVersions, loadScores]
  );

  const handleDeleteVersion = useCallback(
    async (versionId: string) => {
      try {
        await api.deleteVersion(versionId);
        if (state.selectedFile) {
          await loadVersions(state.selectedFile.id);
        }
      } catch (err) {
        console.error("Failed to delete version:", err);
      }
    },
    [state.selectedFile, loadVersions]
  );

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

  const handleSaveSettings = useCallback(
    async (settings: AppSettings) => {
      try {
        await api.saveSettings(settings);
        dispatch({ type: "SET_SETTINGS", payload: settings });
      } catch (err) {
        console.error("Failed to save settings:", err);
      }
    },
    []
  );

  const handleCompleteFirstRun = useCallback(
    async (organizationName: string | null, googleDriveMode: string) => {
      try {
        await api.completeFirstRun(organizationName, googleDriveMode);
        dispatch({ type: "SET_FIRST_RUN", payload: false });
        await Promise.all([loadScores(), loadCategories(), loadSettings()]);
      } catch (err) {
        console.error("Failed to complete first run:", err);
      }
    },
    [loadScores, loadCategories, loadSettings]
  );

  const value: AppContextValue = {
    state,
    loadScores,
    loadCategories,
    loadSettings,
    setSidebarView,
    selectScore,
    selectFile,
    loadVersions,
    setSearchQuery,
    toggleFavorite: handleToggleFavorite,
    promoteDraft: handlePromoteDraft,
    deleteVersion: handleDeleteVersion,
    createCategory: handleCreateCategory,
    deleteCategory: handleDeleteCategory,
    saveSettings: handleSaveSettings,
    completeFirstRun: handleCompleteFirstRun,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
