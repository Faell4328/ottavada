import type {
  SongListItem,
  ScoreListItem,
  Category,
  AppSettings,
  SidebarView,
} from "../types";
import type { ScanResult } from "../api/commands";

// ── State ──

export interface State {
  songs: SongListItem[];
  categories: Category[];
  settings: AppSettings | null;
  sidebarView: SidebarView;
  selectedSong: SongListItem | null;
  selectedScore: ScoreListItem | null;
  searchQuery: string;
  authorFilters: {
    composer: string;
    arranger: string;
  };
  isFirstRun: boolean;
  isLoading: boolean;
  isScanningFiles: boolean;
  scanProgress: {
    total: number;
    completed: number;
    changedFiles: number;
  };
  scanReport: ScanResult | null;
  rcloneProgress: {
    active: boolean;
    direction: "upload" | "download" | null;
    bytes: number;
    totalBytes: number | null;
    percentage: number | null;
    speedBytesPerSec: number;
    etaSeconds: number | null;
  };
  operationStatus: {
    title: string;
    detail: string | null;
    stepCurrent: number | null;
    stepTotal: number | null;
    itemCurrent: number | null;
    itemTotal: number | null;
  };
}

export const initialState: State = {
  songs: [],
  categories: [],
  settings: null,
  sidebarView: "all",
  selectedSong: null,
  selectedScore: null,
  searchQuery: "",
  authorFilters: {
    composer: "all",
    arranger: "all",
  },
  isFirstRun: false,
  isLoading: true,
  isScanningFiles: false,
  scanProgress: {
    total: 0,
    completed: 0,
    changedFiles: 0,
  },
  scanReport: null,
  rcloneProgress: {
    active: false,
    direction: null,
    bytes: 0,
    totalBytes: null,
    percentage: null,
    speedBytesPerSec: 0,
    etaSeconds: null,
  },
  operationStatus: {
    title: "",
    detail: null,
    stepCurrent: null,
    stepTotal: null,
    itemCurrent: null,
    itemTotal: null,
  },
};

// ── Actions ──

export type Action =
  | { type: "SET_SONGS"; payload: SongListItem[] }
  | { type: "SET_CATEGORIES"; payload: Category[] }
  | { type: "SET_SETTINGS"; payload: AppSettings }
  | { type: "SET_SIDEBAR_VIEW"; payload: SidebarView }
  | { type: "SET_SELECTED_SONG"; payload: SongListItem | null }
  | { type: "SET_SELECTED_SCORE"; payload: ScoreListItem | null }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_AUTHOR_FILTERS"; payload: { composer: string; arranger: string } }
  | { type: "SET_FIRST_RUN"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "TOGGLE_FAVORITE"; payload: { songId: string; isFavorite: boolean } }
  | { type: "UPDATE_SELECTED_SONG"; payload: SongListItem }
  | { type: "SET_SCANNING_FILES"; payload: boolean }
  | { type: "SET_SCAN_REPORT"; payload: ScanResult | null }
  | { type: "RESET_SCAN_REPORT" }
  | {
      type: "SET_SCAN_PROGRESS";
      payload: { total: number; completed: number; changedFiles: number };
    }
  | {
      type: "SET_RCLONE_PROGRESS";
      payload: {
        active: boolean;
        direction: "upload" | "download" | null;
        bytes: number;
        totalBytes: number | null;
        percentage: number | null;
        speedBytesPerSec: number;
        etaSeconds: number | null;
      };
    }
  | { type: "RESET_RCLONE_PROGRESS" }
  | {
      type: "SET_OPERATION_STATUS";
      payload: {
        title: string;
        detail?: string | null;
        stepCurrent?: number | null;
        stepTotal?: number | null;
        itemCurrent?: number | null;
        itemTotal?: number | null;
      };
    }
  | { type: "RESET_OPERATION_STATUS" };

// ── Reducer ──

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SONGS":
      return {
        ...state,
        songs: action.payload,
        selectedSong: state.selectedSong
          ? action.payload.find((song) => song.id === state.selectedSong?.id) ?? null
          : null,
        selectedScore: state.selectedScore
          ? action.payload
              .flatMap((song) => song.scores)
              .find((score) => score.id === state.selectedScore?.id) ?? null
          : null,
      };
    case "SET_CATEGORIES":
      return { ...state, categories: action.payload };
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };
    case "SET_SIDEBAR_VIEW":
      return {
        ...state,
        sidebarView: action.payload,
        selectedSong: null,
        selectedScore: null,
        authorFilters: {
          composer: "all",
          arranger: "all",
        },
      };
    case "SET_SELECTED_SONG":
      return {
        ...state,
        selectedSong: action.payload,
        selectedScore: null,
      };
    case "SET_SELECTED_SCORE":
      return { ...state, selectedScore: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
    case "SET_AUTHOR_FILTERS":
      return { ...state, authorFilters: action.payload };
    case "SET_FIRST_RUN":
      return { ...state, isFirstRun: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "TOGGLE_FAVORITE":
      return {
        ...state,
        songs: state.songs.map((s) =>
          s.id === action.payload.songId
            ? { ...s, is_favorite: action.payload.isFavorite }
            : s
        ),
      };
    case "UPDATE_SELECTED_SONG":
      return {
        ...state,
        selectedSong: action.payload,
        songs: state.songs.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case "SET_SCANNING_FILES":
      return { ...state, isScanningFiles: action.payload };
    case "SET_SCAN_REPORT":
      return { ...state, scanReport: action.payload };
    case "RESET_SCAN_REPORT":
      return { ...state, scanReport: null };
    case "SET_SCAN_PROGRESS":
      return { ...state, scanProgress: action.payload };
    case "SET_RCLONE_PROGRESS":
      return { ...state, rcloneProgress: action.payload };
    case "RESET_RCLONE_PROGRESS":
      return {
        ...state,
        rcloneProgress: {
          active: false,
          direction: null,
          bytes: 0,
          totalBytes: null,
          percentage: null,
          speedBytesPerSec: 0,
          etaSeconds: null,
        },
      };
    case "SET_OPERATION_STATUS":
      return {
        ...state,
        operationStatus: {
          title: action.payload.title,
          detail: action.payload.detail ?? null,
          stepCurrent: action.payload.stepCurrent ?? null,
          stepTotal: action.payload.stepTotal ?? null,
          itemCurrent: action.payload.itemCurrent ?? null,
          itemTotal: action.payload.itemTotal ?? null,
        },
      };
    case "RESET_OPERATION_STATUS":
      return {
        ...state,
        operationStatus: {
          title: "",
          detail: null,
          stepCurrent: null,
          stepTotal: null,
          itemCurrent: null,
          itemTotal: null,
        },
      };
    default:
      return state;
  }
}
