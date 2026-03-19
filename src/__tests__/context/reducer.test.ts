import { describe, it, expect } from "vitest";
import type {
  SongListItem,
  ScoreListItem,
  Category,
  AppSettings,
} from "../../types";
import { reducer, initialState } from "../../context/reducer";

// ── Helpers ──

function makeSong(id: string, name: string): SongListItem {
  return {
    id,
    name,
    composer: null,
    arranger: null,
    updated_at: "2024-01-01 12:00:00",
    is_favorite: false,
    category_ids: [],
    scores: [],
  };
}

function makeScore(id: string, name: string): ScoreListItem {
  return {
    id,
    name,
    file_path: "/path/to/file.pdf",
    file_extension: "pdf",
    updated_at: "2024-01-01 12:00:00",
    status: "Main",
  };
}

// ── Tests ──

describe("AppContext Reducer", () => {
  describe("initialState", () => {
    it("should have correct defaults", () => {
      expect(initialState.songs).toEqual([]);
      expect(initialState.categories).toEqual([]);
      expect(initialState.settings).toBeNull();
      expect(initialState.sidebarView).toBe("all");
      expect(initialState.selectedSong).toBeNull();
      expect(initialState.selectedScore).toBeNull();
      expect(initialState.searchQuery).toBe("");
      expect(initialState.isFirstRun).toBe(false);
      expect(initialState.isLoading).toBe(true);
    });
  });

  describe("SET_SONGS", () => {
    it("should set songs", () => {
      const songs = [makeSong("s1", "Canon"), makeSong("s2", "Moonlight")];
      const state = reducer(initialState, {
        type: "SET_SONGS",
        payload: songs,
      });
      expect(state.songs).toHaveLength(2);
      expect(state.songs[0].name).toBe("Canon");
    });
  });

  describe("SET_CATEGORIES", () => {
    it("should set categories", () => {
      const cats: Category[] = [
        { id: "c1", name: "Hinos" },
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
        google_drive_mode: "Local",
        first_run_completed: false,
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
    it("should change view", () => {
      const state = reducer(initialState, {
        type: "SET_SIDEBAR_VIEW",
        payload: "favorites",
      });
      expect(state.sidebarView).toBe("favorites");
    });
  });

  describe("SET_SELECTED_SONG", () => {
    it("should select song", () => {
      const song = makeSong("s1", "Canon");
      const state = reducer(initialState, {
        type: "SET_SELECTED_SONG",
        payload: song,
      });
      expect(state.selectedSong).toEqual(song);
    });

    it("should deselect when null", () => {
      const stateWithSong = {
        ...initialState,
        selectedSong: makeSong("s1", "Canon"),
      };
      const state = reducer(stateWithSong, {
        type: "SET_SELECTED_SONG",
        payload: null,
      });
      expect(state.selectedSong).toBeNull();
    });
  });

  describe("SET_SELECTED_SCORE", () => {
    it("should select score", () => {
      const score = makeScore("f1", "Violino");
      const state = reducer(initialState, {
        type: "SET_SELECTED_SCORE",
        payload: score,
      });
      expect(state.selectedScore).toEqual(score);
    });

    it("should deselect when null", () => {
      const stateWithScore = {
        ...initialState,
        selectedScore: makeScore("f1", "Violino"),
      };
      const state = reducer(stateWithScore, {
        type: "SET_SELECTED_SCORE",
        payload: null,
      });
      expect(state.selectedScore).toBeNull();
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
    it("should toggle favorite for song", () => {
      const stateWithSongs = {
        ...initialState,
        songs: [makeSong("s1", "Canon"), makeSong("s2", "Moonlight")],
      };
      const state = reducer(stateWithSongs, {
        type: "TOGGLE_FAVORITE",
        payload: { songId: "s1", isFavorite: true },
      });
      expect(state.songs[0].is_favorite).toBe(true);
    });
  });

  describe("UPDATE_SELECTED_SONG", () => {
    it("should update selected song", () => {
      const originalSong = makeSong("s1", "Canon");
      const stateWithSong = {
        ...initialState,
        selectedSong: originalSong,
      };
      const updatedSong = { ...originalSong, name: "Canon Updated" };
      const state = reducer(stateWithSong, {
        type: "UPDATE_SELECTED_SONG",
        payload: updatedSong,
      });
      expect(state.selectedSong?.name).toBe("Canon Updated");
    });
  });
});
