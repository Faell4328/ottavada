use std::fs;
use std::path::PathBuf;
use tracing::info;

use crate::domain::errors::AppError;
use crate::domain::models::{
    AppSettings, BackupDatabaseStep, BackupStatus, ComputerType, GoogleDriveMode,
    GoogleServiceAccount, SongBackupStatus,
};

const STORE_FILENAME: &str = "app-store.json";

/// Gerencia o armazenamento de configurações do sistema usando um arquivo JSON
pub struct SystemStore {
    app_data_dir: PathBuf,
    store_path: PathBuf,
}

impl SystemStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let store_path = app_data_dir.join(STORE_FILENAME);
        Self {
            app_data_dir,
            store_path,
        }
    }

    /// Retorna o diretório de dados da aplicação
    pub fn app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
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

        let computer_id = store
            .get("computer_id")
            .or_else(|| store.get("id"))
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_default();

        let computer_name = store
            .get("computer_name")
            .or_else(|| store.get("name"))
            .and_then(|v| v.as_str().map(|s| s.to_string()));

        let computer_type_raw = store
            .get("computer_type")
            .and_then(|v| v.as_str())
            .or_else(|| store.get("type").and_then(|v| v.as_str()))
            .unwrap_or("server");

        let computer_type = ComputerType::from_store_str(computer_type_raw);

        let rclone_config = store
            .get("rclone_config")
            .and_then(|v| {
                serde_json::from_value::<crate::domain::models::RcloneConfig>(v.clone()).ok()
            })
            .or_else(|| {
                let rclone = store.get("rclone")?;
                let remote = rclone
                    .get("name")
                    .or_else(|| rclone.get("remote"))
                    .and_then(|v| v.as_str())?
                    .to_string();
                let path = rclone.get("path")?.as_str()?.to_string();
                Some(crate::domain::models::RcloneConfig { remote, path })
            });

        let cloud = store.get("cloud");
        let last_snapshot_timestamp = cloud
            .and_then(|v| v.get("lastSnapshotTimestamp"))
            .and_then(|v| v.as_i64());
        let last_change_timestamp = cloud
            .and_then(|v| v.get("lastChangeTimestamp"))
            .and_then(|v| v.as_i64());

        // Parse backup database step
        let backup_database_step = store.get("backup_database_step").and_then(|v| {
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
                songs
                    .iter()
                    .filter_map(|song| {
                        let id = song.get("id")?.as_str()?.to_string();
                        let song_id = song.get("song_id")?.as_str()?.to_string();
                        let status_str = song.get("status")?.as_str()?;
                        let last_backup_at = song.get("last_backup_at")?.as_i64();
                        let error_message =
                            song.get("error_message")?.as_str().map(|s| s.to_string());
                        Some(SongBackupStatus {
                            id,
                            song_id,
                            status: BackupStatus::from_str(status_str),
                            last_backup_at,
                            error_message,
                        })
                    })
                    .collect()
            });

        let settings = AppSettings {
            computer_id,
            computer_name,
            computer_type,
            google_drive_mode: match store
                .get("google_drive_mode")
                .and_then(|v: &serde_json::Value| v.as_str())
            {
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
            rclone_config,
            database_local: store
                .get("database_local")
                .and_then(|v: &serde_json::Value| v.as_u64()),
            backup_database_step,
            backup_songs_step,
            last_snapshot_timestamp,
            last_change_timestamp,
        };

        Ok(settings)
    }

    /// Salva as configurações do sistema
    pub fn save_app_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        let mut store = self.load_store()?;

        // Estrutura canônica (documentação): id, name, type, rclone, cloud
        store["id"] = serde_json::json!(settings.computer_id);
        store["name"] = serde_json::json!(settings.computer_name.clone().unwrap_or_default());
        store["type"] = serde_json::json!(settings.computer_type.as_store_str());

        if let Some(ref rclone_cfg) = settings.rclone_config {
            store["rclone"] = serde_json::json!({
                "name": rclone_cfg.remote,
                "path": rclone_cfg.path,
            });
        } else {
            store.as_object_mut().map(|obj| obj.remove("rclone"));
        }

        store["cloud"] = serde_json::json!({
            "lastSnapshotTimestamp": settings.last_snapshot_timestamp.unwrap_or(0),
            "lastChangeTimestamp": settings.last_change_timestamp.unwrap_or(0),
        });

        // Chaves legadas mantidas por compatibilidade enquanto o frontend migra completamente.
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
            let account_json = serde_json::to_value(account).map_err(|e| {
                AppError::Generic(format!("Erro ao serializar service account: {}", e))
            })?;
            store["google_service_account"] = account_json;
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("google_service_account"));
        }

        if let Some(ref rclone_cfg) = settings.rclone_config {
            let rclone_json = serde_json::to_value(rclone_cfg).map_err(|e| {
                AppError::Generic(format!("Erro ao serializar rclone config: {}", e))
            })?;
            store["rclone_config"] = rclone_json;
        } else {
            store.as_object_mut().map(|obj| obj.remove("rclone_config"));
        }

        if let Some(database_local) = settings.database_local {
            store["database_local"] = serde_json::json!(database_local);
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("database_local"));
        }

        if let Some(ref backup_db_step) = settings.backup_database_step {
            store["backup_database_step"] = serde_json::json!({
                "status": backup_db_step.status.as_str(),
                "updated_at": backup_db_step.updated_at
            });
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("backup_database_step"));
        }

        if let Some(ref backup_songs) = settings.backup_songs_step {
            store["backup_songs_step"] = serde_json::json!(backup_songs
                .iter()
                .map(|s| {
                    let mut obj = serde_json::json!({
                        "id": s.id,
                        "song_id": s.song_id,
                        "status": s.status.as_str()
                    });
                    if let Some(last_backup) = s.last_backup_at {
                        obj["last_backup_at"] = serde_json::json!(last_backup);
                    }
                    if let Some(ref error_msg) = s.error_message {
                        obj["error_message"] = serde_json::json!(error_msg);
                    }
                    obj
                })
                .collect::<Vec<_>>());
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("backup_songs_step"));
        }

        if let Some(last_snapshot_timestamp) = settings.last_snapshot_timestamp {
            store["cloud"]["lastSnapshotTimestamp"] = serde_json::json!(last_snapshot_timestamp);
        }

        if let Some(last_change_timestamp) = settings.last_change_timestamp {
            store["cloud"]["lastChangeTimestamp"] = serde_json::json!(last_change_timestamp);
        }

        self.save_store(&store)?;

        info!(
            "Configurações salvas com sucesso no store em: {:?}",
            self.store_path
        );
        Ok(())
    }

    /// Salva as configurações do sistema e atualiza o backup_database_step.updated_at
    /// com o timestamp da última alteração em qualquer música (efeito em cascata)
    #[allow(dead_code)]
    pub fn save_app_settings_with_db(
        &self,
        settings: &mut AppSettings,
        db: &crate::infrastructure::database::Database,
    ) -> Result<(), AppError> {
        // Obter o updated_at mais recente das songs
        if let Some(latest_timestamp) = db.get_latest_songs_update_timestamp()? {
            // Atualizar ou criar o backup_database_step com o timestamp mais recente
            match settings.backup_database_step {
                Some(ref mut backup_step) => {
                    backup_step.updated_at = latest_timestamp;
                }
                None => {
                    use crate::domain::models::{BackupDatabaseStep, BackupStatus};
                    settings.backup_database_step = Some(BackupDatabaseStep {
                        status: BackupStatus::Pending,
                        updated_at: latest_timestamp,
                    });
                }
            }
        }

        self.save_app_settings(settings)
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

    /// Obtém o diretório de dados da aplicação (onde o store é armazenado)
    #[allow(dead_code)]
    pub fn get_app_data_dir(&self) -> PathBuf {
        self.store_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."))
    }
}
