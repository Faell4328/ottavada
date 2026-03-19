import type {
  SongListItem,
  ScoreListItem,
  Category,
  AppSettings,
  SidebarView,
} from "../types";

// ── State ──

export interface State {
  songs: SongListItem[];
  categories: Category[];
  settings: AppSettings | null;
  sidebarView: SidebarView;
  selectedSong: SongListItem | null;
  selectedScore: ScoreListItem | null;
  searchQuery: string;
  isFirstRun: boolean;
  isLoading: boolean;
  isScanningFiles: boolean;
  scanProgress: {
    total: number;
    completed: number;
    changedFiles: number;
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
  isFirstRun: false,
  isLoading: true,
  isScanningFiles: false,
  scanProgress: {
    total: 0,
    completed: 0,
    changedFiles: 0,
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
  | { type: "SET_FIRST_RUN"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "TOGGLE_FAVORITE"; payload: { songId: string; isFavorite: boolean } }
  | { type: "UPDATE_SELECTED_SONG"; payload: SongListItem }
  | { type: "SET_SCANNING_FILES"; payload: boolean }
  | {
      type: "SET_SCAN_PROGRESS";
      payload: { total: number; completed: number; changedFiles: number };
    };

// ── Reducer ──

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SONGS":
      return { ...state, songs: action.payload };
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
    case "SET_SCAN_PROGRESS":
      return { ...state, scanProgress: action.payload };
    default:
      return state;
  }
}
