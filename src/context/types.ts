import type { ScanResult, SnapshotFileSummary } from "../api/commands";
import type { AppSettings, ScoreListItem, SidebarView, SongListItem } from "../types";
import type { State } from "./reducer";

export type AuthorFilterValue = "all" | "none" | string;

export interface AppContextValue {
  state: State;
  loadSongs: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadSettings: () => Promise<void>;
  refreshSelectedSong: () => Promise<void>;
  setOperationStatus: (payload: {
    title: string;
    detail?: string | null;
    stepCurrent?: number | null;
    stepTotal?: number | null;
    itemCurrent?: number | null;
    itemTotal?: number | null;
  }) => void;
  resetOperationStatus: () => void;
  resetScanReport: () => void;
  setSidebarView: (view: SidebarView) => void;
  selectSong: (song: SongListItem | null) => void;
  selectScore: (score: ScoreListItem | null) => void;
  setSearchQuery: (query: string) => void;
  setAuthorFilters: (payload: { composer: AuthorFilterValue; arranger: AuthorFilterValue }) => void;
  toggleFavorite: (songId: string) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
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
  updateScoreStatus: (scoreId: string, status: "main" | "draft" | "ignored") => Promise<void>;
  deleteScore: (scoreId: string) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  useScoreAsBase: (sourceScoreId: string, newScoreName: string) => Promise<void>;
  completeFirstRun: (
    computerId: string,
    computerName: string,
    organizationName: string | null,
    computerType: string,
    rcloneConfigJson: string
  ) => Promise<void>;
  scanFilesForChanges: (
    options?:
      | boolean
      | {
          isAutomatic?: boolean;
          forceCloudSync?: boolean;
          snapshotSummary?: SnapshotFileSummary | null;
          rethrowOnError?: boolean;
        }
  ) => Promise<void>;
  previewScanFilesForChanges: () => Promise<void>;
}

export type { ScanResult };
