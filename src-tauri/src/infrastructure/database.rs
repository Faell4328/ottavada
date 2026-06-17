use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;
use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::domain::errors::AppError;
use crate::services::path_normalizer::from_storage_path;

pub(crate) const DEFAULT_CATEGORY_ID: &str = "default-category";
pub(crate) const DEFAULT_CATEGORY_NAME: &str = "Sem categoria";

pub(crate) const SONGS_SELECT_FIELDS: &str =
    "id, name, composer, arranger, path, datetime('now') AS updated_at, is_favorite, status";

pub(crate) fn to_not_found(not_found: AppError) -> impl FnOnce(rusqlite::Error) -> AppError {
    move |e| match e {
        rusqlite::Error::QueryReturnedNoRows => not_found,
        other => AppError::Database(other),
    }
}

#[derive(Debug, Clone)]
pub struct ChangedFieldRecord {
    pub id: String,
    pub change_type: String,
    pub entity: String,
    pub entity_id: String,
    pub field: Option<String>,
    pub value: Option<String>,
    pub timestamp: i64,
}

#[derive(Clone)]
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub(crate) fn normalize_category_ids(category_ids: &[String]) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut normalized = Vec::new();

        for category_id in category_ids {
            let category_id = category_id.trim();

            if category_id.is_empty() {
                continue;
            }

            let category_id = category_id.to_string();
            if seen.insert(category_id.clone()) {
                normalized.push(category_id);
            }
        }

        if normalized.len() > 1 {
            normalized.retain(|category_id| category_id != DEFAULT_CATEGORY_ID);
        }

        if normalized.is_empty() {
            vec![DEFAULT_CATEGORY_ID.to_string()]
        } else {
            normalized
        }
    }

    pub(crate) fn build_score_full_path(file_path: &str, file_name: &str) -> String {
        let expanded_file_path = from_storage_path(file_path);
        let trimmed_dir = expanded_file_path.trim();
        let trimmed_name = file_name.trim();

        if trimmed_name.is_empty() {
            return trimmed_dir.to_string();
        }

        let dir_as_path = Path::new(trimmed_dir);
        let is_legacy_full_path = dir_as_path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case(trimmed_name))
            .unwrap_or(false);

        if is_legacy_full_path {
            return trimmed_dir.to_string();
        }

        std::path::PathBuf::from(trimmed_dir)
            .join(trimmed_name)
            .to_string_lossy()
            .to_string()
    }

    pub(crate) fn extract_file_extension(file_name: &str) -> Option<String> {
        std::path::Path::new(file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .map(str::trim)
            .filter(|ext| !ext.is_empty())
            .map(|ext| ext.to_lowercase())
    }

    pub fn new(db_path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.initialize_schema()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory().map_err(|e| AppError::Database(e))?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.initialize_schema()?;
        Ok(db)
    }

    /// Lock the DB connection, recovering from poison if a previous thread panicked.
    pub fn lock_conn(&self) -> MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|poison| poison.into_inner())
    }

    fn initialize_schema(&self) -> Result<(), AppError> {
        let conn = self.lock_conn();
        Self::initialize_schema_with_conn(&conn)
    }

    fn initialize_schema_with_conn(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
        ",
        )?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS composer (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS arranger (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                composer TEXT,
                arranger TEXT,
                path TEXT NOT NULL,
                is_favorite BOOLEAN NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'main',
                last_score_file_modified_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS composerSongs (
                id TEXT PRIMARY KEY,
                composerId TEXT NOT NULL REFERENCES composer(id) ON DELETE CASCADE,
                songId TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE(composerId, songId)
            );

            CREATE TABLE IF NOT EXISTS arrangerSongs (
                id TEXT PRIMARY KEY,
                arrangerId TEXT NOT NULL REFERENCES arranger(id) ON DELETE CASCADE,
                songId TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE(arrangerId, songId)
            );

            CREATE TABLE IF NOT EXISTS categoriesSongs (
                id TEXT PRIMARY KEY,
                categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                songId TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE(categoryId, songId)
            );
        ",
        )?;

        let song_status_exists = conn
            .query_row(
                "SELECT 1 FROM pragma_table_info('songs') WHERE name = 'status' LIMIT 1",
                [],
                |_| Ok(()),
            )
            .optional()?
            .is_some();

        if !song_status_exists {
            conn.execute(
                "ALTER TABLE songs ADD COLUMN status TEXT NOT NULL DEFAULT 'main'",
                [],
            )?;
        }

        conn.execute_batch(
            " 
            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                name TEXT,
                host_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_extension TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
                status TEXT NOT NULL DEFAULT 'main',
                UNIQUE(file_path, file_name)
            );
        ",
        )?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS changedField (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                entity TEXT NOT NULL,
                entityId TEXT NOT NULL,
                field TEXT,
                value TEXT,
                timestamp INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_changedField_entity ON changedField(entity, entityId);
            CREATE INDEX IF NOT EXISTS idx_changedField_timestamp ON changedField(timestamp);
        ",
        )?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS songsBackup (
                songId TEXT PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'processing'
            );
        ",
        )?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS computerInformation (
                computerId TEXT PRIMARY KEY,
                organizationName TEXT NOT NULL DEFAULT '',
                computerName TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL CHECK(type IN ('server', 'client')),
                appVersion TEXT NOT NULL DEFAULT '',
                os TEXT NOT NULL DEFAULT '',
                arch TEXT NOT NULL DEFAULT '',
                date TEXT NOT NULL,
                report INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                computerId TEXT NOT NULL REFERENCES computerInformation(computerId) ON DELETE CASCADE,
                date TEXT NOT NULL,
                musicCount INTEGER NOT NULL DEFAULT 0,
                musicMain INTEGER NOT NULL DEFAULT 0,
                musicDraft INTEGER NOT NULL DEFAULT 0,
                musicNotFound INTEGER NOT NULL DEFAULT 0,
                scoresCount INTEGER NOT NULL DEFAULT 0,
                scoresMain INTEGER NOT NULL DEFAULT 0,
                scoresDraft INTEGER NOT NULL DEFAULT 0,
                scoresNotFound INTEGER NOT NULL DEFAULT 0,
                report INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS errors (
                id TEXT PRIMARY KEY,
                message TEXT NOT NULL DEFAULT '',
                timestamp INTEGER NOT NULL
            );
        ",
        )?;

        conn.execute_batch("
            CREATE INDEX IF NOT EXISTS idx_scores_song_id ON scores(song_id);
            CREATE INDEX IF NOT EXISTS idx_scores_file_path ON scores(file_path);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_songId ON categoriesSongs(songId);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_categoryId ON categoriesSongs(categoryId);
            CREATE INDEX IF NOT EXISTS idx_songs_is_favorite ON songs(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_songsBackup_songId ON songsBackup(songId);
            CREATE INDEX IF NOT EXISTS idx_songsBackup_status ON songsBackup(status);
            CREATE INDEX IF NOT EXISTS idx_computerInformation_report ON computerInformation(report);
            CREATE INDEX IF NOT EXISTS idx_usage_computerId ON usage(computerId);
            CREATE INDEX IF NOT EXISTS idx_usage_report ON usage(report);
            CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp);
        ")?;

        Self::ensure_default_category_with_conn(conn)?;

        Ok(())
    }

    pub(crate) fn ensure_default_category_with_conn(conn: &Connection) -> Result<(), AppError> {
        conn.execute(
            "INSERT OR IGNORE INTO categories (id, name) VALUES (?1, ?2)",
            params![DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME],
        )?;

        let mut stmt = conn.prepare(
            "SELECT id FROM songs WHERE id NOT IN (
                SELECT DISTINCT songId FROM categoriesSongs
            )",
        )?;

        let song_ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|result| result.ok())
            .collect();

        for song_id in song_ids {
            conn.execute(
                "INSERT OR IGNORE INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                params![uuid::Uuid::new_v4().to_string(), DEFAULT_CATEGORY_ID, song_id],
            )?;
        }

        Ok(())
    }

    pub fn ensure_default_category(&self) -> Result<(), AppError> {
        let conn = self.lock_conn();
        Self::ensure_default_category_with_conn(&conn)
    }

    pub(crate) fn insert_changed_field(
        conn: &Connection,
        change_type: &str,
        entity: &str,
        entity_id: &str,
        field: Option<&str>,
        value: Option<String>,
    ) -> Result<(), AppError> {
        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                uuid::Uuid::new_v4().to_string(),
                change_type,
                entity,
                entity_id,
                field,
                value,
                chrono::Local::now().timestamp(),
            ],
        )?;

        Ok(())
    }

    pub(crate) fn sync_song_status_from_scores(conn: &Connection, song_id: &str) -> Result<(), AppError> {
        let (next_status, current_status): (String, String) = conn
            .query_row(
                "SELECT
                    CASE
                        WHEN SUM(CASE WHEN status = 'main' THEN 1 ELSE 0 END) > 0 THEN 'main'
                        WHEN SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) > 0 THEN 'draft'
                        ELSE 'not_found'
                    END AS next_status,
                    (SELECT status FROM songs WHERE id = ?1) AS current_status
                 FROM scores
                 WHERE song_id = ?1
                   AND status IN ('main', 'draft')",
                params![song_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| to_not_found(AppError::SongNotFound(song_id.to_string()))(e))?;

        if current_status == next_status {
            return Ok(());
        }

        conn.execute(
            "UPDATE songs SET status = ?1 WHERE id = ?2",
            params![next_status.clone(), song_id],
        )?;

        Self::insert_changed_field(
            conn,
            "update",
            "songs",
            song_id,
            Some("status"),
            Some(current_status.clone()),
        )?;

        Ok(())
    }
}

pub(crate) fn parse_datetime(s: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[cfg(test)]
#[path = "database_tests_songs.rs"]
mod database_tests_songs;

#[cfg(test)]
#[path = "database_tests_categories.rs"]
mod database_tests_categories;

#[cfg(test)]
#[path = "database_tests_telemetry.rs"]
mod database_tests_telemetry;

#[cfg(test)]
#[path = "database_tests_scores.rs"]
mod database_tests_scores;
