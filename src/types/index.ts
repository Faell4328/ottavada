// ── Domain types matching the Rust backend ──

export interface ScoreListItem {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  updated_at: string;
  favorited: boolean;
  instruments: ScoreFileItem[];
}

export interface ScoreFileItem {
  id: string;
  instrument: string | null;
  file_extension: string;
  updated_at: string;
  has_draft: boolean;
  version_count: number;
}

export interface FileVersion {
  id: string;
  score_file_id: string;
  version_number: number;
  label: string | null;
  status: "Current" | "Previous" | "Draft" | "Compressed";
  file_path: string;
  file_size: number;
  hash: string | null;
  is_compressed: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface AppSettings {
  computer_name: string | null;
  logo_path: string | null;
  google_drive_mode: "Local" | "Api";
  hash_enabled: boolean;
  first_run_completed: boolean;
  google_service_account: GoogleServiceAccount | null;
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

export interface IndexedFile {
  path: string;
  name: string;
  instrument: string | null;
  extension: string;
  size: number;
}

// ── UI State types ──

export type SidebarView =
  | "all"
  | "favorites"
  | "drafts"
  | { type: "category"; id: string; name: string };

export interface AppState {
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
