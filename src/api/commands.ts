import { invoke } from "@tauri-apps/api/core";
import type {
  SongListItem,
  Category,
  AppSettings,
  IndexedFile,
} from "../types";

// ── Songs ──

export async function getAllSongs(): Promise<SongListItem[]> {
  return invoke("get_all_songs");
}

export async function getFavoritedSongs(): Promise<SongListItem[]> {
  return invoke("get_favorited_songs");
}

export async function getSongsWithDrafts(): Promise<SongListItem[]> {
  return invoke("get_songs_with_drafts");
}

export async function searchSongs(query: string): Promise<SongListItem[]> {
  return invoke("search_songs", { query });
}

export async function toggleFavorite(songId: string): Promise<boolean> {
  return invoke("toggle_favorite", { songId });
}

export async function scanDirectory(directory: string): Promise<IndexedFile[]> {
  return invoke("scan_directory", { directory });
}

export async function importIndexedFiles(
  files: IndexedFile[],
  categoryIds: string[] = []
): Promise<SongListItem[]> {
  return invoke("import_indexed_files", { files, categoryIds });
}

export async function importIndexedFilesWithMetadata(
  files: IndexedFile[],
  categoryIds: string[] = [],
  composer: string | null = null,
  arranger: string | null = null
): Promise<SongListItem[]> {
  return invoke("import_indexed_files_with_metadata", {
    files,
    categoryIds,
    composer,
    arranger,
  });
}

export async function getSongsByCategory(
  categoryId: string
): Promise<SongListItem[]> {
  return invoke("get_songs_by_category", { categoryId });
}

export async function createSong(name: string): Promise<SongListItem> {
  return invoke("create_song", { name });
}

export async function createSongWithCategories(
  name: string,
  categoryIds: string[]
): Promise<SongListItem> {
  return invoke("create_song_with_categories", { name, categoryIds });
}

export async function createSongWithMetadata(
  name: string,
  composer: string | null,
  arranger: string | null,
  categoryIds: string[]
): Promise<SongListItem> {
  return invoke("create_song_with_metadata", {
    name,
    composer,
    arranger,
    categoryIds,
  });
}

export async function updateSong(
  songId: string,
  name: string,
  composer: string | null,
  arranger: string | null,
  categoryIds: string[]
): Promise<SongListItem> {
  return invoke("update_song", { songId, name, composer, arranger, categoryIds });
}

export async function updateScore(
  scoreId: string,
  instrumentName: string | null,
  filePath: string
): Promise<void> {
  return invoke("update_score", { scoreId, instrumentName, filePath });
}

export async function updateScoreStatus(
  scoreId: string,
  status: "Main" | "Draft" | "Pending"
): Promise<SongListItem> {
  return invoke("update_score_status", { scoreId, status });
}

export async function addScoreToSong(
  songId: string,
  file: IndexedFile
): Promise<SongListItem> {
  return invoke("add_score_to_song", { songId, file });
}

export async function addScoresToSong(
  songId: string,
  files: IndexedFile[]
): Promise<SongListItem> {
  return invoke("add_scores_to_song", { songId, files });
}

export async function deleteScore(scoreId: string): Promise<void> {
  return invoke("delete_score", { scoreId });
}

export async function getSearchSuggestions(query: string, limit?: number): Promise<SongListItem[]> {
  return invoke("get_search_suggestions", { query, limit });
}

export async function openFile(scoreId: string): Promise<void> {
  return invoke("open_file", { scoreId });
}

// ── Categories ──

export async function getCategories(): Promise<Category[]> {
  return invoke("get_categories");
}

export async function createCategory(name: string): Promise<Category> {
  return invoke("create_category", { name });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  return invoke("delete_category", { categoryId });
}

// ── Settings ──

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function isFirstRun(): Promise<boolean> {
  return invoke("is_first_run");
}

export async function completeFirstRun(
  computerId: string,
  computerName: string,
  googleDriveMode: string,
  googleServiceAccountJson?: string | null
): Promise<void> {
  return invoke("complete_first_run", {
    computerId,
    computerName,
    googleDriveMode,
    googleServiceAccountJson,
  });
}

// ── File Scanning ──

export interface ScanResult {
  changed_files: string[];
  failed_files: Array<[string, string]>;
}

export async function scanFilesForChanges(): Promise<ScanResult> {
  return invoke("scan_files_for_changes");
}

export async function generateComputerId(): Promise<string> {
  return invoke("generate_computer_id");
}
