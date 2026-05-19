import { invoke } from "@tauri-apps/api/core";
import type {
  SongListItem,
  ScoreListItem,
  Category,
  AppSettings,
  AppContacts,
  LibrarySummary,
  IndexedFile,
  RcloneSetupInput,
  RcloneProvider,
  UpdateCheckResult,
} from "../types";

// ── Songs ──

export async function getAllSongs(): Promise<SongListItem[]> {
  return invoke("get_all_songs");
}

export async function getAllSongSummaries(): Promise<SongListItem[]> {
  return invoke("get_all_song_summaries");
}

export async function getFavoritedSongs(): Promise<SongListItem[]> {
  return invoke("get_favorited_songs");
}

export async function getFavoritedSongSummaries(): Promise<SongListItem[]> {
  return invoke("get_favorited_song_summaries");
}

export async function getSongListItemById(songId: string): Promise<SongListItem> {
  return invoke("get_song_list_item_by_id", { songId });
}

export async function getSongsWithDrafts(): Promise<SongListItem[]> {
  return invoke("get_songs_with_drafts");
}

export async function getSongSummariesWithDrafts(): Promise<SongListItem[]> {
  return invoke("get_song_summaries_with_drafts");
}

export async function getSongsWithNotFound(): Promise<SongListItem[]> {
  return invoke("get_songs_with_not_found");
}

export async function getSongSummariesWithNotFound(): Promise<SongListItem[]> {
  return invoke("get_song_summaries_with_not_found");
}

export async function searchSongs(query: string): Promise<SongListItem[]> {
  return invoke("search_songs", { query });
}

export async function searchSongSummaries(query: string): Promise<SongListItem[]> {
  return invoke("search_song_summaries", { query });
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
): Promise<ImportIndexedFilesResult> {
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

export async function getSongSummariesByCategory(
  categoryId: string
): Promise<SongListItem[]> {
  return invoke("get_song_summaries_by_category", { categoryId });
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
  status: "main"
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

export async function useScoreAsBase(
  sourceScoreId: string,
  newScoreName: string
): Promise<SongListItem> {
  return invoke("use_score_as_base", {
    sourceScoreId,
    newScoreName,
  });
}

export async function deleteSong(songId: string): Promise<void> {
  return invoke("delete_song", { songId });
}

export async function getScoresForSong(songId: string): Promise<ScoreListItem[]> {
  return invoke("get_scores_for_song", { songId });
}

export async function getSearchSuggestions(query: string, limit?: number): Promise<SongListItem[]> {
  return invoke("get_search_suggestions", { query, limit });
}

export async function openFile(scoreId: string): Promise<void> {
  return invoke("open_file", { scoreId });
}

export async function openFilePath(filePath: string): Promise<void> {
  return invoke("open_file_path", { filePath });
}

export async function openFileLocation(filePath: string): Promise<void> {
  return invoke("open_file_location", { filePath });
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

export async function getAppContacts(): Promise<AppContacts> {
  return invoke("get_app_contacts");
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
  organizationName: string | null,
  computerType: string,
  rcloneConfigJson: string
): Promise<void> {
  return invoke("complete_first_run", {
    computerId,
    computerName,
    organizationName,
    computerType,
    rcloneConfigJson,
  });
}

export async function toggleComputerType(): Promise<string> {
  return invoke("toggle_computer_type");
}

export async function isInitialScanCompleted(): Promise<boolean> {
  return invoke("is_initial_scan_completed");
}

export async function hasPendingChanges(): Promise<boolean> {
  return invoke("has_pending_changes");
}

export async function hasServerApplyChangesInProgress(): Promise<boolean> {
  return invoke("has_server_apply_changes_in_progress");
}

export async function markServerApplyChangesInProgress(): Promise<void> {
  return invoke("mark_server_apply_changes_in_progress");
}

export async function clearServerApplyChangesInProgress(): Promise<void> {
  return invoke("clear_server_apply_changes_in_progress");
}

export async function exitApplication(): Promise<void> {
  return invoke("exit_application");
}

export async function markLocalChangesAsApplied(): Promise<void> {
  return invoke("mark_local_changes_as_applied");
}

export async function markSnapshotAsUploaded(
  lastSnapshotTimestamp: number,
  lastChangeTimestamp: number | null
): Promise<void> {
  return invoke("mark_snapshot_as_uploaded", {
    lastSnapshotTimestamp,
    lastChangeTimestamp,
  });
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  return invoke("check_for_updates");
}

export async function installUpdate(): Promise<void> {
  return invoke("install_update");
}

export async function refreshLibrarySummaryCache(): Promise<LibrarySummary> {
  return invoke("refresh_library_summary_cache");
}

// ── File Scanning ──

export interface ScanResult {
  changed_files: string[];
  not_found_files: string[];
  recovered_files: string[];
  failed_files: Array<[string, string]>;
}

export interface ImportIndexedFilesResult {
  songs: SongListItem[];
  added_count: number;
}

export async function scanFilesForChanges(): Promise<ScanResult> {
  return invoke("scan_files_for_changes");
}

export async function hasInternetConnection(): Promise<boolean> {
  return invoke("has_internet_connection");
}

export async function generateComputerId(): Promise<string> {
  return invoke("generate_computer_id");
}

// ── Rclone ──

export async function generateRcloneConfig(setup: RcloneSetupInput): Promise<void> {
  return invoke("generate_rclone_config", { setup });
}

export async function testRcloneConnection(remote: string, path: string): Promise<boolean> {
  return invoke("test_rclone_connection", { remote, path });
}

export async function testRcloneUpload(provider: RcloneProvider): Promise<void> {
  return invoke("test_rclone_upload", { provider });
}

export async function uploadWithRclone(
  remote: string,
  path: string,
  filePath: string
): Promise<string> {
  return invoke("upload_with_rclone", { remote, path, filePath });
}

export async function deleteRcloneTestFile(): Promise<void> {
  return invoke("delete_rclone_test_file");
}

export interface RcloneSyncSummary {
  direction: "upload" | "download";
  source: string;
  destination: string;
  duration_ms: number;
}

export interface RcloneRcStats {
  active: boolean;
  bytes: number;
  total_bytes: number | null;
  speed_bytes_per_sec: number;
  eta_seconds: number | null;
  percentage: number | null;
}

export async function syncCloudWithRclone(
  direction: "upload" | "download",
  relativePath?: string
): Promise<RcloneSyncSummary> {
  return invoke("sync_cloud_with_rclone", { direction, relativePath: relativePath ?? null });
}

export async function getRcloneRcStats(): Promise<RcloneRcStats | null> {
  return invoke("get_rclone_rc_stats");
}

export interface RcloneSelectiveUploadSummary {
  uploaded_count: number;
  skipped_count: number;
  duration_ms: number;
}

export async function uploadCloudPathsWithRclone(
  relativePaths: string[]
): Promise<RcloneSelectiveUploadSummary> {
  return invoke("upload_cloud_paths_with_rclone", { relativePaths });
}

// ── Backup Songs Archives ──

export interface SongArchiveResult {
  song_id: string;
  song_name: string;
  archive_path: string | null;
  archive_size: number | null;
  generated: boolean;
  error: string | null;
}

export interface SongArchiveSummary {
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  results: SongArchiveResult[];
}

export async function generateSongArchivesFiles(): Promise<SongArchiveSummary> {
  return invoke("generate_song_archives_files");
}

export interface EventsFileSummary {
  output_path: string;
  payload_size: number;
  file_size: number;
  events_count: number;
}

export async function generateEventsFile(): Promise<EventsFileSummary> {
  return invoke("generate_events_file");
}

export interface SnapshotFileSummary {
  output_path: string;
  file_size: number;
  generated_at: number;
  last_change_timestamp: number | null;
  songs_count: number;
  scores_count: number;
  categories_count: number;
  cleared_changed_fields: number;
}

export async function generateSnapshotFile(
  forceRegenerateSongArchives = false
): Promise<SnapshotFileSummary> {
  return invoke("generate_snapshot_file", { forceRegenerateSongArchives });
}

export interface ClientSyncSummary {
  snapshot_applied: boolean;
  events_applied: number;
  last_snapshot_timestamp: number;
  last_change_timestamp: number;
}

export async function applyServerChangesOnClient(): Promise<ClientSyncSummary> {
  return invoke("apply_server_changes_on_client");
}

export interface BackupFileSummary {
  output_path: string;
  file_size: number;
  generated_at: number;
  songs_count: number;
  scores_count: number;
  categories_count: number;
}

export interface BackupImportSummary {
  input_path: string;
  generated_at: number;
  songs_count: number;
  scores_count: number;
  categories_count: number;
}

export async function exportBackupFile(outputPath?: string | null): Promise<BackupFileSummary> {
  return invoke("export_backup_file", { outputPath: outputPath ?? null });
}

export async function importBackupFile(backupPath: string): Promise<BackupImportSummary> {
  return invoke("import_backup_file", { backupPath });
}

export async function generateAutomaticBackupFile(): Promise<BackupFileSummary | null> {
  return invoke("generate_automatic_backup_file");
}

export async function forceGenerateBackupCloudFile(): Promise<BackupFileSummary> {
  return invoke("force_generate_backup_cloud_file");
}

export async function importBackupCloudFile(): Promise<BackupImportSummary> {
  return invoke("import_backup_cloud_file");
}
