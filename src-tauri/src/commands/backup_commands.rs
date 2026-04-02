use tauri::State;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_msgpack_service::{
    export_backup_msgpack, import_backup_msgpack, BackupFileSummary, BackupImportSummary,
};
use crate::services::backup_songs_service::{
    generate_song_archives, regenerate_all_song_archives, SongArchiveSummary,
};
use crate::services::client_sync_service::{apply_server_changes_for_client, ClientSyncSummary};
use crate::services::events_service::{generate_events_msgpack, EventsFileSummary};
use crate::services::snapshot_service::{generate_snapshot_msgpack, SnapshotFileSummary};

fn delete_existing_song_archives(app_data_dir: &std::path::Path) -> Result<usize, AppError> {
    let songs_dir = app_data_dir.join("cloud").join("songs");
    if !songs_dir.exists() {
        return Ok(0);
    }

    let deleted_count = std::fs::read_dir(&songs_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao listar diretório de músicas: {}", e)))?
        .count();

    std::fs::remove_dir_all(&songs_dir).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao limpar diretório de músicas durante regeneração forçada: {}",
            e
        ))
    })?;

    std::fs::create_dir_all(&songs_dir).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao recriar diretório de músicas após limpeza forçada: {}",
            e
        ))
    })?;

    Ok(deleted_count)
}

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

        generate_song_archives(&db, &app_data_dir, &cloud_root)
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
    force_regenerate_song_archives: Option<bool>,
) -> Result<SnapshotFileSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();
    let force_regenerate_song_archives = force_regenerate_song_archives.unwrap_or(false);

    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir.clone());
        let settings = store.get_app_settings()?;
        settings.require_server_only()?;

        if force_regenerate_song_archives {
            let cloud_root = app_data_dir.join("cloud");
            std::fs::create_dir_all(&cloud_root).map_err(|e| {
                AppError::Generic(format!("Erro ao preparar diretório cloud: {}", e))
            })?;
            regenerate_all_song_archives(&db, &app_data_dir, &cloud_root)?;
        }

        let summary = generate_snapshot_msgpack(&db, &store)?;

        Ok(summary)
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

    let summary = import_backup_msgpack(&db, &store, backup_path)?;
    delete_existing_song_archives(store.app_data_dir())?;
    db.mark_all_song_archives_for_regeneration()?;
    Ok(summary)
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
