import { invoke } from "@tauri-apps/api/core";
import type {
  ScoreListItem,
  FileVersion,
  Category,
  AppSettings,
  IndexedFile,
} from "../types";

// ── Scores ──

export async function getAllScores(): Promise<ScoreListItem[]> {
  return invoke("get_all_scores");
}

export async function getFavoritedScores(): Promise<ScoreListItem[]> {
  return invoke("get_favorited_scores");
}

export async function getScoresWithDrafts(): Promise<ScoreListItem[]> {
  return invoke("get_scores_with_drafts");
}

export async function searchScores(query: string): Promise<ScoreListItem[]> {
  return invoke("search_scores", { query });
}

export async function toggleFavorite(scoreId: string): Promise<boolean> {
  return invoke("toggle_favorite", { scoreId });
}

export async function scanDirectory(directory: string): Promise<IndexedFile[]> {
  return invoke("scan_directory", { directory });
}

export async function importIndexedFiles(
  files: IndexedFile[],
  categoryId?: string
): Promise<ScoreListItem[]> {
  return invoke("import_indexed_files", { files, categoryId });
}

export async function getScoresByCategory(
  categoryId: string
): Promise<ScoreListItem[]> {
  return invoke("get_scores_by_category", { categoryId });
}

export async function createScore(title: string): Promise<ScoreListItem> {
  return invoke("create_score", { title });
}

export async function getSearchSuggestions(query: string, limit?: number): Promise<ScoreListItem[]> {
  return invoke("get_search_suggestions", { query, limit });
}

export async function openFile(scoreFileId: string): Promise<void> {
  return invoke("open_file", { scoreFileId });
}

// ── Versions ──

export async function getVersions(
  scoreFileId: string
): Promise<FileVersion[]> {
  return invoke("get_versions", { scoreFileId });
}

export async function promoteDraft(versionId: string): Promise<void> {
  return invoke("promote_draft", { versionId });
}

export async function deleteVersion(versionId: string): Promise<void> {
  return invoke("delete_version", { versionId });
}

export async function createDraft(
  scoreFileId: string,
  sourcePath: string
): Promise<FileVersion> {
  return invoke("create_draft", { scoreFileId, sourcePath });
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
  computerName: string,
  googleDriveMode: string,
  googleServiceAccountJson?: string | null
): Promise<void> {
  return invoke("complete_first_run", { computerName, googleDriveMode, googleServiceAccountJson });
}
