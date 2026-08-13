use std::fs;
use std::path::PathBuf;
use tracing::info;

use crate::domain::errors::AppError;
use crate::domain::models::{
    AppSettings, BackupDatabaseStep, BackupStatus, ComputerType, GoogleDriveMode,
    GoogleServiceAccount, RcloneConfig, RcloneProvider, SongBackupStatus,
};

const STORE_FILENAME: &str = "app-store.json";

fn read_string(store: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        store
            .get(*key)
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
    })
}

/// Manages the storage of system settings using a JSON file
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

    /// Returns the application data directory
    pub fn app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }

    /// Loads the settings from the JSON file
    fn load_store(&self) -> Result<serde_json::Value, AppError> {
        if self.store_path.exists() {
            let content = fs::read_to_string(&self.store_path)
                .map_err(|e| AppError::Generic(format!("Error reading store: {}", e)))?;
            serde_json::from_str(&content)
                .map_err(|e| AppError::Generic(format!("Error parsing store JSON: {}", e)))
        } else {
            Ok(serde_json::json!({}))
        }
    }

    /// Saves the settings to the JSON file with atomic write (temp + rename)
    fn save_store(&self, data: &serde_json::Value) -> Result<(), AppError> {
        let json_str = serde_json::to_string_pretty(data)
            .map_err(|e| AppError::Generic(format!("Error serializing store: {}", e)))?;

        let temp_path = self.store_path.with_extension("tmp");
        fs::write(&temp_path, json_str)
            .map_err(|e| AppError::Generic(format!("Error writing store: {}", e)))?;
        fs::rename(&temp_path, &self.store_path)
            .map_err(|e| AppError::Generic(format!("Error finalizing store write: {}", e)))?;
        Ok(())
    }

    fn parse_rclone_provider(value: &serde_json::Value) -> RcloneProvider {
        let raw_provider = value.get("provider").and_then(|v| v.as_str());
        let raw_remote_or_name = value
            .get("remote")
            .or_else(|| value.get("name"))
            .and_then(|v| v.as_str());

        match raw_provider.or(raw_remote_or_name) {
            Some(value) if value.eq_ignore_ascii_case("google_drive") => {
                RcloneProvider::GoogleDrive
            }
            Some(value)
                if value.eq_ignore_ascii_case("drive")
                    || value.eq_ignore_ascii_case("gdrive")
                    || value.to_lowercase().contains("drive") =>
            {
                RcloneProvider::GoogleDrive
            }
            Some(_) => RcloneProvider::Koofr,
            None => RcloneProvider::default(),
        }
    }

    fn parse_rclone_config(value: &serde_json::Value) -> Option<RcloneConfig> {
        if !value.is_object() {
            return None;
        }

        Some(RcloneConfig {
            provider: Self::parse_rclone_provider(value),
        })
    }

    /// Gets the system settings
    pub fn get_app_settings(&self) -> Result<AppSettings, AppError> {
        let store = self.load_store()?;

        let computer_id = read_string(&store, &["id"]).unwrap_or_default();

        let computer_name = read_string(&store, &["computerName"]);

        let organization_name = read_string(&store, &["organizationName"]).and_then(|value| {
            if value.trim().is_empty() {
                None
            } else {
                Some(value)
            }
        });

        let computer_type_raw =
            read_string(&store, &["type"]).unwrap_or_else(|| "server".to_string());

        let language = read_string(&store, &["language"]).and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        });

        let computer_type = ComputerType::from_store_str(&computer_type_raw);

        let rclone_config = store.get("rclone").and_then(Self::parse_rclone_config);

        let cloud = store.get("cloud");
        let last_snapshot_timestamp = cloud
            .and_then(|v| v.get("lastSnapshotTimestamp"))
            .and_then(|v| v.as_i64());
        let last_change_timestamp = cloud
            .and_then(|v| v.get("lastChangeTimestamp"))
            .and_then(|v| v.as_i64());
        let last_backup_timestamp = cloud
            .and_then(|v| v.get("lastBackupTimestamp"))
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
            organization_name,
            language,
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
            library_summary: None,
            last_snapshot_timestamp,
            last_change_timestamp,
            last_backup_timestamp,
        };

        Ok(settings)
    }

    /// Saves the system settings
    pub fn save_app_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        let mut store = self.load_store()?;

        store["id"] = serde_json::json!(settings.computer_id);
        store["computerName"] =
            serde_json::json!(settings.computer_name.clone().unwrap_or_default());
        store["type"] = serde_json::json!(settings.computer_type.as_store_str());

        if let Some(language) = settings.language.as_ref() {
            let language = language.trim();
            if !language.is_empty() {
                store["language"] = serde_json::json!(language);
            } else {
                store
                    .as_object_mut()
                    .map(|obj| obj.remove("language"));
            }
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("language"));
        }

        if let Some(organization_name) = settings.organization_name.as_ref() {
            let organization_name = organization_name.trim();
            if !organization_name.is_empty() {
                store["organizationName"] = serde_json::json!(organization_name);
            } else {
                store
                    .as_object_mut()
                    .map(|obj| obj.remove("organizationName"));
            }
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("organizationName"));
        }

        if let Some(ref rclone_cfg) = settings.rclone_config {
            let rclone_json = serde_json::to_value(rclone_cfg).map_err(|e| {
                AppError::Generic(format!("Error serializing rclone config: {}", e))
            })?;
            store["rclone"] = rclone_json;
        } else {
            store.as_object_mut().map(|obj| obj.remove("rclone"));
        }

        store["cloud"] = serde_json::json!({
            "lastSnapshotTimestamp": settings.last_snapshot_timestamp.unwrap_or(0),
            "lastChangeTimestamp": settings.last_change_timestamp.unwrap_or(0),
            "lastBackupTimestamp": settings.last_backup_timestamp.unwrap_or(0),
        });

        let mode_str = match settings.google_drive_mode {
            GoogleDriveMode::Local => "local",
            GoogleDriveMode::Api => "api",
        };
        store["google_drive_mode"] = serde_json::json!(mode_str);

        store["first_run_completed"] = serde_json::json!(settings.first_run_completed);

        if let Some(ref account) = settings.google_service_account {
            let account_json = serde_json::to_value(account).map_err(|e| {
                AppError::Generic(format!("Error serializing service account: {}", e))
            })?;
            store["google_service_account"] = account_json;
        } else {
            store
                .as_object_mut()
                .map(|obj| obj.remove("google_service_account"));
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

        store
            .as_object_mut()
            .map(|obj| obj.remove("library_summary"));

        if let Some(last_snapshot_timestamp) = settings.last_snapshot_timestamp {
            store["cloud"]["lastSnapshotTimestamp"] = serde_json::json!(last_snapshot_timestamp);
        }

        if let Some(last_change_timestamp) = settings.last_change_timestamp {
            store["cloud"]["lastChangeTimestamp"] = serde_json::json!(last_change_timestamp);
        }

        if let Some(last_backup_timestamp) = settings.last_backup_timestamp {
            store["cloud"]["lastBackupTimestamp"] = serde_json::json!(last_backup_timestamp);
        }

        self.save_store(&store)?;

        info!(
            "Settings saved successfully to store at: {:?}",
            self.store_path
        );
        Ok(())
    }

    /// Saves the system settings and updates the backup_database_step.updated_at
    /// with the timestamp of the latest change in any song (cascade effect)
    #[allow(dead_code)]
    pub fn save_app_settings_with_db(
        &self,
        settings: &mut AppSettings,
        db: &crate::infrastructure::database::Database,
    ) -> Result<(), AppError> {
        // Get the most recent updated_at from songs
        if let Some(latest_timestamp) = db.get_latest_songs_update_timestamp()? {
            // Update or create the backup_database_step with the most recent timestamp
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

    /// Saves a generic value in the store
    #[allow(dead_code)]
    pub fn set(&self, key: &str, value: serde_json::Value) -> Result<(), AppError> {
        let mut store = self.load_store()?;
        store[key] = value;
        self.save_store(&store)?;
        Ok(())
    }

    /// Gets a generic value from the store
    #[allow(dead_code)]
    pub fn get(&self, key: &str) -> Result<Option<serde_json::Value>, AppError> {
        let store = self.load_store()?;
        Ok(store.get(key).cloned())
    }

    /// Gets the application data directory (where the store is stored)
    #[allow(dead_code)]
    pub fn get_app_data_dir(&self) -> PathBuf {
        self.store_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."))
    }
}

#[cfg(test)]
mod tests {
    use super::SystemStore;
    use crate::domain::models::{AppSettings, ComputerType, LibraryStatusSummary, LibrarySummary};
    use crate::test_support::create_test_app_data_dir;

    #[test]
    fn does_not_persist_library_summary_in_store() {
        let dir = create_test_app_data_dir("store-library-summary");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            organization_name: Some("Orquestra".to_string()),
            computer_type: ComputerType::Server,
            first_run_completed: true,
            library_summary: Some(LibrarySummary {
                main: LibraryStatusSummary {
                    songs_count: 2,
                    scores_count: 4,
                },
                draft: LibraryStatusSummary {
                    songs_count: 1,
                    scores_count: 1,
                },
            }),
            ..Default::default()
        };

        store.save_app_settings(&settings).expect("save settings");

        let raw_store = store.load_store().expect("load store");
        assert!(raw_store.get("library_summary").is_none());

        let reloaded = store.get_app_settings().expect("reload settings");
        assert!(reloaded.library_summary.is_none());
    }

    #[test]
    fn persists_documented_store_shape() {
        let dir = create_test_app_data_dir("store-shape");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "server-2".to_string(),
            computer_name: Some("Server".to_string()),
            organization_name: Some("Orquestra".to_string()),
            computer_type: ComputerType::Server,
            rclone_config: Some(crate::domain::models::RcloneConfig {
                provider: crate::domain::models::RcloneProvider::Koofr,
            }),
            first_run_completed: true,
            ..Default::default()
        };

        store.save_app_settings(&settings).expect("save settings");

        let raw_store = store.load_store().expect("load store");
        assert_eq!(
            raw_store.get("id").and_then(|v| v.as_str()),
            Some("server-2")
        );
        assert_eq!(
            raw_store.get("computerName").and_then(|v| v.as_str()),
            Some("Server")
        );
        assert_eq!(
            raw_store.get("organizationName").and_then(|v| v.as_str()),
            Some("Orquestra")
        );
        assert_eq!(
            raw_store.get("type").and_then(|v| v.as_str()),
            Some("server")
        );
        assert!(raw_store.get("rclone").is_some());
        assert!(raw_store.get("cloud").is_some());
        assert!(raw_store.get("computer_id").is_none());
        assert!(raw_store.get("computer_name").is_none());
        assert!(raw_store.get("organization_name").is_none());
        assert!(raw_store.get("computer_type").is_none());
        assert!(raw_store.get("rclone_config").is_none());

        let loaded = store.get_app_settings().expect("reload settings");
        assert_eq!(loaded.computer_id, "server-2");
        assert_eq!(loaded.computer_name.as_deref(), Some("Server"));
        assert_eq!(loaded.organization_name.as_deref(), Some("Orquestra"));
        assert_eq!(loaded.computer_type, ComputerType::Server);
        assert!(loaded.rclone_config.is_some());
    }
}
