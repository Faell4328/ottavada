use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::commands::rclone_commands::sync_cloud_directory_with_rclone_impl;
use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, LibraryStatusSummary, LibrarySummary, OperationGuard};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_draft_ignored_service::backup_draft_ignored_scores;
use crate::services::cloud_paths::ensure_backup_cloud_dir;
use crate::services::msgpack_zstd::{
    compress_zstd_with_threads, serialize_msgpack_named, write_atomic, ZSTD_LEVEL_BALANCED,
};
use crate::services::path_normalizer::from_storage_path;

const BACKUP_FILE_PREFIX: &str = "backup - ";
const BACKUP_FILE_EXTENSION: &str = ".msgpack.zst";
const MAX_BACKUP_FILES: usize = 10;
const MIN_BACKUP_SIZE_BYTES: u64 = 1024;
const BACKUP_SCHEMA_VERSION: u32 = 1;
const AUTO_BACKUP_INTERVAL_SECONDS: i64 = 60 * 60;

fn backup_filename(timestamp: i64) -> String {
    format!(
        "{}{}{}",
        BACKUP_FILE_PREFIX, timestamp, BACKUP_FILE_EXTENSION
    )
}

fn parse_backup_timestamp(filename: &str) -> Option<i64> {
    let without_prefix = filename.strip_prefix(BACKUP_FILE_PREFIX)?;
    let without_extension = without_prefix.strip_suffix(BACKUP_FILE_EXTENSION)?;
    without_extension.parse::<i64>().ok()
}

fn list_backup_files(backup_dir: &Path) -> Result<Vec<(i64, PathBuf)>, AppError> {
    let mut backups: Vec<(i64, PathBuf)> = Vec::new();
    if !backup_dir.is_dir() {
        return Ok(backups);
    }
    for entry in fs::read_dir(backup_dir)
        .map_err(|e| AppError::Generic(format!("Error reading backup directory: {}", e)))?
    {
        let entry = entry.map_err(|e| {
            AppError::Generic(format!("Error reading backup directory entry: {}", e))
        })?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let Some(timestamp) = parse_backup_timestamp(file_name) else {
            continue;
        };
        backups.push((timestamp, path));
    }
    backups.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(backups)
}

fn cleanup_old_backups(backup_dir: &Path) -> Result<usize, AppError> {
    let backups = list_backup_files(backup_dir)?;
    let mut removed = 0;
    for (_timestamp, path) in backups.iter().skip(MAX_BACKUP_FILES) {
        if let Err(e) = fs::remove_file(path) {
            warn!("Error removing old backup {}: {}", path.display(), e);
        } else {
            removed += 1;
        }
    }
    if removed > 0 {
        info!("Removed {} old backups", removed);
    }
    Ok(removed)
}

fn find_latest_valid_backup(backup_dir: &Path) -> Result<Option<PathBuf>, AppError> {
    let backups = list_backup_files(backup_dir)?;
    for (_timestamp, path) in &backups {
        let Ok(metadata) = fs::metadata(path) else {
            continue;
        };
        if metadata.len() > MIN_BACKUP_SIZE_BYTES {
            return Ok(Some(path.clone()));
        }
    }
    Ok(None)
}

fn read_backup_payload_from_file(path: &Path) -> Result<BackupMessagePack, AppError> {
    let bytes = fs::read(path).map_err(|e| {
        AppError::Generic(format!(
            "Error reading backup file {}: {}",
            path.display(),
            e
        ))
    })?;

    let msgpack_bytes = match zstd::stream::decode_all(&bytes[..]) {
        Ok(decoded) => decoded,
        Err(_) => bytes,
    };

    rmp_serde::from_slice(&msgpack_bytes).map_err(|e| {
        AppError::Generic(format!(
            "Error deserializing backup {}: {}",
            path.display(),
            e
        ))
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileSummary {
    pub output_path: String,
    pub file_size: u64,
    pub generated_at: i64,
    pub songs_count: usize,
    pub scores_count: usize,
    pub categories_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupImportSummary {
    pub input_path: String,
    pub generated_at: i64,
    pub songs_count: usize,
    pub scores_count: usize,
    pub categories_count: usize,
    pub songs_restored: usize,
    pub scores_restored: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudBackupValidation {
    pub found: bool,
    pub generated_at: i64,
    pub songs_count: usize,
    pub scores_count: usize,
    pub categories_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupMessagePack {
    schema_version: u32,
    generated_at: i64,
    settings: AppSettings,
    categories: Vec<BackupCategory>,
    songs: Vec<BackupSong>,
    scores: Vec<BackupScore>,
    #[serde(rename = "categoriesSongs")]
    categories_songs: Vec<BackupCategorySong>,
    #[serde(rename = "changes")]
    changed_field: Vec<BackupChangedField>,
    #[serde(rename = "backupQueue")]
    backup_songs: Vec<BackupSongStatusRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupCategory {
    id: String,
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupSong {
    id: String,
    name: String,
    composer: Option<String>,
    arranger: Option<String>,
    path: String,
    is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupScore {
    id: String,
    song_id: String,
    name: Option<String>,
    file_path: String,
    file_name: String,
    file_size: u64,
    file_modified_at: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupCategorySong {
    id: String,
    category_id: String,
    song_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupChangedField {
    id: String,
    #[serde(rename = "type")]
    change_type: String,
    entity: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    field: Option<String>,
    value: Option<String>,
    timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupSongStatusRecord {
    id: String,
    song_id: String,
    status: String,
    last_backup_at: Option<i64>,
    error_message: Option<String>,
}

#[derive(Debug, Clone)]
struct SongScoreRef {
    song_id: String,
    song_path: String,
    score_id: String,
    file_name: String,
}

pub fn export_backup_msgpack(
    db: &Database,
    store: &SystemStore,
    output_path: Option<String>,
) -> Result<BackupFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let payload = collect_backup_payload(db, settings)?;
    let bytes = serialize_msgpack_named(&payload, "backup.msgpack")?;

    let output_path = resolve_output_path(store, output_path)?;

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            AppError::Generic(format!(
                "Error creating directory for backup.msgpack: {}",
                e
            ))
        })?;
    }

    write_atomic(&output_path, &bytes, "backup.msgpack")?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| {
            AppError::Generic(format!("Error getting backup.msgpack metadata: {}", e))
        })?
        .len();

    Ok(BackupFileSummary {
        output_path: output_path.to_string_lossy().to_string(),
        file_size,
        generated_at: payload.generated_at,
        songs_count: payload.songs.len(),
        scores_count: payload.scores.len(),
        categories_count: payload.categories.len(),
    })
}

pub fn import_backup_msgpack(
    db: &Database,
    store: &SystemStore,
    backup_path: String,
) -> Result<BackupImportSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let path = PathBuf::from(&backup_path);
    restore_backup_from_path(db, store, &path, &settings)
}

fn compute_library_summary_from_payload(payload: &BackupMessagePack) -> LibrarySummary {
    let mut main_scores = 0_usize;
    let mut draft_scores = 0_usize;
    let mut main_song_ids = std::collections::HashSet::new();
    let mut draft_song_ids = std::collections::HashSet::new();

    for score in &payload.scores {
        match score.status.as_str() {
            "main" => {
                main_scores += 1;
                main_song_ids.insert(&score.song_id);
            }
            "draft" => {
                draft_scores += 1;
                draft_song_ids.insert(&score.song_id);
            }
            _ => {}
        }
    }

    LibrarySummary {
        main: LibraryStatusSummary {
            songs_count: main_song_ids.len(),
            scores_count: main_scores,
        },
        draft: LibraryStatusSummary {
            songs_count: draft_song_ids.len(),
            scores_count: draft_scores,
        },
    }
}

fn restore_backup_from_path(
    db: &Database,
    store: &SystemStore,
    path: &Path,
    current_settings: &AppSettings,
) -> Result<BackupImportSummary, AppError> {
    let payload = read_backup_payload_from_file(path)?;

    if payload.schema_version != BACKUP_SCHEMA_VERSION {
        return Err(AppError::Generic(format!(
            "Unsupported backup schema version: {}",
            payload.schema_version
        )));
    }

    let mut payload = payload;
    if let Some(current_rclone_config) = current_settings.rclone_config.clone() {
        payload.settings.rclone_config = Some(current_rclone_config);
    }

    payload.settings.library_summary = Some(compute_library_summary_from_payload(&payload));

    restore_backup_payload(db, &payload)?;

    store.save_app_settings(&payload.settings)?;

    Ok(BackupImportSummary {
        input_path: path.to_string_lossy().to_string(),
        generated_at: payload.generated_at,
        songs_count: payload.songs.len(),
        scores_count: payload.scores.len(),
        categories_count: payload.categories.len(),
        songs_restored: 0,
        scores_restored: 0,
    })
}

pub fn generate_automatic_backup_msgpack(
    db: &Database,
    store: &SystemStore,
) -> Result<Option<BackupFileSummary>, AppError> {
    generate_backup_msgpack_in_cloud(db, store, false)
}

pub fn force_generate_backup_msgpack_in_cloud(
    db: &Database,
    store: &SystemStore,
) -> Result<BackupFileSummary, AppError> {
    generate_backup_msgpack_in_cloud(db, store, true)?
        .ok_or_else(|| AppError::Generic("Failed to generate cloud backup".to_string()))
}

fn generate_backup_msgpack_in_cloud(
    db: &Database,
    store: &SystemStore,
    force: bool,
) -> Result<Option<BackupFileSummary>, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let now = chrono::Local::now().timestamp();
    if !force
        && !should_generate_automatic_backup_from_timestamps(settings.last_backup_timestamp, now)
    {
        return Ok(None);
    }

    let payload = collect_backup_payload(db, settings)?;

    if !force && payload.songs.is_empty() {
        info!("Empty library: automatic backup skipped");
        return Ok(None);
    }

    let msgpack_bytes = serialize_msgpack_named(&payload, "backup.msgpack")?;
    let compressed =
        compress_zstd_with_threads(&msgpack_bytes, ZSTD_LEVEL_BALANCED, "backup.msgpack.zst")?;

    let backup_dir = ensure_backup_cloud_dir(store.app_data_dir())?;

    sync_cloud_directory_with_rclone_impl(store, "download", Some("backup"))
        .map_err(|e| AppError::Generic(format!("Could not download existing backups: {}", e)))?;

    let backup_path = backup_dir.join(backup_filename(payload.generated_at));

    write_atomic(&backup_path, &compressed, "backup.msgpack.zst")?;

    let file_size = fs::metadata(&backup_path)
        .map_err(|e| AppError::Generic(format!("Error getting backup metadata: {}", e)))?
        .len();

    cleanup_old_backups(&backup_dir)?;

    sync_cloud_directory_with_rclone_impl(store, "upload", Some("backup"))?;

    let draft_count = backup_draft_ignored_scores(db, store)?;
    if draft_count > 0 {
        info!("Backup of {} draft/ignored scores completed", draft_count);
    }

    let mut updated_settings = store.get_app_settings()?;
    updated_settings.last_backup_timestamp = Some(payload.generated_at);
    store.save_app_settings(&updated_settings)?;

    Ok(Some(BackupFileSummary {
        output_path: backup_path.to_string_lossy().to_string(),
        file_size,
        generated_at: payload.generated_at,
        songs_count: payload.songs.len(),
        scores_count: payload.scores.len(),
        categories_count: payload.categories.len(),
    }))
}

pub fn import_backup_msgpack_from_cloud(
    db: &Database,
    store: &SystemStore,
) -> Result<BackupImportSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let _validation = validate_cloud_backup(store)?;

    sync_cloud_directory_with_rclone_impl(store, "download", Some("songs"))?;

    let mut summary = restore_database_from_cloud_backup(db, store)?;

    let (songs_restored, scores_restored) =
        restore_song_files_from_cloud_archives(db, store.app_data_dir())?;

    summary.songs_restored = songs_restored;
    summary.scores_restored = scores_restored;

    let draft_count = crate::services::backup_draft_ignored_service::restore_draft_ignored_scores_from_backup(
        db, store,
    )?;
    if draft_count > 0 {
        info!("{} draft/ignored scores restored from backup", draft_count);
    }

    Ok(summary)
}

pub fn validate_cloud_backup(store: &SystemStore) -> Result<CloudBackupValidation, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    sync_cloud_directory_with_rclone_impl(store, "download", Some("backup"))?;

    let backup_dir = ensure_backup_cloud_dir(store.app_data_dir())?;

    let backup_path = find_latest_valid_backup(&backup_dir)?.ok_or_else(|| {
        AppError::Generic(
            "No valid backup found in the cloud. Check that a backup has been generated before."
                .to_string(),
        )
    })?;

    let payload = read_backup_payload_from_file(&backup_path)?;

    Ok(CloudBackupValidation {
        found: true,
        generated_at: payload.generated_at,
        songs_count: payload.songs.len(),
        scores_count: payload.scores.len(),
        categories_count: payload.categories.len(),
    })
}

pub fn restore_database_from_cloud_backup(
    db: &Database,
    store: &SystemStore,
) -> Result<BackupImportSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let backup_dir = ensure_backup_cloud_dir(store.app_data_dir())?;

    let backup_path = find_latest_valid_backup(&backup_dir)?.ok_or_else(|| {
        AppError::Generic(
            "No valid backup found in the cloud. Check that a backup has been generated before."
                .to_string(),
        )
    })?;

    let summary = restore_backup_from_path(db, store, &backup_path, &settings)?;

    db.clear_changed_fields()?;

    let mut updated_settings = store.get_app_settings()?;
    updated_settings.last_snapshot_timestamp = None;
    updated_settings.last_change_timestamp = None;
    store.save_app_settings(&updated_settings)?;

    Ok(summary)
}

pub fn restore_song_files_from_cloud_archives(
    db: &Database,
    app_data_dir: &Path,
) -> Result<(usize, usize), AppError> {
    let result = restore_missing_songs_from_archives(db, app_data_dir)?;

    let tmp_dir = app_data_dir.join("tmp");
    if tmp_dir.exists() {
        let _ = empty_directory_contents(&tmp_dir);
    }

    Ok(result)
}

pub fn restore_missing_songs_from_archives(
    db: &Database,
    app_data_dir: &Path,
) -> Result<(usize, usize), AppError> {
    let songs_cloud_dir = app_data_dir.join("cloud").join("songs");
    let temp_songs_root = app_data_dir.join("tmp").join("songs");

    if temp_songs_root.exists() {
        let _ = empty_directory_contents(&temp_songs_root);
    }

    let mut extracted_song_ids = std::collections::HashSet::new();

    if songs_cloud_dir.is_dir() {
        for entry in fs::read_dir(&songs_cloud_dir).map_err(|e| {
            AppError::Generic(format!("Error reading cloud songs directory: {}", e))
        })? {
            let entry = entry.map_err(|e| {
                AppError::Generic(format!(
                    "Error reading songs directory entry: {}",
                    e
                ))
            })?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            let Some(song_id) = file_name.strip_suffix(".tar.zst") else {
                continue;
            };

            let temp_song_dir = temp_songs_root.join(song_id);
            fs::create_dir_all(&temp_song_dir).map_err(|e| {
                AppError::Generic(format!(
                    "Error creating temporary directory for song {}: {}",
                    song_id, e
                ))
            })?;

            extract_full_archive(&path, &temp_song_dir, song_id)?;
            extracted_song_ids.insert(song_id.to_string());
        }
    }

    let score_refs = query_song_score_refs(db)?;

    let mut song_dirs_created = std::collections::HashSet::new();
    let mut scores_restored = 0_usize;

    for score_ref in &score_refs {
        if !extracted_song_ids.contains(&score_ref.song_id) {
            continue;
        }

        let song_dir = PathBuf::from(from_storage_path(&score_ref.song_path));
        let destination = song_dir.join(&score_ref.file_name);

        if destination.exists() {
            continue;
        }

        if !song_dirs_created.contains(&score_ref.song_id) {
            fs::create_dir_all(&song_dir).map_err(|e| {
                AppError::Generic(format!(
                    "Error creating song directory {}: {}",
                    song_dir.display(),
                    e
                ))
            })?;
            song_dirs_created.insert(score_ref.song_id.clone());
        }

        let temp_song_dir = temp_songs_root.join(&score_ref.song_id);
        match move_score_from_temp(&temp_song_dir, &score_ref.score_id, &destination) {
            Ok(true) => {
                info!(
                    "Score restored: {} -> {}",
                    score_ref.score_id,
                    destination.display()
                );
                scores_restored += 1;
            }
            Ok(false) => {
                warn!(
                    "Score {} not found in the temporary directory of song {}",
                    score_ref.score_id, score_ref.song_id
                );
            }
            Err(e) => {
                warn!(
                    "Could not restore score {} of song {}: {}",
                    score_ref.score_id, score_ref.song_id, e
                );
            }
        }
    }

    let _ = empty_directory_contents(&temp_songs_root);

    Ok((song_dirs_created.len(), scores_restored))
}

fn query_song_score_refs(db: &Database) -> Result<Vec<SongScoreRef>, AppError> {
    let conn = db.lock_conn();
    let mut stmt = conn.prepare(
        "SELECT s.id, s.path, sc.id, sc.file_name
         FROM songs s
         JOIN scores sc ON sc.song_id = s.id
         WHERE sc.status = 'main'
         ORDER BY s.id, sc.id",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(SongScoreRef {
            song_id: row.get(0)?,
            song_path: row.get(1)?,
            score_id: row.get(2)?,
            file_name: row.get(3)?,
        })
    })?;

    let result: Result<Vec<_>, _> = rows.collect();
    Ok(result?)
}

fn extract_full_archive(
    archive_path: &Path,
    dest_dir: &Path,
    song_id: &str,
) -> Result<(), AppError> {
    let archive_file = File::open(archive_path).map_err(|e| {
        AppError::Generic(format!(
            "Error opening compressed file {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    let decoder = zstd::stream::read::Decoder::new(archive_file).map_err(|e| {
        AppError::Generic(format!(
            "Error decompressing file {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    let mut archive = tar::Archive::new(decoder);
    let entries = archive.entries().map_err(|e| {
        AppError::Generic(format!(
            "Error listing package files {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    for entry_result in entries {
        let mut entry = entry_result.map_err(|e| {
            AppError::Generic(format!(
                "Error reading package entry {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        if !entry.header().entry_type().is_file() {
            continue;
        }

        let entry_path = entry.path().map_err(|e| {
            AppError::Generic(format!(
                "Error reading path inside package {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        let file_name = match entry_path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_owned(),
            None => continue,
        };

        let output_path = dest_dir.join(&file_name);
        entry.unpack(&output_path).map_err(|e| {
            AppError::Generic(format!(
                "Error extracting score {} from package {}: {}",
                file_name,
                archive_path.display(),
                e
            ))
        })?;
    }

    info!(
        "Files of song {} extracted to {}",
        song_id,
        dest_dir.display()
    );

    Ok(())
}

fn move_score_from_temp(
    temp_song_dir: &Path,
    score_id: &str,
    destination: &Path,
) -> Result<bool, AppError> {
    for entry in fs::read_dir(temp_song_dir).map_err(|e| {
        AppError::Generic(format!(
            "Error reading temporary directory {}: {}",
            temp_song_dir.display(),
            e
        ))
    })? {
        let entry = entry.map_err(|e| {
            AppError::Generic(format!(
                "Error reading temporary directory entry: {}",
                e
            ))
        })?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let stem = Path::new(file_name).file_stem().and_then(|s| s.to_str());

        if stem == Some(score_id) || file_name == score_id {
            if destination.exists() {
                fs::remove_file(destination).map_err(|e| {
                    AppError::Generic(format!(
                        "Error removing existing file {}: {}",
                        destination.display(),
                        e
                    ))
                })?;
            }
            fs::copy(&path, destination).map_err(|e| {
                AppError::Generic(format!(
                    "Error copying score from {} to {}: {}",
                    path.display(),
                    destination.display(),
                    e
                ))
            })?;
            return Ok(true);
        }
    }
    Ok(false)
}

fn collect_backup_payload(
    db: &Database,
    settings: AppSettings,
) -> Result<BackupMessagePack, AppError> {
    let conn = db.lock_conn();
    let generated_at = chrono::Local::now().timestamp();

    let mut settings = settings;
    settings.last_backup_timestamp = Some(generated_at);

    let categories = {
        let mut stmt = conn.prepare("SELECT id, name FROM categories ORDER BY name ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupCategory {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let songs = {
        let mut stmt = conn.prepare(
            "SELECT id, name, composer, arranger, path, is_favorite
             FROM songs
             ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupSong {
                id: row.get(0)?,
                name: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                path: crate::services::path_normalizer::to_storage_path(&row.get::<_, String>(4)?),
                is_favorite: row.get::<_, bool>(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let scores = {
        let mut stmt = conn.prepare(
            "SELECT id, song_id, name, file_path, file_name, file_size, file_modified_at, status
             FROM scores
             ORDER BY song_id ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupScore {
                id: row.get(0)?,
                song_id: row.get(1)?,
                name: row.get(2)?,
                file_path: crate::services::path_normalizer::to_storage_path(
                    &row.get::<_, String>(3)?,
                ),
                file_name: row.get(4)?,
                file_size: row.get(5)?,
                file_modified_at: row.get(6)?,
                status: row.get(7)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let categories_songs = {
        let mut stmt = conn.prepare(
            "SELECT id, categoryId AS category_id, songId AS song_id
             FROM categoriesSongs
             ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupCategorySong {
                id: row.get(0)?,
                category_id: row.get(1)?,
                song_id: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let changed_field = {
        let mut stmt = conn.prepare(
            "SELECT id, type, entity, entityId, field, value, timestamp
             FROM changes
             ORDER BY timestamp ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupChangedField {
                id: row.get(0)?,
                change_type: row.get(1)?,
                entity: row.get(2)?,
                entity_id: row.get(3)?,
                field: row.get(4)?,
                value: row.get(5)?,
                timestamp: row.get(6)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let backup_songs = {
        let mut stmt = conn.prepare(
            "SELECT songId AS id, songId AS song_id, status
             FROM backupQueue
             ORDER BY songId ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupSongStatusRecord {
                id: row.get(0)?,
                song_id: row.get(1)?,
                status: row.get(2)?,
                last_backup_at: None,
                error_message: None,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    Ok(BackupMessagePack {
        schema_version: BACKUP_SCHEMA_VERSION,
        generated_at,
        settings,
        categories,
        songs,
        scores,
        categories_songs,
        changed_field,
        backup_songs,
    })
}

fn should_generate_automatic_backup_from_timestamps(
    last_backup_timestamp: Option<i64>,
    now_timestamp: i64,
) -> bool {
    match last_backup_timestamp {
        None => true,
        Some(last_backup_timestamp) => {
            now_timestamp.saturating_sub(last_backup_timestamp) >= AUTO_BACKUP_INTERVAL_SECONDS
        }
    }
}

fn restore_backup_payload(db: &Database, payload: &BackupMessagePack) -> Result<(), AppError> {
    {
        let mut conn = db.lock_conn();
        let tx = conn.transaction()?;

        tx.execute_batch(
            "
            DELETE FROM changes;
            DELETE FROM backupQueue;
            DELETE FROM categoriesSongs;
            DELETE FROM scores;
            DELETE FROM songs;
            DELETE FROM categories;
        ",
        )?;

        for category in &payload.categories {
            tx.execute(
                "INSERT INTO categories (id, name) VALUES (?1, ?2)",
                params![category.id, category.name],
            )?;
        }

        for song in &payload.songs {
            let storage_path = crate::services::path_normalizer::to_storage_path(&song.path);
            tx.execute(
                "INSERT INTO songs (id, name, composer, arranger, path, is_favorite)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    song.id,
                    song.name,
                    song.composer,
                    song.arranger,
                    storage_path,
                    song.is_favorite,
                ],
            )?;
        }

        for score in &payload.scores {
            let file_extension = Path::new(&score.file_name)
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.to_lowercase())
                .unwrap_or_else(|| "score".to_string());
            let storage_file_path =
                crate::services::path_normalizer::to_storage_path(&score.file_path);

            tx.execute(
                "INSERT INTO scores (id, song_id, name, file_path, file_name, file_extension, file_size, file_modified_at, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    score.id,
                    score.song_id,
                    score.name,
                    storage_file_path,
                    score.file_name,
                    file_extension,
                    score.file_size,
                    score.file_modified_at,
                    score.status,
                ],
            )?;
        }

        for relation in &payload.categories_songs {
            tx.execute(
                "INSERT INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                params![relation.id, relation.category_id, relation.song_id],
            )?;
        }

        for backup_song in &payload.backup_songs {
            tx.execute(
                "INSERT INTO backupQueue (songId, status)
                 VALUES (?1, ?2)",
                params![backup_song.song_id, backup_song.status],
            )?;
        }

        for change in &payload.changed_field {
            tx.execute(
                "INSERT INTO changes (id, type, entity, entityId, field, value, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    change.id,
                    change.change_type,
                    change.entity,
                    change.entity_id,
                    change.field,
                    change.value,
                    change.timestamp,
                ],
            )?;
        }

        tx.commit()?;
    }

    db.ensure_default_category()?;
    Ok(())
}

fn resolve_output_path(
    store: &SystemStore,
    output_path: Option<String>,
) -> Result<PathBuf, AppError> {
    let path = match output_path {
        Some(raw) if !raw.trim().is_empty() => PathBuf::from(raw),
        _ => store.app_data_dir().join("backup.msgpack"),
    };

    if path.file_name().is_none() {
        return Err(AppError::Generic(
            "Invalid output path for backup.msgpack".to_string(),
        ));
    }

    Ok(path)
}

fn empty_directory_contents(dir: &Path) -> Result<(), AppError> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|e| {
        AppError::Generic(format!(
            "Error reading directory to empty {}: {}",
            dir.display(),
            e
        ))
    })? {
        let entry = entry.map_err(|e| {
            AppError::Generic(format!("Error reading entry in {}: {}", dir.display(), e))
        })?;
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| {
                AppError::Generic(format!(
                    "Error removing directory {}: {}",
                    path.display(),
                    e
                ))
            })?;
        } else {
            fs::remove_file(&path).map_err(|e| {
                AppError::Generic(format!("Error removing file {}: {}", path.display(), e))
            })?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::domain::models::{Category, Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::should_generate_automatic_backup_from_timestamps;
    use super::AUTO_BACKUP_INTERVAL_SECONDS;
    use super::{
        backup_filename, cleanup_old_backups, export_backup_msgpack, find_latest_valid_backup,
        generate_automatic_backup_msgpack, import_backup_msgpack, list_backup_files,
        parse_backup_timestamp,
    };

    #[test]
    fn backup_filename_roundtrips() {
        let ts = 1710684000_i64;
        let name = backup_filename(ts);
        assert_eq!(parse_backup_timestamp(&name), Some(ts));
    }

    #[test]
    fn parse_backup_timestamp_rejects_invalid() {
        assert_eq!(parse_backup_timestamp("backup.msgpack"), None);
        assert_eq!(parse_backup_timestamp("backup - abc.msgpack.zst"), None);
        assert_eq!(parse_backup_timestamp("snapshot.msgpack.zst"), None);
    }

    #[test]
    fn list_and_cleanup_backups() {
        let dir = tempdir().expect("temp dir");
        let backup_dir = dir.path();

        for i in 0..15 {
            let name = backup_filename(1000 + i as i64);
            let path = backup_dir.join(&name);
            std::fs::write(&path, b"x".repeat(2048)).expect("write backup");
        }

        let files = list_backup_files(backup_dir).expect("list");
        assert_eq!(files.len(), 15);
        assert_eq!(files[0].0, 1014); // newest first

        cleanup_old_backups(backup_dir).expect("cleanup");

        let remaining = list_backup_files(backup_dir).expect("list after");
        assert_eq!(remaining.len(), 10);

        let expected_timestamps: Vec<i64> = (1005..=1014).rev().collect();
        let actual: Vec<i64> = remaining.iter().map(|(ts, _)| *ts).collect();
        assert_eq!(actual, expected_timestamps);
    }

    #[test]
    fn find_latest_valid_backup_filters_by_size() {
        let dir = tempdir().expect("temp dir");

        let small_path = dir.path().join(backup_filename(1000));
        std::fs::write(&small_path, b"s").expect("write small");

        let large_path = dir.path().join(backup_filename(2000));
        std::fs::write(&large_path, b"x".repeat(2048)).expect("write large");

        let found = find_latest_valid_backup(dir.path()).expect("find");
        assert_eq!(found.unwrap(), large_path);
    }

    #[test]
    fn find_latest_valid_backup_returns_none_when_all_too_small() {
        let dir = tempdir().expect("temp dir");

        let small_path = dir.path().join(backup_filename(1000));
        std::fs::write(&small_path, b"s").expect("write small");

        let found = find_latest_valid_backup(dir.path()).expect("find");
        assert!(found.is_none());
    }

    #[test]
    fn exports_and_imports_backup_msgpack() {
        let source_dir = tempdir().expect("source temp dir");
        let source_db = Database::new(&source_dir.path().join("source.db")).expect("source db");
        let source_store = SystemStore::new(source_dir.path().to_path_buf());

        let source_settings = crate::domain::models::AppSettings {
            computer_id: "server-a".to_string(),
            computer_name: Some("Server A".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            first_run_completed: true,
            ..Default::default()
        };
        source_store
            .save_app_settings(&source_settings)
            .expect("save source settings");

        let category = Category {
            id: "cat-1".to_string(),
            name: "Classica".to_string(),
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-a".to_string(),
        };
        source_db
            .insert_category(&category)
            .expect("insert category");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: Some("Composer".to_string()),
            arranger: Some("Arranger".to_string()),
            path: "/music/song-1".to_string(),
            is_favorite: true,
            status: ScoreStatus::Main,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-a".to_string(),
        };
        source_db
            .insert_song(&song, std::slice::from_ref(&category.id))
            .expect("insert song");

        let now = chrono::Local::now().naive_local();
        let score = Score {
            id: "score-1".to_string(),
            song_id: song.id.clone(),
            name: Some("Flauta".to_string()),
            file_path: "/tmp".to_string(),
            file_name: "flauta.musx".to_string(),
            file_size: 1234,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Main,
            updated_by: "server-a".to_string(),
        };
        source_db.insert_score(&score).expect("insert score");
        source_db
            .upsert_backup_song_status(&song.id, &crate::domain::models::BackupStatus::Ok)
            .expect("insert backupQueue");

        let backup_path = source_dir.path().join("exports").join("backup.msgpack");
        let export_summary = export_backup_msgpack(
            &source_db,
            &source_store,
            Some(backup_path.to_string_lossy().to_string()),
        )
        .expect("export backup");

        assert!(export_summary.file_size > 0);

        let target_dir = tempdir().expect("target temp dir");
        let target_db = Database::new(&target_dir.path().join("target.db")).expect("target db");
        let target_store = SystemStore::new(target_dir.path().to_path_buf());

        let target_settings = crate::domain::models::AppSettings {
            computer_id: "server-b".to_string(),
            computer_name: Some("Server B".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            first_run_completed: true,
            ..Default::default()
        };
        target_store
            .save_app_settings(&target_settings)
            .expect("save target settings");

        let import_summary = import_backup_msgpack(
            &target_db,
            &target_store,
            backup_path.to_string_lossy().to_string(),
        )
        .expect("import backup");

        assert_eq!(import_summary.songs_count, 1);
        assert_eq!(import_summary.scores_count, 1);
        assert_eq!(import_summary.categories_count, 2);

        let songs = target_db.get_all_songs().expect("query songs");
        let categories = target_db.get_all_categories().expect("query categories");
        let changed_fields = target_db
            .get_changed_fields_ordered()
            .expect("query changed fields");

        assert_eq!(songs.len(), 1);
        assert_eq!(categories.len(), 2);
        assert!(categories
            .iter()
            .any(|category| category.id == "cat-1" && category.name == "Classica"));
        assert!(categories
            .iter()
            .any(|category| category.id == "default-category" && category.name == "Uncategorized"));
        assert_eq!(songs[0].category_ids, vec!["cat-1".to_string()]);
        assert!(!changed_fields.is_empty());

        let imported_settings = target_store
            .get_app_settings()
            .expect("read target settings");
        assert_eq!(imported_settings.computer_id, "server-a");
        assert_eq!(
            imported_settings.computer_name.as_deref(),
            Some("Server A")
        );
        assert_eq!(
            imported_settings.last_backup_timestamp,
            Some(export_summary.generated_at)
        );
    }

    #[test]
    fn imports_compressed_backup_file() {
        let source_dir = tempdir().expect("source temp dir");
        let source_db = Database::new(&source_dir.path().join("source.db")).expect("source db");
        let source_store = SystemStore::new(source_dir.path().to_path_buf());

        let source_settings = crate::domain::models::AppSettings {
            computer_id: "server-c".to_string(),
            computer_name: Some("Server C".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            first_run_completed: true,
            ..Default::default()
        };
        source_store
            .save_app_settings(&source_settings)
            .expect("save source settings");

        let category = Category {
            id: "cat-2".to_string(),
            name: "Popular".to_string(),
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-c".to_string(),
        };
        source_db
            .insert_category(&category)
            .expect("insert category");

        let song = Song {
            id: "song-2".to_string(),
            name: "Test Music 2".to_string(),
            composer: None,
            arranger: None,
            path: "/music/song-2".to_string(),
            is_favorite: false,
            status: ScoreStatus::Main,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-c".to_string(),
        };
        source_db
            .insert_song(&song, std::slice::from_ref(&category.id))
            .expect("insert song");

        let msgpack_bytes = {
            let settings = source_store.get_app_settings().expect("settings");
            let payload = super::collect_backup_payload(&source_db, settings).expect("payload");
            super::serialize_msgpack_named(&payload, "backup").expect("serialize")
        };
        let compressed =
            super::compress_zstd_with_threads(&msgpack_bytes, super::ZSTD_LEVEL_BALANCED, "backup")
                .expect("compress");

        let compressed_path = source_dir.path().join("backup - 1710684000.msgpack.zst");
        std::fs::write(&compressed_path, &compressed).expect("write compressed");

        let target_dir = tempdir().expect("target temp dir");
        let target_db = Database::new(&target_dir.path().join("target.db")).expect("target db");
        let target_store = SystemStore::new(target_dir.path().to_path_buf());

        let target_settings = crate::domain::models::AppSettings {
            computer_id: "server-d".to_string(),
            computer_name: Some("Server D".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            first_run_completed: true,
            ..Default::default()
        };
        target_store
            .save_app_settings(&target_settings)
            .expect("save target settings");

        let summary = super::restore_backup_from_path(
            &target_db,
            &target_store,
            &compressed_path,
            &target_store.get_app_settings().expect("settings"),
        )
        .expect("import compressed");

        assert_eq!(summary.songs_count, 1);
    }

    #[test]
    fn automatic_backup_threshold_respects_timestamps() {
        let now = 1_000_000_i64;

        assert!(should_generate_automatic_backup_from_timestamps(None, now));
        assert!(!should_generate_automatic_backup_from_timestamps(
            Some(now - (AUTO_BACKUP_INTERVAL_SECONDS - 10)),
            now
        ));
        assert!(should_generate_automatic_backup_from_timestamps(
            Some(now - (AUTO_BACKUP_INTERVAL_SECONDS + 10)),
            now
        ));
    }

    #[test]
    fn automatic_backup_skipped_when_library_empty() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("empty.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-empty".to_string(),
            computer_type: crate::domain::models::ComputerType::Server,
            first_run_completed: true,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let result = generate_automatic_backup_msgpack(&db, &store).expect("generate");
        assert!(
            result.is_none(),
            "backup deve ser None quando biblioteca vazia"
        );
    }
}
