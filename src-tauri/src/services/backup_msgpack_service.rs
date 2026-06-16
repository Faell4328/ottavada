use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::commands::rclone_commands::sync_cloud_directory_with_rclone_impl;
use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, OperationGuard};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::ensure_backup_cloud_dir;
use crate::services::msgpack_zstd::{serialize_msgpack_named, write_atomic};
use crate::services::path_normalizer::to_storage_path;

const BACKUP_FILE_NAME: &str = "backup.msgpack";
const BACKUP_SCHEMA_VERSION: u32 = 1;
const AUTO_BACKUP_INTERVAL_SECONDS: i64 = 60 * 60;

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
    #[serde(rename = "changedField")]
    changed_field: Vec<BackupChangedField>,
    #[serde(rename = "backupSongs")]
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
    last_score_file_modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupScore {
    id: String,
    song_id: String,
    name: Option<String>,
    host_id: String,
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
                "Erro ao criar diretorio para backup.msgpack: {}",
                e
            ))
        })?;
    }

    write_atomic(&output_path, &bytes, "backup.msgpack")?;

    validate_backup_file_integrity(&output_path, &payload).map_err(|e| {
        let _ = fs::remove_file(&output_path);
        e
    })?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| {
            AppError::Generic(format!("Erro ao obter metadados de backup.msgpack: {}", e))
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

    let file = File::open(&backup_path)
        .map_err(|e| AppError::Generic(format!("Erro ao abrir backup.msgpack: {}", e)))?;
    let reader = BufReader::new(file);

    let payload: BackupMessagePack = rmp_serde::from_read(reader)
        .map_err(|e| AppError::Generic(format!("Erro ao desserializar backup.msgpack: {}", e)))?;

    if payload.schema_version != BACKUP_SCHEMA_VERSION {
        return Err(AppError::Generic(format!(
            "Versao de schema do backup nao suportada: {}",
            payload.schema_version
        )));
    }

    let mut payload = payload;
    if let Some(current_rclone_config) = settings.rclone_config.clone() {
        payload.settings.rclone_config = Some(current_rclone_config);
    }

    restore_backup_payload(db, &payload)?;

    let library_summary = db.get_library_summary_counts()?;
    payload.settings.library_summary = Some(library_summary);

    if let Err(e) = store.save_app_settings(&payload.settings) {
        return Err(AppError::Generic(format!(
            "Banco restaurado, mas falhou ao restaurar configuracoes do app-store: {}",
            e
        )));
    }

    Ok(BackupImportSummary {
        input_path: backup_path,
        generated_at: payload.generated_at,
        songs_count: payload.songs.len(),
        scores_count: payload.scores.len(),
        categories_count: payload.categories.len(),
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
        .ok_or_else(|| AppError::Generic("Falha ao gerar backup da nuvem".to_string()))
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

    let backup_path = ensure_backup_cloud_dir(store.app_data_dir())?.join(BACKUP_FILE_NAME);

    let summary =
        export_backup_msgpack(db, store, Some(backup_path.to_string_lossy().to_string()))?;

    sync_cloud_directory_with_rclone_impl(store, "upload", Some("backup"))?;

    let mut updated_settings = store.get_app_settings()?;
    updated_settings.last_backup_timestamp = Some(summary.generated_at);
    store.save_app_settings(&updated_settings)?;

    Ok(Some(summary))
}

pub fn import_backup_msgpack_from_cloud(
    db: &Database,
    store: &SystemStore,
) -> Result<BackupImportSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    sync_cloud_directory_with_rclone_impl(store, "download", Some("backup"))?;

    let backup_path = ensure_backup_cloud_dir(store.app_data_dir())?.join(BACKUP_FILE_NAME);

    if !backup_path.exists() {
        return Err(AppError::Generic(
            "Arquivo backup.msgpack nao encontrado na nuvem".to_string(),
        ));
    }

    import_backup_msgpack(db, store, backup_path.to_string_lossy().to_string())
}

fn collect_backup_payload(
    db: &Database,
    settings: AppSettings,
) -> Result<BackupMessagePack, AppError> {
    let conn = db.conn.lock().unwrap();
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
            "SELECT id, name, composer, arranger, path, is_favorite, last_score_file_modified_at
             FROM songs
             ORDER BY last_score_file_modified_at DESC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupSong {
                id: row.get(0)?,
                name: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                path: to_storage_path(&row.get::<_, String>(4)?),
                is_favorite: row.get::<_, bool>(5)?,
                last_score_file_modified_at: row.get(6)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let scores = {
        let mut stmt = conn.prepare(
            "SELECT id, song_id, name, host_id, file_path, file_name, file_size, file_modified_at, status
             FROM scores
             ORDER BY song_id ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupScore {
                id: row.get(0)?,
                song_id: row.get(1)?,
                name: row.get(2)?,
                host_id: row.get(3)?,
                file_path: to_storage_path(&row.get::<_, String>(4)?),
                file_name: row.get(5)?,
                file_size: row.get(6)?,
                file_modified_at: row.get(7)?,
                status: row.get(8)?,
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
             FROM changedField
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
             FROM songsBackup
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

fn validate_backup_file_integrity(
    output_path: &Path,
    expected_payload: &BackupMessagePack,
) -> Result<(), AppError> {
    let bytes = fs::read(output_path).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao validar backup.msgpack em {}: {}",
            output_path.display(),
            e
        ))
    })?;

    let verified_payload: BackupMessagePack = rmp_serde::from_slice(&bytes).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao desserializar backup.msgpack validado em {}: {}",
            output_path.display(),
            e
        ))
    })?;

    let is_valid = verified_payload.schema_version == expected_payload.schema_version
        && verified_payload.generated_at == expected_payload.generated_at
        && verified_payload.settings.computer_id == expected_payload.settings.computer_id
        && verified_payload.settings.computer_name == expected_payload.settings.computer_name
        && verified_payload.settings.computer_type == expected_payload.settings.computer_type
        && verified_payload.settings.google_drive_mode
            == expected_payload.settings.google_drive_mode
        && verified_payload.settings.first_run_completed
            == expected_payload.settings.first_run_completed
        && verified_payload.settings.database_local == expected_payload.settings.database_local
        && verified_payload
            .settings
            .rclone_config
            .as_ref()
            .map(|config| config.provider.clone())
            == expected_payload
                .settings
                .rclone_config
                .as_ref()
                .map(|config| config.provider.clone())
        && verified_payload.settings.last_backup_timestamp
            == expected_payload.settings.last_backup_timestamp
        && verified_payload.categories.len() == expected_payload.categories.len()
        && verified_payload.songs.len() == expected_payload.songs.len()
        && verified_payload.scores.len() == expected_payload.scores.len()
        && verified_payload.categories_songs.len() == expected_payload.categories_songs.len()
        && verified_payload.changed_field.len() == expected_payload.changed_field.len()
        && verified_payload.backup_songs.len() == expected_payload.backup_songs.len();

    if !is_valid {
        return Err(AppError::Generic(
            "Falha na validacao de integridade de backup.msgpack".to_string(),
        ));
    }

    Ok(())
}

fn restore_backup_payload(db: &Database, payload: &BackupMessagePack) -> Result<(), AppError> {
    {
        let mut conn = db.conn.lock().unwrap();
        let tx = conn.transaction()?;

        tx.execute_batch(
            "
            DELETE FROM changedField;
            DELETE FROM songsBackup;
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
            let storage_path = to_storage_path(&song.path);
            tx.execute(
                "INSERT INTO songs (id, name, composer, arranger, path, is_favorite, last_score_file_modified_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    song.id,
                    song.name,
                    song.composer,
                    song.arranger,
                    storage_path,
                    song.is_favorite,
                    song.last_score_file_modified_at,
                ],
            )?;
        }

        for score in &payload.scores {
            let file_extension = Path::new(&score.file_name)
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.to_lowercase())
                .unwrap_or_else(|| "score".to_string());
            let storage_file_path = to_storage_path(&score.file_path);

            tx.execute(
                "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    score.id,
                    score.song_id,
                    score.name,
                    score.host_id,
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
                "INSERT INTO songsBackup (songId, status)
                 VALUES (?1, ?2)",
                params![backup_song.song_id, backup_song.status],
            )?;
        }

        for change in &payload.changed_field {
            tx.execute(
                "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
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
        _ => store.app_data_dir().join(BACKUP_FILE_NAME),
    };

    if path.file_name().is_none() {
        return Err(AppError::Generic(
            "Caminho de saida invalido para backup.msgpack".to_string(),
        ));
    }

    Ok(path)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::domain::models::{Category, Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::should_generate_automatic_backup_from_timestamps;
    use super::AUTO_BACKUP_INTERVAL_SECONDS;
    use super::{export_backup_msgpack, import_backup_msgpack};

    #[test]
    fn exports_and_imports_backup_msgpack() {
        let source_dir = tempdir().expect("source temp dir");
        let source_db = Database::new(&source_dir.path().join("source.db")).expect("source db");
        let source_store = SystemStore::new(source_dir.path().to_path_buf());

        let source_settings = crate::domain::models::AppSettings {
            computer_id: "server-a".to_string(),
            computer_name: Some("Servidor A".to_string()),
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
            name: "Musica Teste".to_string(),
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
            host_id: "server-a".to_string(),
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
            .expect("insert backupSongs");

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
            computer_name: Some("Servidor B".to_string()),
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
            .any(|category| category.id == "default-category" && category.name == "Sem categoria"));
        assert_eq!(songs[0].category_ids, vec!["cat-1".to_string()]);
        assert!(!changed_fields.is_empty());

        let imported_settings = target_store
            .get_app_settings()
            .expect("read target settings");
        assert_eq!(imported_settings.computer_id, "server-a");
        assert_eq!(
            imported_settings.computer_name.as_deref(),
            Some("Servidor A")
        );
        assert_eq!(
            imported_settings.last_backup_timestamp,
            Some(export_summary.generated_at)
        );
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
}
