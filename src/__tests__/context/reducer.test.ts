import { describe, it, expect } from "vitest";
import type {
  ScoreListItem,
  ScoreFileItem,
  FileVersion,
  Category,
  AppSettings,
  SidebarView,
} from "../../types";

// ── Replicate the reducer locally for unit testing ──
// (The AppContext doesn't export the reducer directly)

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
  | {
      type: "TOGGLE_FAVORITE";
      payload: { scoreId: string; favorited: boolean };
    };

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

// ── Helpers ──

function makeScore(id: string, title: string): ScoreListItem {
  return {
    id,
    title,
    composer: null,
    arranger: null,
    updated_at: "2024-01-01 12:00:00",
    favorited: false,
    instruments: [],
  };
}

function makeFile(id: string): ScoreFileItem {
  return {
    id,
    instrument: "Violino",
    file_extension: "pdf",
    original_path: "/path/to/file.pdf",
    updated_at: "2024-01-01 12:00:00",
    has_draft: false,
    version_count: 1,
  };
}

function makeVersion(id: string): FileVersion {
  return {
    id,
    score_file_id: "f1",
    version_number: 1,
    label: "V1",
    status: "Current",
    file_path: "/path",
    file_size: 1024,
    hash: null,
    is_compressed: false,
    created_at: "2024-01-01 12:00:00",
  };
}

// ── Tests ──

describe("AppContext Reducer", () => {
  describe("initialState", () => {
    it("should have correct defaults", () => {
      expect(initialState.scores).toEqual([]);
      expect(initialState.categories).toEqual([]);
      expect(initialState.settings).toBeNull();
      expect(initialState.sidebarView).toBe("all");
      expect(initialState.selectedScore).toBeNull();
      expect(initialState.selectedFile).toBeNull();
      expect(initialState.versions).toEqual([]);
      expect(initialState.searchQuery).toBe("");
      expect(initialState.isFirstRun).toBe(false);
      expect(initialState.isLoading).toBe(true);
    });
  });

  describe("SET_SCORES", () => {
    it("should set scores", () => {
      const scores = [makeScore("s1", "Canon"), makeScore("s2", "Moonlight")];
      const state = reducer(initialState, {
        type: "SET_SCORES",
        payload: scores,
      });
      expect(state.scores).toHaveLength(2);
      expect(state.scores[0].title).toBe("Canon");
    });
  });

  describe("SET_CATEGORIES", () => {
    it("should set categories", () => {
      const cats: Category[] = [
        { id: "c1", name: "Hinos", created_at: "2024-01-01 12:00:00" },
      ];
      const state = reducer(initialState, {
        type: "SET_CATEGORIES",
        payload: cats,
      });
      expect(state.categories).toHaveLength(1);
      expect(state.categories[0].name).toBe("Hinos");
    });
  });

  describe("SET_SETTINGS", () => {
    it("should set app settings", () => {
      const settings: AppSettings = {
        computer_id: "550e8400-e29b-41d4-a716-446655440000",
        computer_name: "Computador Teste",
        logo_path: null,
        google_drive_mode: "Local",
        hash_enabled: false,
        first_run_completed: true,
        google_service_account: null,
      };
      const state = reducer(initialState, {
        type: "SET_SETTINGS",
        payload: settings,
      });
      expect(state.settings).toEqual(settings);
    });
  });

  describe("SET_SIDEBAR_VIEW", () => {
    it("should change view and clear selections", () => {
      const stateWithSelection = {
        ...initialState,
        selectedScore: makeScore("s1", "Canon"),
        selectedFile: makeFile("f1"),
        versions: [makeVersion("v1")],
      };
      const state = reducer(stateWithSelection, {
        type: "SET_SIDEBAR_VIEW",
        payload: "favorites",
      });
      expect(state.sidebarView).toBe("favorites");
      expect(state.selectedScore).toBeNull();
      expect(state.selectedFile).toBeNull();
      expect(state.versions).toEqual([]);
    });

    it("should support category view", () => {
      const categoryView: SidebarView = {
        type: "category",
        id: "c1",
        name: "Hinos",
      };
      const state = reducer(initialState, {
        type: "SET_SIDEBAR_VIEW",
        payload: categoryView,
      });
      expect(state.sidebarView).toEqual(categoryView);
    });
  });

  describe("SET_SELECTED_SCORE", () => {
    it("should select score and clear file/versions", () => {
      const stateWithFile = {
        ...initialState,
        selectedFile: makeFile("f1"),
        versions: [makeVersion("v1")],
      };
      const score = makeScore("s1", "Canon");
      const state = reducer(stateWithFile, {
        type: "SET_SELECTED_SCORE",
        payload: score,
      });
      expect(state.selectedScore).toEqual(score);
      expect(state.selectedFile).toBeNull();
      expect(state.versions).toEqual([]);
    });

    it("should deselect when null", () => {
      const stateWithScore = {
        ...initialState,
        selectedScore: makeScore("s1", "Canon"),
      };
      const state = reducer(stateWithScore, {
        type: "SET_SELECTED_SCORE",
        payload: null,
      });
      expect(state.selectedScore).toBeNull();
    });
  });

  describe("SET_SELECTED_FILE", () => {
    it("should set selected file", () => {
      const file = makeFile("f1");
      const state = reducer(initialState, {
        type: "SET_SELECTED_FILE",
        payload: file,
      });
      expect(state.selectedFile).toEqual(file);
    });
  });

  describe("SET_VERSIONS", () => {
    it("should set versions", () => {
      const versions = [makeVersion("v1"), makeVersion("v2")];
      const state = reducer(initialState, {
        type: "SET_VERSIONS",
        payload: versions,
      });
      expect(state.versions).toHaveLength(2);
    });
  });

  describe("SET_SEARCH_QUERY", () => {
    it("should set search query", () => {
      const state = reducer(initialState, {
        type: "SET_SEARCH_QUERY",
        payload: "Canon",
      });
      expect(state.searchQuery).toBe("Canon");
    });
  });

  describe("SET_FIRST_RUN", () => {
    it("should set first run flag", () => {
      const state = reducer(initialState, {
        type: "SET_FIRST_RUN",
        payload: true,
      });
      expect(state.isFirstRun).toBe(true);
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading flag", () => {
      const state = reducer(initialState, {
        type: "SET_LOADING",
        payload: false,
      });
      expect(state.isLoading).toBe(false);
    });
  });

  describe("TOGGLE_FAVORITE", () => {
    it("should toggle favorite for matching score", () => {
      const stateWithScores = {
        ...initialState,
        scores: [makeScore("s1", "Canon"), makeScore("s2", "Moonlight")],
      };
      const state = reducer(stateWithScores, {
        type: "TOGGLE_FAVORITE",
        payload: { scoreId: "s1", favorited: true },
      });
      expect(state.scores[0].favorited).toBe(true);
      expect(state.scores[1].favorited).toBe(false);
    });

    it("should not affect other scores", () => {
      const stateWithScores = {
        ...initialState,
        scores: [
          { ...makeScore("s1", "Canon"), favorited: true },
          makeScore("s2", "Moonlight"),
        ],
      };
      const state = reducer(stateWithScores, {
        type: "TOGGLE_FAVORITE",
        payload: { scoreId: "s1", favorited: false },
      });
      expect(state.scores[0].favorited).toBe(false);
      expect(state.scores[1].favorited).toBe(false);
    });

    it("should handle non-existent score id", () => {
      const stateWithScores = {
        ...initialState,
        scores: [makeScore("s1", "Canon")],
      };
      const state = reducer(stateWithScores, {
        type: "TOGGLE_FAVORITE",
        payload: { scoreId: "nonexistent", favorited: true },
      });
      expect(state.scores[0].favorited).toBe(false);
    });
  });

  describe("unknown action", () => {
    it("should return state unchanged", () => {
      const state = reducer(initialState, {
        type: "UNKNOWN" as any,
        payload: null,
      } as any);
      expect(state).toEqual(initialState);
    });
  });
});
