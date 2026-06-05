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
    path: `/music/${id}`,
    updated_at: "2024-01-01 12:00:00",
    is_favorite: false,
    status: "main",
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
    status: "main",
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
        { id: "c1", name: "Hinos", updated_at: "2024-01-01 12:00:00", updated_by: "comp-1" },
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
        organization_name: "Orquestra Teste",
        computer_type: "Server",
        google_drive_mode: "Local",
        first_run_completed: false,
        google_service_account: null,
        rclone_config: null,
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

    it("should reset author filters when changing view", () => {
      const stateWithFilters = {
        ...initialState,
        authorFilters: {
          composer: "Bach",
          arranger: "none",
        },
      };
      const state = reducer(stateWithFilters, {
        type: "SET_SIDEBAR_VIEW",
        payload: "favorites",
      });

      expect(state.authorFilters).toEqual({ composer: "all", arranger: "all" });
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

    it("should also update the song in the songs list", () => {
      const song1 = makeSong("s1", "Canon");
      const song2 = makeSong("s2", "Moonlight");
      const stateWithSongs = {
        ...initialState,
        songs: [song1, song2],
        selectedSong: song1,
      };
      const updatedSong = { ...song1, name: "Canon Revised", composer: "Pachelbel" };
      const state = reducer(stateWithSongs, {
        type: "UPDATE_SELECTED_SONG",
        payload: updatedSong,
      });
      expect(state.songs[0].name).toBe("Canon Revised");
      expect(state.songs[0].composer).toBe("Pachelbel");
      expect(state.songs[1].name).toBe("Moonlight");
    });
  });

  describe("SET_SIDEBAR_VIEW", () => {
    it("should reset selectedSong and selectedScore when changing view", () => {
      const stateWithSelections = {
        ...initialState,
        selectedSong: makeSong("s1", "Canon"),
        selectedScore: makeScore("f1", "Violino"),
        sidebarView: "all" as const,
      };
      const state = reducer(stateWithSelections, {
        type: "SET_SIDEBAR_VIEW",
        payload: "favorites",
      });
      expect(state.sidebarView).toBe("favorites");
      expect(state.selectedSong).toBeNull();
      expect(state.selectedScore).toBeNull();
    });

    it("should support category view object", () => {
      const categoryView = { type: "category" as const, id: "c1", name: "Hinos" };
      const state = reducer(initialState, {
        type: "SET_SIDEBAR_VIEW",
        payload: categoryView,
      });
      expect(state.sidebarView).toEqual(categoryView);
    });

    it("should support drafts view", () => {
      const state = reducer(initialState, {
        type: "SET_SIDEBAR_VIEW",
        payload: "drafts",
      });
      expect(state.sidebarView).toBe("drafts");
    });

    it("should support not_found view", () => {
      const state = reducer(initialState, {
        type: "SET_SIDEBAR_VIEW",
        payload: "not_found",
      });
      expect(state.sidebarView).toBe("not_found");
    });

  });

  describe("UPDATE_SIDEBAR_CATEGORY_NAME", () => {
    it("should update the active category label without changing its id", () => {
      const categoryView = { type: "category" as const, id: "c1", name: "Hinos" };
      const stateWithCategoryView = {
        ...initialState,
        sidebarView: categoryView,
      };

      const state = reducer(stateWithCategoryView, {
        type: "UPDATE_SIDEBAR_CATEGORY_NAME",
        payload: { categoryId: "c1", name: "Coral" },
      });

      expect(state.sidebarView).toEqual({ type: "category", id: "c1", name: "Coral" });
    });
  });

  describe("SET_SELECTED_SONG", () => {
    it("should reset selectedScore when selecting a new song", () => {
      const stateWithScore = {
        ...initialState,
        selectedScore: makeScore("f1", "Violino"),
      };
      const state = reducer(stateWithScore, {
        type: "SET_SELECTED_SONG",
        payload: makeSong("s1", "Canon"),
      });
      expect(state.selectedSong?.name).toBe("Canon");
      expect(state.selectedScore).toBeNull();
    });
  });

  describe("TOGGLE_FAVORITE", () => {
    it("should not affect other songs", () => {
      const stateWithSongs = {
        ...initialState,
        songs: [makeSong("s1", "Canon"), makeSong("s2", "Moonlight")],
      };
      const state = reducer(stateWithSongs, {
        type: "TOGGLE_FAVORITE",
        payload: { songId: "s1", isFavorite: true },
      });
      expect(state.songs[0].is_favorite).toBe(true);
      expect(state.songs[1].is_favorite).toBe(false);
    });

    it("should handle unfavoriting", () => {
      const favoriteSong = { ...makeSong("s1", "Canon"), is_favorite: true };
      const stateWithFavorite = {
        ...initialState,
        songs: [favoriteSong],
      };
      const state = reducer(stateWithFavorite, {
        type: "TOGGLE_FAVORITE",
        payload: { songId: "s1", isFavorite: false },
      });
      expect(state.songs[0].is_favorite).toBe(false);
    });
  });

  describe("SET_SCANNING_FILES", () => {
    it("should set scanning state", () => {
      const state = reducer(initialState, {
        type: "SET_SCANNING_FILES",
        payload: true,
      });
      expect(state.isScanningFiles).toBe(true);
    });

    it("should turn off scanning state", () => {
      const scanningState = { ...initialState, isScanningFiles: true };
      const state = reducer(scanningState, {
        type: "SET_SCANNING_FILES",
        payload: false,
      });
      expect(state.isScanningFiles).toBe(false);
    });
  });

  describe("SET_SCAN_PROGRESS", () => {
    it("should update scan progress", () => {
      const progress = { total: 50, completed: 25, changedFiles: 3 };
      const state = reducer(initialState, {
        type: "SET_SCAN_PROGRESS",
        payload: progress,
      });
      expect(state.scanProgress).toEqual(progress);
    });

    it("should reset scan progress", () => {
      const stateWithProgress = {
        ...initialState,
        scanProgress: { total: 50, completed: 50, changedFiles: 5 },
      };
      const state = reducer(stateWithProgress, {
        type: "SET_SCAN_PROGRESS",
        payload: { total: 0, completed: 0, changedFiles: 0 },
      });
      expect(state.scanProgress).toEqual({ total: 0, completed: 0, changedFiles: 0 });
    });
  });

  describe("unknown action", () => {
    it("should return the same state for unknown actions", () => {
      const state = reducer(initialState, { type: "UNKNOWN_ACTION" } as never);
      expect(state).toBe(initialState);
    });
  });
});
