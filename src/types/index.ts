// ── Domain types matching the Rust backend ──

export interface SongListItem {
  id: string;
  name: string;
  composer: string | null;
  arranger: string | null;
  path: string;
  updated_at: string;
  is_favorite: boolean;
  status: "main" | "draft" | "not_found";
  category_ids: string[];
  scores: ScoreListItem[];
}

export interface ScoreListItem {
  id: string;
  name: string | null;
  file_path: string;
  file_extension: string;
  updated_at: string;
  status: "main" | "draft" | "ignored";
}

export interface Category {
  id: string;
  name: string;
  updated_at: string;
  updated_by: string;
}

export interface AppSettings {
  computer_id: string;
  computer_name: string | null;
  organization_name: string | null;
  language: string | null;
  computer_type: "Server" | "Client";
  google_drive_mode: "Local" | "Api";
  first_run_completed: boolean;
  google_service_account: GoogleServiceAccount | null;
  rclone_config: RcloneConfig | null;
  database_local?: number;
  backup_database_step?: BackupDatabaseStep | null;
  backup_songs_step?: SongBackupStatus[] | null;
  library_summary?: LibrarySummary | null;
  last_snapshot_timestamp?: number | null;
  last_change_timestamp?: number | null;
  last_backup_timestamp?: number | null;
}

export interface AppContacts {
  email: string | null;
  phone: string | null;
}

export interface LibraryStatusSummary {
  songs_count: number;
  scores_count: number;
}

export interface LibrarySummary {
  main: LibraryStatusSummary;
  draft: LibraryStatusSummary;
}

export interface GoogleServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export type RcloneProvider = "koofr" | "google_drive";

export interface RcloneConfig {
  provider: RcloneProvider;
}

export interface RcloneSetupInput {
  provider: RcloneProvider;
  email?: string | null;
  appPassword?: string | null;
}

export enum BackupStatus {
  Pending = "pending",
  Compressed = "compressed",
  Ok = "ok",
  Error = "error",
}

export interface SongBackupStatus {
  song_id: string;
  last_backup_at?: string;
  status: BackupStatus;
  error_message?: string;
}

export interface BackupDatabaseStep {
  status: BackupStatus;
  error_message?: string;
  updated_at?: string;
}

export interface UpdateInfo {
  current_version: string;
  version: string;
  date: string | null;
  body: string | null;
}

export interface UpdateCheckResult {
  configured: boolean;
  update: UpdateInfo | null;
}

export interface IndexedFile {
  path: string;
  name: string;
  instrument: string | null;
  extension: string;
  status?: "main" | "draft" | "ignored";
}

// ── UI State types ──

export type SidebarView =
  | "all"
  | "favorites"
  | "drafts"
  | "not_found"
  | { type: "category"; id: string; name: string };

export interface AppState {
  songs: SongListItem[];
  categories: Category[];
  settings: AppSettings | null;
  sidebarView: SidebarView;
  selectedSong: SongListItem | null;
  selectedScore: ScoreListItem | null;
  searchQuery: string;
  isFirstRun: boolean;
  isLoading: boolean;
}
