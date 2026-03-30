use tauri::State;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_songs_service::{generate_song_archives, SongArchiveSummary};

#[tauri::command]
pub fn generate_song_archives_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<SongArchiveSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let cloud_root = store.app_data_dir().join("nuvem");
    std::fs::create_dir_all(&cloud_root)
        .map_err(|e| AppError::Generic(format!("Erro ao preparar diretório nuvem: {}", e)))?;

    generate_song_archives(&db, &cloud_root)
}
