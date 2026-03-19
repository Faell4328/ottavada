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
    pub updated_at: NaiveDateTime,
}

/// Status de uma partitura
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScoreStatus {
    Main,
    Pending,
    Draft,
}

impl ScoreStatus {
    pub fn as_str(&self) -> &str {
        match self {
            ScoreStatus::Main => "main",
            ScoreStatus::Pending => "pending",
            ScoreStatus::Draft => "draft",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "main" => ScoreStatus::Main,
            "pending" => ScoreStatus::Pending,
            "draft" => ScoreStatus::Draft,
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
    pub file_size: u64,
    pub file_modified_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub status: ScoreStatus,
}

/// Categoria criada pelo usuário (ex: "Harpa Cristã")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
}

/// Configurações da aplicação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub computer_id: String,
    pub computer_name: Option<String>,
    pub google_drive_mode: GoogleDriveMode,
    pub first_run_completed: bool,
    pub google_service_account: Option<GoogleServiceAccount>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            computer_id: String::new(),
            computer_name: None,
            google_drive_mode: GoogleDriveMode::Local,
            first_run_completed: false,
            google_service_account: None,
        }
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
