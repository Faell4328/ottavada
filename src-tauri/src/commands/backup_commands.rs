use tauri::State;

use crate::commands::common::{require_server_settings, run_blocking_with_store};
use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_msgpack_service::{
    export_backup_msgpack, force_generate_backup_msgpack_in_cloud,
    generate_automatic_backup_msgpack, import_backup_msgpack, import_backup_msgpack_from_cloud,
    BackupFileSummary, BackupImportSummary,
};
use crate::services::backup_songs_service::{
    generate_song_archives, regenerate_all_song_archives, SongArchiveSummary,
};
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

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao gerar arquivos das músicas",
        move |store| {
            require_server_settings(&store)?;

            let cloud_root = store.app_data_dir().join("cloud");
            std::fs::create_dir_all(&cloud_root).map_err(|e| {
                AppError::Generic(format!("Erro ao preparar diretório cloud: {}", e))
            })?;

            generate_song_archives(&db, store.app_data_dir(), &cloud_root)
        },
    )
    .await
}

#[tauri::command]
pub async fn generate_events_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<EventsFileSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao gerar events.msgpack",
        move |store| {
            require_server_settings(&store)?;

            generate_events_msgpack(&db, &store)
        },
    )
    .await
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

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao gerar snapshot.msgpack",
        move |store| {
            require_server_settings(&store)?;

            if force_regenerate_song_archives {
                let cloud_root = store.app_data_dir().join("cloud");
                std::fs::create_dir_all(&cloud_root).map_err(|e| {
                    AppError::Generic(format!("Erro ao preparar diretório cloud: {}", e))
                })?;
                regenerate_all_song_archives(&db, store.app_data_dir(), &cloud_root)?;
            }

            let summary = generate_snapshot_msgpack(&db, &store)?;

            Ok(summary)
        },
    )
    .await
}

#[tauri::command]
pub async fn export_backup_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    output_path: Option<String>,
) -> Result<BackupFileSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao exportar backup local",
        move |store| {
            require_server_settings(&store)?;
            export_backup_msgpack(&db, &store, output_path)
        },
    )
    .await
}

#[tauri::command]
pub async fn import_backup_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    backup_path: String,
) -> Result<BackupImportSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao importar backup local",
        move |store| {
            require_server_settings(&store)?;

            import_backup_msgpack(&db, &store, backup_path)
        },
    )
    .await
}

#[tauri::command]
pub async fn generate_automatic_backup_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<Option<BackupFileSummary>, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao gerar backup automático",
        move |store| {
            require_server_settings(&store)?;

            generate_automatic_backup_msgpack(&db, &store)
        },
    )
    .await
}

#[tauri::command]
pub async fn force_generate_backup_cloud_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<BackupFileSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao gerar backup da nuvem",
        move |store| {
            require_server_settings(&store)?;

            force_generate_backup_msgpack_in_cloud(&db, &store)
        },
    )
    .await
}

#[tauri::command]
pub async fn import_backup_cloud_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<BackupImportSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao importar backup da nuvem",
        move |store| {
            require_server_settings(&store)?;

            import_backup_msgpack_from_cloud(&db, &store)
        },
    )
    .await
}

#[tauri::command]
pub async fn apply_server_changes_on_client(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<ClientSyncSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao aplicar alterações do servidor no cliente",
        move |store| apply_server_changes_for_client(&db, &store),
    )
    .await
}
