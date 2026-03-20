// ── Domain types matching the Rust backend ──

export interface SongListItem {
  id: string;
  name: string;
  composer: string | null;
  arranger: string | null;
  updated_at: string;
  is_favorite: boolean;
  category_ids: string[];
  scores: ScoreListItem[];
}

export interface ScoreListItem {
  id: string;
  name: string | null;
  file_path: string;
  file_extension: string;
  updated_at: string;
  status: "Main" | "Pending" | "Draft" | "NotFound";
}

export interface Category {
  id: string;
  name: string;
}

export interface AppSettings {
  computer_id: string;
  computer_name: string | null;
  google_drive_mode: "Local" | "Api";
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
