use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Represents a song in the system.
/// A song can have multiple scores, one for each instrument.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub name: String,
    pub composer: Option<String>,
    pub arranger: Option<String>,
    pub path: String,
    pub is_favorite: bool,
    pub status: ScoreStatus,
    pub updated_at: NaiveDateTime,
    pub updated_by: String,
}

/// Score status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ScoreStatus {
    Main,
    Draft,
    NotFound,
    Ignored,
}

impl ScoreStatus {
    pub fn as_str(&self) -> &str {
        match self {
            ScoreStatus::Main => "main",
            ScoreStatus::Draft => "draft",
            ScoreStatus::NotFound => "not_found",
            ScoreStatus::Ignored => "ignored",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "main" => ScoreStatus::Main,
            "draft" => ScoreStatus::Draft,
            "not_found" => ScoreStatus::NotFound,
            "ignored" => ScoreStatus::Ignored,
            _ => ScoreStatus::Main,
        }
    }
}

/// Represents a score (a specific instrument of a song).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Score {
    pub id: String,
    pub song_id: String,
    pub name: Option<String>,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub file_modified_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub status: ScoreStatus,
    pub updated_by: String,
}

impl Score {
    /// Factory method to create a new score from an indexed file
    pub fn new_from_file(
        song_id: String,
        updated_by: String,
        indexed_file: &IndexedFile,
        file_path: String,
        file_name: String,
        file_metadata: (u64, NaiveDateTime),
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            song_id,
            name: indexed_file.instrument.clone(),
            file_path,
            file_name,
            file_size: file_metadata.0,
            file_modified_at: file_metadata.1,
            updated_at: chrono::Local::now().naive_local(),
            status: ScoreStatus::Main,
            updated_by,
        }
    }
}

/// User-created category (e.g.: "Christian Harp")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub updated_at: NaiveDateTime,
    pub updated_by: String,
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub computer_id: String,
    pub computer_name: Option<String>,
    pub organization_name: Option<String>,
    pub language: Option<String>,
    pub computer_type: ComputerType,
    pub first_run_completed: bool,
    pub rclone_config: Option<RcloneConfig>,
    pub database_local: Option<u64>,
    pub backup_database_step: Option<BackupDatabaseStep>,
    pub backup_songs_step: Option<Vec<SongBackupStatus>>,
    pub library_summary: Option<LibrarySummary>,
    pub last_snapshot_timestamp: Option<i64>,
    pub last_change_timestamp: Option<i64>,
    pub last_backup_timestamp: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct AppContacts {
    pub email: Option<String>,
}

impl AppContacts {
    pub fn from_env_values(email: Option<&str>) -> Self {
        fn normalize(value: Option<&str>) -> Option<String> {
            value
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string())
        }

        Self {
            email: normalize(email),
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            computer_id: String::new(),
            computer_name: None,
            organization_name: None,
            language: None,
            computer_type: ComputerType::Server,
            first_run_completed: false,
            rclone_config: None,
            database_local: None,
            backup_database_step: None,
            backup_songs_step: None,
            library_summary: None,
            last_snapshot_timestamp: None,
            last_change_timestamp: None,
            last_backup_timestamp: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ScoreStatus;

    #[test]
    fn score_status_roundtrips_ignored() {
        assert_eq!(ScoreStatus::from_str("ignored"), ScoreStatus::Ignored);
        assert_eq!(ScoreStatus::Ignored.as_str(), "ignored");
    }

    #[test]
    fn score_status_roundtrips_not_found() {
        assert_eq!(ScoreStatus::from_str("not_found"), ScoreStatus::NotFound);
        assert_eq!(ScoreStatus::NotFound.as_str(), "not_found");
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LibraryStatusSummary {
    pub songs_count: usize,
    pub scores_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LibrarySummary {
    pub main: LibraryStatusSummary,
    pub draft: LibraryStatusSummary,
}

/// Trait to validate operation permissions based on the computer configuration
pub trait OperationGuard {
    fn require_server_only(&self) -> Result<(), crate::domain::errors::AppError>;
}

impl OperationGuard for AppSettings {
    fn require_server_only(&self) -> Result<(), crate::domain::errors::AppError> {
        if self.computer_type == ComputerType::Client {
            return Err(crate::domain::errors::AppError::ClientOperationNotAllowed);
        }
        Ok(())
    }
}

/// Constants and functions for date/time formatting
pub mod datetime_utils {
    use chrono::NaiveDateTime;

    pub const DATETIME_FORMAT: &str = "%Y-%m-%d %H:%M:%S";

    /// Formats a date/time in the application's pattern
    pub fn format_datetime(dt: NaiveDateTime) -> String {
        dt.format(DATETIME_FORMAT).to_string()
    }
}

/// Computer type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ComputerType {
    Server,
    Client,
}

impl ComputerType {
    pub fn as_str(&self) -> &str {
        match self {
            ComputerType::Server => "Server",
            ComputerType::Client => "Client",
        }
    }

    pub fn as_store_str(&self) -> &str {
        match self {
            ComputerType::Server => "server",
            ComputerType::Client => "client",
        }
    }

    pub fn from_str(s: &str) -> Self {
        if s.eq_ignore_ascii_case("client") {
            ComputerType::Client
        } else {
            ComputerType::Server
        }
    }

    pub fn from_store_str(s: &str) -> Self {
        Self::from_str(s)
    }
}

impl Default for ComputerType {
    fn default() -> Self {
        ComputerType::Server
    }
}

/// Rclone configuration for cloud synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcloneConfig {
    #[serde(default)]
    pub provider: RcloneProvider,
}

/// Cloud provider used by rclone
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RcloneProvider {
    Koofr,
    GoogleDrive,
    Dropbox,
    #[serde(rename = "onedrive")]
    OneDrive,
    Pcloud,
    Sftp,
    Webdav,
}

impl Default for RcloneProvider {
    fn default() -> Self {
        Self::Koofr
    }
}

impl RcloneProvider {
    pub fn default_remote_name(&self) -> &'static str {
        match self {
            RcloneProvider::Koofr => "koofr",
            RcloneProvider::GoogleDrive => "gdrive",
            RcloneProvider::Dropbox => "dropbox",
            RcloneProvider::OneDrive => "onedrive",
            RcloneProvider::Pcloud => "pcloud",
            RcloneProvider::Sftp => "sftp",
            RcloneProvider::Webdav => "webdav",
        }
    }

    pub fn default_cloud_path() -> &'static str {
        "ottavada"
    }

    pub fn from_str(value: &str) -> Self {
        match value.to_ascii_lowercase().as_str() {
            "google_drive" | "gdrive" | "drive" => Self::GoogleDrive,
            "dropbox" => Self::Dropbox,
            "onedrive" | "one_drive" => Self::OneDrive,
            "pcloud" | "p_cloud" => Self::Pcloud,
            "sftp" => Self::Sftp,
            "webdav" | "web_dav" => Self::Webdav,
            "koofr" => Self::Koofr,
            _ => Self::default(),
        }
    }

    /// Whether the provider is configured through browser (OAuth) authentication.
    pub fn uses_browser_auth(&self) -> bool {
        matches!(
            self,
            RcloneProvider::GoogleDrive
                | RcloneProvider::Dropbox
                | RcloneProvider::OneDrive
                | RcloneProvider::Pcloud
        )
    }
}

#[cfg(test)]
mod rclone_provider_tests {
    use super::RcloneProvider;

    #[test]
    fn maps_default_remote_names() {
        assert_eq!(RcloneProvider::Koofr.default_remote_name(), "koofr");
        assert_eq!(RcloneProvider::GoogleDrive.default_remote_name(), "gdrive");
        assert_eq!(RcloneProvider::Dropbox.default_remote_name(), "dropbox");
        assert_eq!(RcloneProvider::OneDrive.default_remote_name(), "onedrive");
        assert_eq!(RcloneProvider::Pcloud.default_remote_name(), "pcloud");
        assert_eq!(RcloneProvider::Sftp.default_remote_name(), "sftp");
        assert_eq!(RcloneProvider::Webdav.default_remote_name(), "webdav");
    }

    #[test]
    fn parses_provider_from_stored_strings() {
        assert_eq!(RcloneProvider::from_str("google_drive"), RcloneProvider::GoogleDrive);
        assert_eq!(RcloneProvider::from_str("gdrive"), RcloneProvider::GoogleDrive);
        assert_eq!(RcloneProvider::from_str("dropbox"), RcloneProvider::Dropbox);
        assert_eq!(RcloneProvider::from_str("onedrive"), RcloneProvider::OneDrive);
        assert_eq!(RcloneProvider::from_str("one_drive"), RcloneProvider::OneDrive);
        assert_eq!(RcloneProvider::from_str("pcloud"), RcloneProvider::Pcloud);
        assert_eq!(RcloneProvider::from_str("sftp"), RcloneProvider::Sftp);
        assert_eq!(RcloneProvider::from_str("webdav"), RcloneProvider::Webdav);
        assert_eq!(RcloneProvider::from_str("koofr"), RcloneProvider::Koofr);
        assert_eq!(RcloneProvider::from_str("unknown"), RcloneProvider::Koofr);
    }

    #[test]
    fn detects_browser_auth_providers() {
        assert!(RcloneProvider::GoogleDrive.uses_browser_auth());
        assert!(RcloneProvider::Dropbox.uses_browser_auth());
        assert!(RcloneProvider::OneDrive.uses_browser_auth());
        assert!(RcloneProvider::Pcloud.uses_browser_auth());
        assert!(!RcloneProvider::Koofr.uses_browser_auth());
        assert!(!RcloneProvider::Sftp.uses_browser_auth());
        assert!(!RcloneProvider::Webdav.uses_browser_auth());
    }

    #[test]
    fn serializes_onedrive_as_onedrive() {
        let json = serde_json::to_value(RcloneProvider::OneDrive).expect("serialize");
        assert_eq!(json.as_str(), Some("onedrive"));
        let parsed: RcloneProvider = serde_json::from_str("\"onedrive\"").expect("deserialize");
        assert_eq!(parsed, RcloneProvider::OneDrive);
    }
}

/// Backup status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BackupStatus {
    Pending,
    Compressed,
    Ok,
    Error,
}

impl BackupStatus {
    pub fn as_str(&self) -> &str {
        match self {
            BackupStatus::Pending => "pending",
            BackupStatus::Compressed => "compressed",
            BackupStatus::Ok => "ok",
            BackupStatus::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => BackupStatus::Pending,
            "compressed" => BackupStatus::Compressed,
            "ok" => BackupStatus::Ok,
            "error" => BackupStatus::Error,
            _ => BackupStatus::Pending,
        }
    }
}

/// Database backup status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupDatabaseStep {
    pub status: BackupStatus,
    pub updated_at: i64,
}

/// Song backup status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongBackupStatus {
    pub id: String,
    pub song_id: String,
    pub status: BackupStatus,
    pub last_backup_at: Option<i64>,
    pub error_message: Option<String>,
}

/// Data returned for the song listing in the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongListItem {
    pub id: String,
    pub name: String,
    pub composer: Option<String>,
    pub arranger: Option<String>,
    pub path: String,
    pub updated_at: NaiveDateTime,
    pub is_favorite: bool,
    pub status: ScoreStatus,
    pub category_ids: Vec<String>,
    pub scores: Vec<ScoreListItem>,
}

/// Score data in the listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreListItem {
    pub id: String,
    pub name: Option<String>,
    pub file_path: String,
    pub file_extension: String,
    pub updated_at: NaiveDateTime,
    pub status: ScoreStatus,
}

/// Data for indexing a directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub path: String,
    pub name: String,
    pub instrument: Option<String>,
    pub extension: String,
    pub status: Option<ScoreStatus>,
}

// ── REMOVED: Structures for MessagePack export (full database) ──
//
// Following the v0.3 documentation update, the strategy changed from:
// - ❌ Exporting the entire database as ExportDatabase
// To:
// - ✅ Exporting only changes as {computerId}.msgpack
//
// Removed structures:
// - ExportChange - Individual change
// - ExportChangeList - Group of changes
// - ExportCategory - Category for export
// - ExportScore - Score for export
// - ExportSong - Song for export
// - ExportDatabase - Full database for export
//
// TODO: Implement correct structures for {computerId}.msgpack with "events"
