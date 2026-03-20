use std::path::PathBuf;
use std::fs;
use tracing::info;

use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, BackupDatabaseStep, BackupStatus, ComputerType, GoogleDriveMode, GoogleServiceAccount, SongBackupStatus};

const STORE_FILENAME: &str = "app-store.json";

/// Gerencia o armazenamento de configurações do sistema usando um arquivo JSON
pub struct SystemStore {
    store_path: PathBuf,
}

impl SystemStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let store_path = app_data_dir.join(STORE_FILENAME);
        Self { store_path }
    }

    /// Carrega as configurações do arquivo JSON
    fn load_store(&self) -> Result<serde_json::Value, AppError> {
        if self.store_path.exists() {
            let content = fs::read_to_string(&self.store_path)
                .map_err(|e| AppError::Generic(format!("Erro ao ler store: {}", e)))?;
            serde_json::from_str(&content)
                .map_err(|e| AppError::Generic(format!("Erro ao parsear store JSON: {}", e)))
        } else {
            Ok(serde_json::json!({}))
        }
    }

    /// Salva as configurações no arquivo JSON
    fn save_store(&self, data: &serde_json::Value) -> Result<(), AppError> {
        let json_str = serde_json::to_string_pretty(data)
            .map_err(|e| AppError::Generic(format!("Erro ao serializar store: {}", e)))?;
        fs::write(&self.store_path, json_str)
            .map_err(|e| AppError::Generic(format!("Erro ao escrever store: {}", e)))?;
        Ok(())
    }

    /// Obtém as configurações do sistema
    pub fn get_app_settings(&self) -> Result<AppSettings, AppError> {
        let store = self.load_store()?;

        // Parse backup database step
        let backup_database_step = store
            .get("backup_database_step")
            .and_then(|v| {
                let status_str = v.get("status")?.as_str()?;
                let updated_at = v.get("updated_at")?.as_i64()?;
                Some(BackupDatabaseStep {
                    status: BackupStatus::from_str(status_str),
                    updated_at,
                })
            });

        // Parse backup songs step
        let backup_songs_step = store
            .get("backup_songs_step")
            .and_then(|v| v.as_array())
            .map(|songs| {
                songs.iter()
                    .filter_map(|song| {
                        let id = song.get("id")?.as_str()?.to_string();
                        let song_id = song.get("song_id")?.as_str()?.to_string();
                        let status_str = song.get("status")?.as_str()?;
                        Some(SongBackupStatus {
                            id,
                            song_id,
                            status: BackupStatus::from_str(status_str),
                        })
                    })
                    .collect()
            });

        let settings = AppSettings {
            computer_id: store
                .get("computer_id")
                .and_then(|v: &serde_json::Value| v.as_str().map(|s: &str| s.to_string()))
                .unwrap_or_default(),
            computer_name: store
                .get("computer_name")
                .and_then(|v: &serde_json::Value| v.as_str().map(|s: &str| s.to_string())),
            computer_type: match store
                .get("computer_type")
                .and_then(|v: &serde_json::Value| v.as_str()) {
                Some("Client") => ComputerType::Client,
                _ => ComputerType::Server,
            },
            google_drive_mode: match store
                .get("google_drive_mode")
                .and_then(|v: &serde_json::Value| v.as_str()) {
                Some("api") => GoogleDriveMode::Api,
                _ => GoogleDriveMode::Local,
            },
            first_run_completed: store
                .get("first_run_completed")
                .and_then(|v: &serde_json::Value| v.as_bool())
                .unwrap_or(false),
            google_service_account: store
                .get("google_service_account")
                .and_then(|v| serde_json::from_value::<GoogleServiceAccount>(v.clone()).ok()),
            database_local: store
                .get("database_local")
                .and_then(|v: &serde_json::Value| v.as_u64()),
            backup_database_step,
            backup_songs_step,
        };

        Ok(settings)
    }

    /// Salva as configurações do sistema
    pub fn save_app_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        let mut store = self.load_store()?;

        store["computer_id"] = serde_json::json!(settings.computer_id);

        if let Some(ref name) = settings.computer_name {
            store["computer_name"] = serde_json::json!(name);
        } else {
            store.as_object_mut().map(|obj| obj.remove("computer_name"));
        }

        let computer_type_str = settings.computer_type.as_str();
        store["computer_type"] = serde_json::json!(computer_type_str);

        let mode_str = match settings.google_drive_mode {
            GoogleDriveMode::Local => "local",
            GoogleDriveMode::Api => "api",
        };
        store["google_drive_mode"] = serde_json::json!(mode_str);

        store["first_run_completed"] = serde_json::json!(settings.first_run_completed);

        if let Some(ref account) = settings.google_service_account {
            let account_json = serde_json::to_value(account)
                .map_err(|e| AppError::Generic(format!("Erro ao serializar service account: {}", e)))?;
            store["google_service_account"] = account_json;
        } else {
            store.as_object_mut().map(|obj| obj.remove("google_service_account"));
        }

        if let Some(database_local) = settings.database_local {
            store["database_local"] = serde_json::json!(database_local);
        } else {
            store.as_object_mut().map(|obj| obj.remove("database_local"));
        }

        if let Some(ref backup_db_step) = settings.backup_database_step {
            store["backup_database_step"] = serde_json::json!({
                "status": backup_db_step.status.as_str(),
                "updated_at": backup_db_step.updated_at
            });
        } else {
            store.as_object_mut().map(|obj| obj.remove("backup_database_step"));
        }

        if let Some(ref backup_songs) = settings.backup_songs_step {
            store["backup_songs_step"] = serde_json::json!(
                backup_songs.iter().map(|s| serde_json::json!({
                    "id": s.id,
                    "song_id": s.song_id,
                    "status": s.status.as_str()
                })).collect::<Vec<_>>()
            );
        } else {
            store.as_object_mut().map(|obj| obj.remove("backup_songs_step"));
        }

        self.save_store(&store)?;

        info!("Configurações salvas com sucesso no store em: {:?}", self.store_path);
        Ok(())
    }

    /// Salva um valor genérico no store
    #[allow(dead_code)]
    pub fn set(&self, key: &str, value: serde_json::Value) -> Result<(), AppError> {
        let mut store = self.load_store()?;
        store[key] = value;
        self.save_store(&store)?;
        Ok(())
    }

    /// Obtém um valor genérico do store
    #[allow(dead_code)]
    pub fn get(&self, key: &str) -> Result<Option<serde_json::Value>, AppError> {
        let store = self.load_store()?;
        Ok(store.get(key).cloned())
    }
}
