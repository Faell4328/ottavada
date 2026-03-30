use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Representa uma música no sistema.
/// Uma música pode ter múltiplas partituras (Score), cada uma para um instrumento.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub name: String,
    pub composer: Option<String>,
    pub arranger: Option<String>,
    pub is_favorite: bool,
    pub status: ScoreStatus,
    pub updated_at: NaiveDateTime,
    pub updated_by: String,
}

/// Status de uma partitura
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScoreStatus {
    Main,
    Pending,
    Draft,
    NotFound,
}

impl ScoreStatus {
    pub fn as_str(&self) -> &str {
        match self {
            ScoreStatus::Main => "main",
            ScoreStatus::Pending => "pending",
            ScoreStatus::Draft => "draft",
            ScoreStatus::NotFound => "not_found",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "main" => ScoreStatus::Main,
            "pending" => ScoreStatus::Pending,
            "draft" => ScoreStatus::Draft,
            "not_found" => ScoreStatus::NotFound,
            _ => ScoreStatus::Main,
        }
    }
}

/// Representa uma partitura (instrumento específico de uma música).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Score {
    pub id: String,
    pub song_id: String,
    pub name: Option<String>,
    pub host_id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub file_modified_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub status: ScoreStatus,
    pub updated_by: String,
}

impl Score {
    /// Factory method para criar uma nova partitura a partir de um arquivo indexado
    pub fn new_from_file(
        song_id: String,
        host_id: String,
        indexed_file: &IndexedFile,
        file_path: String,
        file_name: String,
        file_metadata: (u64, NaiveDateTime),
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            song_id,
            name: indexed_file.instrument.clone(),
            host_id: host_id.clone(),
            file_path,
            file_name,
            file_size: file_metadata.0,
            file_modified_at: file_metadata.1,
            updated_at: chrono::Local::now().naive_local(),
            status: ScoreStatus::Main,
            updated_by: host_id,
        }
    }
}

/// Categoria criada pelo usuário (ex: "Harpa Cristã")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub updated_at: NaiveDateTime,
    pub updated_by: String,
}

/// Configurações da aplicação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub computer_id: String,
    pub computer_name: Option<String>,
    pub computer_type: ComputerType,
    pub google_drive_mode: GoogleDriveMode,
    pub first_run_completed: bool,
    pub google_service_account: Option<GoogleServiceAccount>,
    pub rclone_config: Option<RcloneConfig>,
    pub database_local: Option<u64>,
    pub backup_database_step: Option<BackupDatabaseStep>,
    pub backup_songs_step: Option<Vec<SongBackupStatus>>,
    pub last_snapshot_timestamp: Option<i64>,
    pub last_change_timestamp: Option<i64>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            computer_id: String::new(),
            computer_name: None,
            computer_type: ComputerType::Server,
            google_drive_mode: GoogleDriveMode::Local,
            first_run_completed: false,
            google_service_account: None,
            rclone_config: None,
            database_local: None,
            backup_database_step: None,
            backup_songs_step: None,
            last_snapshot_timestamp: None,
            last_change_timestamp: None,
        }
    }
}

/// Trait para validar permissões de operação baseado na configuração do computador
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

/// Constantes e funções para formatação de data/hora
pub mod datetime_utils {
    use chrono::NaiveDateTime;
    
    pub const DATETIME_FORMAT: &str = "%Y-%m-%d %H:%M:%S";
    
    /// Formata uma data/hora no padrão da aplicação
    pub fn format_datetime(dt: NaiveDateTime) -> String {
        dt.format(DATETIME_FORMAT).to_string()
    }
    
}

/// Tipo de computador
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

    pub fn from_str(s: &str) -> Self {
        match s {
            "Client" => ComputerType::Client,
            _ => ComputerType::Server,
        }
    }
}

impl Default for ComputerType {
    fn default() -> Self {
        ComputerType::Server
    }
}

/// Modo de backup do Google Drive
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GoogleDriveMode {
    Local,
    Api,
}

/// Google Drive Service Account credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleServiceAccount {
    pub r#type: String,
    pub project_id: String,
    pub private_key_id: String,
    pub private_key: String,
    pub client_email: String,
    pub client_id: String,
    pub auth_uri: String,
    pub token_uri: String,
    pub auth_provider_x509_cert_url: String,
    pub client_x509_cert_url: String,
}

impl GoogleServiceAccount {
    pub fn validate(&self) -> Result<(), String> {
        if self.r#type != "service_account" {
            return Err("Tipo deve ser 'service_account'".to_string());
        }
        if self.project_id.is_empty() {
            return Err("project_id é obrigatório".to_string());
        }
        if self.private_key.is_empty() {
            return Err("private_key é obrigatória".to_string());
        }
        if self.client_email.is_empty() {
            return Err("client_email é obrigatório".to_string());
        }
        Ok(())
    }
}

/// Configuração do Rclone para sincronização em nuvem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcloneConfig {
    pub remote: String,
    pub path: String,
}

/// Status de um backup
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

/// Status do backup do banco de dados
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupDatabaseStep {
    pub status: BackupStatus,
    pub updated_at: i64,
}

/// Status do backup de uma música
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongBackupStatus {
    pub id: String,
    pub song_id: String,
    pub status: BackupStatus,
    pub last_backup_at: Option<i64>,
    pub error_message: Option<String>,
}

/// Dados retornados para a listagem de músicas no frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongListItem {
    pub id: String,
    pub name: String,
    pub composer: Option<String>,
    pub arranger: Option<String>,
    pub updated_at: NaiveDateTime,
    pub is_favorite: bool,
    pub category_ids: Vec<String>,
    pub scores: Vec<ScoreListItem>,
}

/// Dados de uma partitura na listagem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreListItem {
    pub id: String,
    pub name: Option<String>,
    pub file_path: String,
    pub file_extension: String,
    pub updated_at: NaiveDateTime,
    pub status: ScoreStatus,
}

/// Dados para indexação de um diretório
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub path: String,
    pub name: String,
    pub instrument: Option<String>,
    pub extension: String,
}

// ── REMOVIDO: Estruturas para exportação MessagePack (database completo) ──
// 
// Conforme atualização da documentação v0.3, a estratégia mudou de:
// - ❌ Exportar todo o banco de dados como ExportDatabase
// Para:
// - ✅ Exportar apenas mudanças como {computerId}.msgpack
//
// Estruturas removidas:
// - ExportChange - Alteração individual
// - ExportChangeList - Grupo de alterações
// - ExportCategory - Categoria para export
// - ExportScore - Partitura para export
// - ExportSong - Música para export
// - ExportDatabase - Banco completo para export
//
// TODO: Implementar estruturas corretas para {computerId}.msgpack com "events"

