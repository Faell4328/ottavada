use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Representa uma partitura (música) no sistema.
/// Uma partitura pode ter múltiplos instrumentos (ScoreFile).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Score {
    pub id: String,
    pub title: String,
    pub composer: Option<String>,
    pub arranger: Option<String>,
    pub category_id: Option<String>,
    pub tags: Vec<String>,
    pub favorited: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Representa um arquivo de partitura (um instrumento específico de uma música).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreFile {
    pub id: String,
    pub score_id: String,
    pub instrument: Option<String>,
    pub original_path: String,
    pub file_extension: String,
    pub file_size: u64,
    pub hash: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Status de uma versão
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VersionStatus {
    Current,
    Previous,
    Draft,
    Compressed,
}

impl VersionStatus {
    pub fn as_str(&self) -> &str {
        match self {
            VersionStatus::Current => "current",
            VersionStatus::Previous => "previous",
            VersionStatus::Draft => "draft",
            VersionStatus::Compressed => "compressed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "current" => VersionStatus::Current,
            "previous" => VersionStatus::Previous,
            "draft" => VersionStatus::Draft,
            "compressed" => VersionStatus::Compressed,
            _ => VersionStatus::Previous,
        }
    }
}

/// Representa uma versão de um arquivo de partitura.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersion {
    pub id: String,
    pub score_file_id: String,
    pub version_number: i32,
    pub label: Option<String>,
    pub status: VersionStatus,
    pub file_path: String,
    pub file_size: u64,
    pub hash: Option<String>,
    pub is_compressed: bool,
    pub created_at: NaiveDateTime,
}

/// Categoria criada pelo usuário (ex: "Harpa Cristã")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub created_at: NaiveDateTime,
}

/// Configurações da aplicação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub organization_name: Option<String>,
    pub logo_path: Option<String>,
    pub google_drive_mode: GoogleDriveMode,
    pub hash_enabled: bool,
    pub first_run_completed: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            organization_name: None,
            logo_path: None,
            google_drive_mode: GoogleDriveMode::Local,
            hash_enabled: false,
            first_run_completed: false,
        }
    }
}

/// Modo de backup do Google Drive
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GoogleDriveMode {
    Local,
    Api,
}

/// Informação de backup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub last_cloud_backup: Option<NaiveDateTime>,
    pub last_usb_backup: Option<NaiveDateTime>,
    pub cloud_status: BackupStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BackupStatus {
    Synced,
    Pending,
    Error(String),
    NeverSynced,
}

/// Dados retornados para a listagem de partituras no frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreListItem {
    pub id: String,
    pub title: String,
    pub composer: Option<String>,
    pub arranger: Option<String>,
    pub updated_at: NaiveDateTime,
    pub favorited: bool,
    pub instruments: Vec<ScoreFileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreFileItem {
    pub id: String,
    pub instrument: Option<String>,
    pub file_extension: String,
    pub updated_at: NaiveDateTime,
    pub has_draft: bool,
    pub version_count: i32,
}

/// Dados para indexação de um diretório
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub path: String,
    pub name: String,
    pub instrument: Option<String>,
    pub extension: String,
    pub size: u64,
}
