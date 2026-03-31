use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, OperationGuard};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;

const BACKUP_FILE_NAME: &str = "backup.msgpack";
const BACKUP_SCHEMA_VERSION: u32 = 1;

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
    origin: String,
    #[serde(rename = "type")]
    change_type: String,
    entity: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    field: Option<String>,
    #[serde(rename = "oldValue")]
    old_value: Option<String>,
    #[serde(rename = "newValue")]
    new_value: Option<String>,
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
    let bytes = rmp_serde::to_vec_named(&payload)
        .map_err(|e| AppError::Generic(format!("Erro ao serializar backup.msgpack: {}", e)))?;

    let output_path = resolve_output_path(store, output_path)?;
    let temp_path = temp_path_for(&output_path);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao criar diretorio para backup.msgpack: {}",
                e
            ))
        })?;
    }

    fs::write(&temp_path, &bytes).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever arquivo temporario de backup.msgpack: {}",
            e
        ))
    })?;

    fs::rename(&temp_path, &output_path)
        .map_err(|e| AppError::Generic(format!("Erro ao finalizar backup.msgpack: {}", e)))?;

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

    let bytes = fs::read(&backup_path)
        .map_err(|e| AppError::Generic(format!("Erro ao ler backup.msgpack: {}", e)))?;

    let payload: BackupMessagePack = rmp_serde::from_slice(&bytes)
        .map_err(|e| AppError::Generic(format!("Erro ao desserializar backup.msgpack: {}", e)))?;

    if payload.schema_version != BACKUP_SCHEMA_VERSION {
        return Err(AppError::Generic(format!(
            "Versao de schema do backup nao suportada: {}",
            payload.schema_version
        )));
    }

    restore_backup_payload(db, &payload)?;

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

fn collect_backup_payload(
    db: &Database,
    settings: AppSettings,
) -> Result<BackupMessagePack, AppError> {
    let conn = db.conn.lock().unwrap();

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
            "SELECT id, name, composer, arranger, is_favorite, last_score_file_modified_at
             FROM songs
             ORDER BY last_score_file_modified_at DESC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupSong {
                id: row.get(0)?,
                name: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                is_favorite: row.get::<_, i32>(4)? != 0,
                last_score_file_modified_at: row.get(5)?,
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
                file_path: row.get(4)?,
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
            "SELECT id, category_id, song_id
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
            "SELECT id, origin, type, entity, entityId, field, oldValue, newValue, timestamp
             FROM changedField
             ORDER BY timestamp ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupChangedField {
                id: row.get(0)?,
                origin: row.get(1)?,
                change_type: row.get(2)?,
                entity: row.get(3)?,
                entity_id: row.get(4)?,
                field: row.get(5)?,
                old_value: row.get(6)?,
                new_value: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let backup_songs = {
        let mut stmt = conn.prepare(
            "SELECT id, song_id, status, last_backup_at, error_message
             FROM backupSongs
             ORDER BY song_id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupSongStatusRecord {
                id: row.get(0)?,
                song_id: row.get(1)?,
                status: row.get(2)?,
                last_backup_at: row.get(3)?,
                error_message: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    Ok(BackupMessagePack {
        schema_version: BACKUP_SCHEMA_VERSION,
        generated_at: chrono::Local::now().timestamp(),
        settings,
        categories,
        songs,
        scores,
        categories_songs,
        changed_field,
        backup_songs,
    })
}

fn restore_backup_payload(db: &Database, payload: &BackupMessagePack) -> Result<(), AppError> {
    let mut conn = db.conn.lock().unwrap();
    let tx = conn.transaction()?;

    tx.execute_batch(
        "
        DELETE FROM changedField;
        DELETE FROM backupSongs;
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
        tx.execute(
            "INSERT INTO songs (id, name, composer, arranger, is_favorite, last_score_file_modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                song.id,
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                song.last_score_file_modified_at,
            ],
        )?;
    }

    for score in &payload.scores {
        tx.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                score.id,
                score.song_id,
                score.name,
                score.host_id,
                score.file_path,
                score.file_name,
                score.file_size,
                score.file_modified_at,
                score.status,
            ],
        )?;
    }

    for relation in &payload.categories_songs {
        tx.execute(
            "INSERT INTO categoriesSongs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
            params![relation.id, relation.category_id, relation.song_id],
        )?;
    }

    for backup_song in &payload.backup_songs {
        tx.execute(
            "INSERT INTO backupSongs (id, song_id, status, last_backup_at, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                backup_song.id,
                backup_song.song_id,
                backup_song.status,
                backup_song.last_backup_at,
                backup_song.error_message,
            ],
        )?;
    }

    for change in &payload.changed_field {
        tx.execute(
            "INSERT INTO changedField (id, origin, type, entity, entityId, field, oldValue, newValue, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                change.id,
                change.origin,
                change.change_type,
                change.entity,
                change.entity_id,
                change.field,
                change.old_value,
                change.new_value,
                change.timestamp,
            ],
        )?;
    }

    tx.commit()?;
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

fn temp_path_for(path: &Path) -> PathBuf {
    let mut temp = path.to_path_buf();
    let extension = path
        .extension()
        .map(|ext| format!("{}.tmp", ext.to_string_lossy()))
        .unwrap_or_else(|| "tmp".to_string());
    temp.set_extension(extension);
    temp
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::domain::models::{Category, Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

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
        assert_eq!(import_summary.categories_count, 1);

        let songs = target_db.get_all_songs().expect("query songs");
        let categories = target_db.get_all_categories().expect("query categories");
        let changed_fields = target_db
            .get_changed_fields_ordered()
            .expect("query changed fields");

        assert_eq!(songs.len(), 1);
        assert_eq!(categories.len(), 1);
        assert!(!changed_fields.is_empty());

        let imported_settings = target_store
            .get_app_settings()
            .expect("read target settings");
        assert_eq!(imported_settings.computer_id, "server-a");
        assert_eq!(
            imported_settings.computer_name.as_deref(),
            Some("Servidor A")
        );
    }
}
