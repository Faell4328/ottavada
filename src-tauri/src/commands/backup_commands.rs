use tauri::State;

use crate::commands::common::{require_server_settings, run_blocking_with_store};
use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_msgpack_service::{
    export_backup_msgpack, generate_backup_msgpack_in_cloud, import_backup_msgpack,
    import_backup_msgpack_from_cloud, import_backup_msgpack_from_cloud_by_name,
    restore_database_from_cloud_backup, restore_song_files_from_cloud_archives,
    validate_cloud_backup, BackupFileSummary, BackupImportSummary, CloudBackupValidation,
};
use crate::services::backup_songs_service::{
    generate_song_archives, regenerate_all_song_archives, SongArchiveSummary,
};
use crate::services::backup_draft_ignored_service::restore_draft_ignored_scores_from_backup;
use crate::services::client_sync_service::{apply_server_changes_for_client, ClientSyncSummary};
use crate::services::cloud_paths::ensure_cloud_root_dir;
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
        "Internal failure generating song archives",
        move |store| {
            require_server_settings(&store)?;

            let cloud_root = ensure_cloud_root_dir(store.app_data_dir())?;

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
        "Internal failure generating events.msgpack",
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
        "Internal failure generating snapshot.msgpack",
        move |store| {
            require_server_settings(&store)?;

            if force_regenerate_song_archives {
                let cloud_root = ensure_cloud_root_dir(store.app_data_dir())?;
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
        "Internal failure exporting local backup",
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
        "Internal failure importing local backup",
        move |store| {
            require_server_settings(&store)?;

            import_backup_msgpack(&db, &store, backup_path)
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
        "Internal failure generating cloud backup",
        move |store| {
            require_server_settings(&store)?;

            generate_backup_msgpack_in_cloud(&db, &store)
        },
    )
    .await
}

#[tauri::command]
pub async fn validate_cloud_backup_cmd(
    store: State<'_, SystemStore>,
) -> Result<CloudBackupValidation, AppError> {
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Internal failure validating cloud backup",
        move |store| validate_cloud_backup(&store),
    )
    .await
}

#[tauri::command]
pub async fn restore_backup_db_from_cloud(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<BackupImportSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Internal failure restoring database from backup",
        move |store| restore_database_from_cloud_backup(&db, &store),
    )
    .await
}

#[derive(serde::Serialize)]
pub struct RestoreSongsResult {
    songs_restored: usize,
    scores_restored: usize,
    scores_replaced: usize,
}

#[tauri::command]
pub async fn restore_songs_from_cloud_archives(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<RestoreSongsResult, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Internal failure restoring scores",
        move |store| {
            let stats = restore_song_files_from_cloud_archives(&db, store.app_data_dir())?;
            Ok(RestoreSongsResult {
                songs_restored: stats.songs_restored,
                scores_restored: stats.scores_restored,
                scores_replaced: stats.scores_replaced,
            })
        },
    )
    .await
}

#[tauri::command]
pub async fn restore_draft_ignored_from_cloud(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<usize, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Internal failure restoring draft/ignored scores",
        move |store| {
            require_server_settings(&store)?;
            restore_draft_ignored_scores_from_backup(&db, &store)
        },
    )
    .await
}

#[tauri::command]
pub async fn import_backup_cloud_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    backup_file_name: Option<String>,
) -> Result<BackupImportSummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Internal failure importing cloud backup",
        move |store| {
            require_server_settings(&store)?;

            match backup_file_name.as_deref() {
                Some(name) if !name.trim().is_empty() => {
                    import_backup_msgpack_from_cloud_by_name(&db, &store, Some(name))
                }
                _ => import_backup_msgpack_from_cloud(&db, &store),
            }
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
        "Internal failure applying server changes on the client",
        move |store| apply_server_changes_for_client(&db, &store),
    )
    .await
}
