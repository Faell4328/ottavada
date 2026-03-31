use tauri::State;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_msgpack_service::{
    export_backup_msgpack, import_backup_msgpack, BackupFileSummary, BackupImportSummary,
};
use crate::services::backup_songs_service::{generate_song_archives, SongArchiveSummary};
use crate::services::client_sync_service::{apply_server_changes_for_client, ClientSyncSummary};
use crate::services::events_service::{generate_events_msgpack, EventsFileSummary};
use crate::services::snapshot_service::{generate_snapshot_msgpack, SnapshotFileSummary};

#[tauri::command]
pub async fn generate_song_archives_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<SongArchiveSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir.clone());
        let settings = store.get_app_settings()?;
        settings.require_server_only()?;

        let cloud_root = app_data_dir.join("cloud");
        std::fs::create_dir_all(&cloud_root)
            .map_err(|e| AppError::Generic(format!("Erro ao preparar diretório cloud: {}", e)))?;

        generate_song_archives(&db, &cloud_root)
    })
    .await
    .map_err(|e| AppError::Generic(format!("Falha interna ao gerar arquivos das músicas: {}", e)))?
}

#[tauri::command]
pub async fn generate_events_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<EventsFileSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir);
        let settings = store.get_app_settings()?;
        settings.require_server_only()?;

        generate_events_msgpack(&db, &store)
    })
    .await
    .map_err(|e| AppError::Generic(format!("Falha interna ao gerar events.msgpack: {}", e)))?
}

#[tauri::command]
pub async fn generate_snapshot_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<SnapshotFileSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir);
        let settings = store.get_app_settings()?;
        settings.require_server_only()?;

        generate_snapshot_msgpack(&db, &store)
    })
    .await
    .map_err(|e| AppError::Generic(format!("Falha interna ao gerar snapshot.msgpack: {}", e)))?
}

#[tauri::command]
pub fn export_backup_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    output_path: Option<String>,
) -> Result<BackupFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    export_backup_msgpack(&db, &store, output_path)
}

#[tauri::command]
pub fn import_backup_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    backup_path: String,
) -> Result<BackupImportSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    import_backup_msgpack(&db, &store, backup_path)
}

#[tauri::command]
pub async fn apply_server_changes_on_client(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<ClientSyncSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir);
        apply_server_changes_for_client(&db, &store)
    })
    .await
    .map_err(|e| {
        AppError::Generic(format!(
            "Falha interna ao aplicar alterações do servidor no cliente: {}",
            e
        ))
    })?
}
