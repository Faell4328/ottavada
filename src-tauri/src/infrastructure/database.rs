use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::domain::errors::AppError;
use crate::domain::models::datetime_utils;
use crate::domain::models::*;

const CHANGE_ORIGIN_SERVER: &str = "server";
const DEFAULT_CATEGORY_ID: &str = "default-category";
const DEFAULT_CATEGORY_NAME: &str = "Sem categoria";

#[derive(Debug, Clone)]
pub struct ChangedFieldRecord {
    pub id: String,
    pub change_type: String,
    pub entity: String,
    pub entity_id: String,
    pub field: Option<String>,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub timestamp: i64,
}

#[derive(Clone)]
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
    fn build_score_full_path(file_path: &str, file_name: &str) -> String {
        let trimmed_dir = file_path.trim();
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

    fn extract_file_extension(file_name: &str) -> Option<String> {
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
        db.run_migrations()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory().map_err(|e| AppError::Database(e))?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        Self::run_migrations_with_conn(&conn)
    }

    fn run_migrations_with_conn(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
        ",
        )?;

        // Tabelas base (sem dependência)
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                composer TEXT,
                arranger TEXT,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                last_score_file_modified_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS categoriesSongs (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE(category_id, song_id)
            );
        ",
        )?;

        // Schema canônico pré-v1 para scores: file_path + file_name (sem tabela directories).
        conn.execute_batch(
            " 
            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                name TEXT,
                host_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                file_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
                status TEXT NOT NULL DEFAULT 'main',
                UNIQUE(file_path, file_name)
            );
        ",
        )?;

        // Estrutura de mudança canônica conforme documentação v0.4+
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS changedField (
                id TEXT PRIMARY KEY,
                origin TEXT NOT NULL,
                type TEXT NOT NULL,
                entity TEXT NOT NULL,
                entityId TEXT NOT NULL,
                field TEXT,
                oldValue TEXT,
                newValue TEXT,
                timestamp INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_changedField_entity ON changedField(entity, entityId);
            CREATE INDEX IF NOT EXISTS idx_changedField_timestamp ON changedField(timestamp);
        ",
        )?;

        // Tabela para rastreamento de status de backup por música
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS backupSongs (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL UNIQUE REFERENCES songs(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'processing',
                last_backup_at INTEGER,
                error_message TEXT
            );
        ",
        )?;

        // Índices
        conn.execute_batch("
            CREATE INDEX IF NOT EXISTS idx_scores_song_id ON scores(song_id);
            CREATE INDEX IF NOT EXISTS idx_scores_file_path ON scores(file_path);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_song_id ON categoriesSongs(song_id);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_category_id ON categoriesSongs(category_id);
            CREATE INDEX IF NOT EXISTS idx_songs_is_favorite ON songs(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_backupSongs_song_id ON backupSongs(song_id);
            CREATE INDEX IF NOT EXISTS idx_backupSongs_status ON backupSongs(status);
        ")?;

        Self::ensure_default_category_with_conn(conn)?;

        Ok(())
    }

    fn ensure_default_category_with_conn(conn: &Connection) -> Result<(), AppError> {
        conn.execute(
            "INSERT OR IGNORE INTO categories (id, name) VALUES (?1, ?2)",
            params![DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME],
        )?;

        let mut stmt = conn.prepare(
            "SELECT id FROM songs WHERE id NOT IN (
                SELECT DISTINCT song_id FROM categoriesSongs
            )",
        )?;

        let song_ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|result| result.ok())
            .collect();

        for song_id in song_ids {
            conn.execute(
                "INSERT OR IGNORE INTO categoriesSongs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                params![uuid::Uuid::new_v4().to_string(), DEFAULT_CATEGORY_ID, song_id],
            )?;
        }

        Ok(())
    }

    pub fn ensure_default_category(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        Self::ensure_default_category_with_conn(&conn)
    }

    fn insert_changed_field(
        conn: &Connection,
        change_type: &str,
        entity: &str,
        entity_id: &str,
        field: Option<&str>,
        old_value: Option<String>,
        new_value: Option<String>,
    ) -> Result<(), AppError> {
        conn.execute(
            "INSERT INTO changedField (id, origin, type, entity, entityId, field, oldValue, newValue, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                uuid::Uuid::new_v4().to_string(),
                CHANGE_ORIGIN_SERVER,
                change_type,
                entity,
                entity_id,
                field,
                old_value,
                new_value,
                chrono::Local::now().timestamp(),
            ],
        )?;

        Ok(())
    }

    // ── Songs ──

    pub fn insert_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let now_ts = chrono::Local::now().timestamp();
        let category_ids = if category_ids.is_empty() {
            vec![DEFAULT_CATEGORY_ID.to_string()]
        } else {
            category_ids.to_vec()
        };

        conn.execute(
            "INSERT INTO songs (id, name, composer, arranger, is_favorite, last_score_file_modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                song.id,
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                now_ts,
            ],
        )?;

        for category_id in category_ids {
            let rel_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO categoriesSongs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                params![rel_id, category_id, song.id],
            )?;

            Self::insert_changed_field(
                &conn,
                "insert",
                "categoriesSongs",
                &rel_id,
                Some("categoryId"),
                None,
                Some(category_id.clone()),
            )?;

            Self::insert_changed_field(
                &conn,
                "insert",
                "categoriesSongs",
                &rel_id,
                Some("songId"),
                None,
                Some(song.id.clone()),
            )?;
        }

        Self::insert_changed_field(
            &conn,
            "insert",
            "songs",
            &song.id,
            Some("name"),
            None,
            Some(song.name.clone()),
        )?;
        Self::insert_changed_field(
            &conn,
            "insert",
            "songs",
            &song.id,
            Some("composer"),
            None,
            song.composer.clone(),
        )?;
        Self::insert_changed_field(
            &conn,
            "insert",
            "songs",
            &song.id,
            Some("arranger"),
            None,
            song.arranger.clone(),
        )?;
        Ok(())
    }

    pub fn update_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let category_ids = if category_ids.is_empty() {
            vec![DEFAULT_CATEGORY_ID.to_string()]
        } else {
            category_ids.to_vec()
        };

        let original_song = conn
            .query_row(
                "SELECT name, composer, arranger FROM songs WHERE id = ?1",
                params![song.id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::SongNotFound(song.id.clone()),
                other => AppError::Database(other),
            })?;

        let old_category_ids = Self::get_category_ids(&conn, &song.id)?;

        conn.execute(
            "UPDATE songs SET name = ?1, composer = ?2, arranger = ?3, is_favorite = ?4
             WHERE id = ?5",
            params![
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                song.id,
            ],
        )?;

        conn.execute(
            "DELETE FROM categoriesSongs WHERE song_id = ?1",
            params![song.id],
        )?;

        for category_id in &category_ids {
            let rel_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO categoriesSongs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                params![rel_id, category_id, song.id],
            )?;

            if !old_category_ids.iter().any(|id| id == category_id) {
                Self::insert_changed_field(
                    &conn,
                    "insert",
                    "categoriesSongs",
                    &rel_id,
                    Some("categoryId"),
                    None,
                    Some(category_id.clone()),
                )?;

                Self::insert_changed_field(
                    &conn,
                    "insert",
                    "categoriesSongs",
                    &rel_id,
                    Some("songId"),
                    None,
                    Some(song.id.clone()),
                )?;
            }
        }

        if original_song.0 != song.name {
            Self::insert_changed_field(
                &conn,
                "update",
                "songs",
                &song.id,
                Some("name"),
                Some(original_song.0),
                Some(song.name.clone()),
            )?;
        }

        if original_song.1 != song.composer {
            Self::insert_changed_field(
                &conn,
                "update",
                "songs",
                &song.id,
                Some("composer"),
                original_song.1,
                song.composer.clone(),
            )?;
        }

        if original_song.2 != song.arranger {
            Self::insert_changed_field(
                &conn,
                "update",
                "songs",
                &song.id,
                Some("arranger"),
                original_song.2,
                song.arranger.clone(),
            )?;
        }

        for old_category_id in old_category_ids {
            if !category_ids.iter().any(|id| id == &old_category_id) {
                Self::insert_changed_field(
                    &conn,
                    "delete",
                    "categoriesSongs",
                    &uuid::Uuid::new_v4().to_string(),
                    Some("categoryId"),
                    Some(old_category_id),
                    None,
                )?;
            }
        }

        Ok(())
    }

    pub fn get_song_by_id(&self, song_id: &str) -> Result<Song, AppError> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, name, composer, arranger, is_favorite FROM songs WHERE id = ?1",
            params![song_id],
            |row| {
                Ok(Song {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    composer: row.get(2)?,
                    arranger: row.get(3)?,
                    is_favorite: row.get::<_, i32>(4)? != 0,
                    status: ScoreStatus::Main,
                    updated_at: chrono::Local::now().naive_local(),
                    updated_by: String::new(),
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::SongNotFound(song_id.to_string()),
            other => AppError::Database(other),
        })
    }

    /// Busca uma música completa (com scores e categorias) pelo ID
    pub fn get_song_list_item_by_id(&self, song_id: &str) -> Result<SongListItem, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut items = Self::query_song_list_items(
            &conn,
            "SELECT id, name, composer, arranger, datetime('now') AS updated_at, is_favorite FROM songs WHERE id = ?1",
            &[&song_id as &dyn rusqlite::ToSql],
            true,
        )?;
        items
            .pop()
            .ok_or_else(|| AppError::SongNotFound(song_id.to_string()))
    }

    /// Executa uma query que retorna SongListItem com scores e categorias carregados
    fn query_song_list_items(
        conn: &Connection,
        sql: &str,
        params: &[&dyn rusqlite::ToSql],
        include_scores: bool,
    ) -> Result<Vec<SongListItem>, AppError> {
        let mut stmt = conn.prepare(sql)?;

        let mut songs: Vec<SongListItem> = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                Ok(SongListItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    composer: row.get(2)?,
                    arranger: row.get(3)?,
                    updated_at: parse_datetime(&row.get::<_, String>(4)?),
                    is_favorite: row.get::<_, i32>(5)? != 0,
                    category_ids: Vec::new(),
                    scores: Vec::new(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        if songs.is_empty() || !include_scores {
            return Ok(songs);
        }

        let song_ids: Vec<String> = songs.iter().map(|song| song.id.clone()).collect();
        let mut scores_by_song = Self::get_scores_for_songs(conn, &song_ids)?;
        let mut category_ids_by_song = Self::get_category_ids_for_songs(conn, &song_ids)?;

        for song in &mut songs {
            if let Some(scores) = scores_by_song.remove(&song.id) {
                song.scores = scores;
            }

            if let Some(category_ids) = category_ids_by_song.remove(&song.id) {
                song.category_ids = category_ids;
            }
        }

        Ok(songs)
    }

    fn get_scores_for_songs(
        conn: &Connection,
        song_ids: &[String],
    ) -> Result<HashMap<String, Vec<ScoreListItem>>, AppError> {
        let placeholders = std::iter::repeat("?")
            .take(song_ids.len())
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            "SELECT s.song_id, s.id, s.name, s.file_path, s.file_name, s.file_modified_at, s.status
             FROM scores s
             WHERE s.song_id IN ({})
             ORDER BY s.song_id ASC, COALESCE(s.name, s.file_name) COLLATE NOCASE ASC, s.id ASC",
            placeholders
        );

        let mut stmt = conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = song_ids
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();

        let mut grouped: HashMap<String, Vec<ScoreListItem>> = HashMap::new();
        let rows = stmt.query_map(rusqlite::params_from_iter(params), |row| {
            let dir_path: String = row.get(3)?;
            let file_name: String = row.get(4)?;
            let file_path = Self::build_score_full_path(&dir_path, &file_name);
            let file_extension = Self::extract_file_extension(&file_path).unwrap_or_default();

            Ok((
                row.get::<_, String>(0)?,
                ScoreListItem {
                    id: row.get(1)?,
                    name: row.get(2)?,
                    file_path,
                    file_extension,
                    updated_at: parse_datetime(&row.get::<_, String>(5)?),
                    status: ScoreStatus::from_str(&row.get::<_, String>(6)?),
                },
            ))
        })?;

        for row in rows {
            let (song_id, score) = row?;
            grouped.entry(song_id).or_default().push(score);
        }

        Ok(grouped)
    }

    fn get_category_ids_for_songs(
        conn: &Connection,
        song_ids: &[String],
    ) -> Result<HashMap<String, Vec<String>>, AppError> {
        let placeholders = std::iter::repeat("?")
            .take(song_ids.len())
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            "SELECT song_id, category_id
             FROM categoriesSongs
             WHERE song_id IN ({})
             ORDER BY song_id ASC, category_id ASC",
            placeholders
        );

        let mut stmt = conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = song_ids
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(params), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut grouped: HashMap<String, Vec<String>> = HashMap::new();
        for row in rows {
            let (song_id, category_id) = row?;
            grouped.entry(song_id).or_default().push(category_id);
        }

        Ok(grouped)
    }

    pub fn get_library_summary_counts(&self) -> Result<LibrarySummary, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut summary = LibrarySummary::default();

        let mut stmt = conn.prepare(
            "SELECT status, COUNT(*) AS scores_count, COUNT(DISTINCT song_id) AS songs_count
             FROM scores
             WHERE status IN ('main', 'pending', 'not_found')
             GROUP BY status",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, usize>(1)?,
                row.get::<_, usize>(2)?,
            ))
        })?;

        for row in rows {
            let (status, scores_count, songs_count) = row?;
            let bucket = LibraryStatusSummary {
                songs_count,
                scores_count,
            };

            match status.as_str() {
                "main" => summary.main = bucket,
                "pending" => summary.pending = bucket,
                "not_found" => summary.not_found = bucket,
                _ => {}
            }
        }

        Ok(summary)
    }

    pub fn get_all_songs(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT id, name, composer, arranger, datetime('now') AS updated_at, is_favorite
             FROM songs
             ORDER BY name COLLATE NOCASE ASC, id ASC",
            &[],
            true,
        )
    }

    pub fn get_all_song_summaries(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT id, name, composer, arranger, datetime('now') AS updated_at, is_favorite
             FROM songs
             ORDER BY name COLLATE NOCASE ASC, id ASC",
            &[],
            false,
        )
    }

    pub fn get_favorited_songs(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT id, name, composer, arranger, datetime('now') AS updated_at, is_favorite
             FROM songs
             WHERE is_favorite = 1
             ORDER BY name COLLATE NOCASE ASC, id ASC",
            &[],
            true,
        )
    }

    pub fn get_favorited_song_summaries(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT id, name, composer, arranger, datetime('now') AS updated_at, is_favorite
             FROM songs
             WHERE is_favorite = 1
             ORDER BY name COLLATE NOCASE ASC, id ASC",
            &[],
            false,
        )
    }

    pub fn toggle_favorite(&self, song_id: &str) -> Result<bool, AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE songs SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![song_id],
        )?;

        let is_favorite: i32 = conn.query_row(
            "SELECT is_favorite FROM songs WHERE id = ?1",
            params![song_id],
            |row| row.get(0),
        )?;

        Ok(is_favorite != 0)
    }

    pub fn search_songs(&self, query: &str) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        let like_query = format!("%{}%", query.trim());
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             WHERE s.name LIKE ?1
                OR COALESCE(s.composer, '') LIKE ?1
                OR COALESCE(s.arranger, '') LIKE ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[&like_query as &dyn rusqlite::ToSql],
            true,
        )
    }

    #[allow(dead_code)]
    pub fn search_song_summaries(&self, query: &str) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        let like_query = format!("%{}%", query.trim());
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             WHERE s.name LIKE ?1
                OR COALESCE(s.composer, '') LIKE ?1
                OR COALESCE(s.arranger, '') LIKE ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[&like_query as &dyn rusqlite::ToSql],
            false,
        )
    }

    pub fn get_songs_by_category(&self, category_id: &str) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             INNER JOIN categoriesSongs cs ON cs.song_id = s.id
             WHERE cs.category_id = ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[&category_id as &dyn rusqlite::ToSql],
            true,
        )
    }

    pub fn get_song_summaries_by_category(
        &self,
        category_id: &str,
    ) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             INNER JOIN categoriesSongs cs ON cs.song_id = s.id
             WHERE cs.category_id = ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[&category_id as &dyn rusqlite::ToSql],
            false,
        )
    }

    pub fn get_songs_with_drafts(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'draft'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            true,
        )
    }

    pub fn get_song_summaries_with_drafts(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'draft'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            false,
        )
    }

    #[allow(dead_code)]
    pub fn get_songs_with_not_found(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'not_found'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            true,
        )
    }

    pub fn get_song_summaries_with_not_found(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_song_list_items(
            &conn,
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, datetime('now') AS updated_at, s.is_favorite
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'not_found'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            false,
        )
    }

    pub fn get_scores_for_song(&self, song_id: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut grouped = Self::get_scores_for_songs(&conn, &[song_id.to_string()])?;
        Ok(grouped.remove(song_id).unwrap_or_default())
    }

    // ── Scores ──

    pub fn insert_score(&self, score: &Score) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let file_modified_at_ts = score.file_modified_at.and_utc().timestamp();

        conn.execute(
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
                datetime_utils::format_datetime(score.file_modified_at),
                score.status.as_str(),
            ],
        )?;

        conn.execute(
            "UPDATE songs
             SET last_score_file_modified_at = CASE
                   WHEN last_score_file_modified_at > ?1 THEN last_score_file_modified_at
                   ELSE ?1
                 END
             WHERE id = ?2",
            params![file_modified_at_ts, score.song_id],
        )?;

        Self::insert_changed_field(
            &conn,
            "insert",
            "scores",
            &score.id,
            Some("songId"),
            None,
            Some(score.song_id.clone()),
        )?;
        Self::insert_changed_field(
            &conn,
            "insert",
            "scores",
            &score.id,
            Some("name"),
            None,
            score.name.clone(),
        )?;
        Self::insert_changed_field(
            &conn,
            "insert",
            "scores",
            &score.id,
            Some("status"),
            None,
            Some(score.status.as_str().to_string()),
        )?;

        if let Some(extension) = Self::extract_file_extension(&score.file_name) {
            Self::insert_changed_field(
                &conn,
                "insert",
                "scores",
                &score.id,
                Some("extension"),
                None,
                Some(extension),
            )?;
        }

        // Inserir uma nova partitura invalida o backup atual da música,
        // forçando a regeneração do arquivo {songId}.tar.zst.
        let backup_status_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO backupSongs (id, song_id, status, last_backup_at, error_message)
             VALUES (?1, ?2, 'processing', NULL, NULL)
             ON CONFLICT(song_id) DO UPDATE SET
                status = 'processing',
                last_backup_at = NULL,
                error_message = NULL",
            params![backup_status_id, score.song_id],
        )?;

        Ok(())
    }

    pub fn update_score(
        &self,
        score_id: &str,
        name: Option<String>,
        file_path: &str,
        file_name: &str,
        file_size: u64,
        file_modified_at: chrono::NaiveDateTime,
        _now: chrono::NaiveDateTime,
        _updated_by: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let file_modified_at_ts = file_modified_at.and_utc().timestamp();

        let old_values = conn
            .query_row(
                "SELECT name, file_path, file_name FROM scores WHERE id = ?1",
                params![score_id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::ScoreNotFound(score_id.to_string())
                }
                other => AppError::Database(other),
            })?;

        conn.execute(
            "UPDATE scores SET name = ?1, file_path = ?2, file_name = ?3, file_size = ?4, file_modified_at = ?5 WHERE id = ?6",
            params![
                name,
                file_path,
                file_name,
                file_size,
                datetime_utils::format_datetime(file_modified_at),
                score_id,
            ],
        )?;

        // Propagar alteração para a música
        let song_id: String = conn.query_row(
            "SELECT song_id FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        )?;

        conn.execute(
            "UPDATE songs
             SET last_score_file_modified_at = CASE
                   WHEN last_score_file_modified_at > ?1 THEN last_score_file_modified_at
                   ELSE ?1
                 END
             WHERE id = ?2",
            params![file_modified_at_ts, song_id],
        )?;

        if old_values.0 != name {
            Self::insert_changed_field(
                &conn,
                "update",
                "scores",
                score_id,
                Some("name"),
                old_values.0,
                name,
            )?;
        }

        if old_values.1 != file_path || old_values.2 != file_name {
            Self::insert_changed_field(
                &conn,
                "update",
                "scores",
                score_id,
                Some("file"),
                None,
                None,
            )?;

            let old_extension = Self::extract_file_extension(&old_values.2);
            let new_extension = Self::extract_file_extension(file_name);
            if old_extension != new_extension {
                Self::insert_changed_field(
                    &conn,
                    "update",
                    "scores",
                    score_id,
                    Some("extension"),
                    old_extension,
                    new_extension,
                )?;
            }
        }

        Ok(())
    }

    pub fn delete_score(&self, score_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        let song_id: String = conn
            .query_row(
            "SELECT song_id FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get::<_, String>(0),
        )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::ScoreNotFound(score_id.to_string())
                }
                other => AppError::Database(other),
            })?;

        let affected = conn.execute("DELETE FROM scores WHERE id = ?1", params![score_id])?;
        if affected == 0 {
            return Err(AppError::ScoreNotFound(score_id.to_string()));
        }

        Self::insert_changed_field(&conn, "delete", "scores", score_id, None, None, None)?;

        // Deletar uma partitura precisa invalidar o último backup da música,
        // forçando a regeneração do arquivo {songId}.tar.zst no próximo ciclo.
        let backup_status_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO backupSongs (id, song_id, status, last_backup_at, error_message)
             VALUES (?1, ?2, 'processing', NULL, NULL)
             ON CONFLICT(song_id) DO UPDATE SET
                status = 'processing',
                last_backup_at = NULL,
                error_message = NULL",
            params![backup_status_id, song_id],
        )?;

        Ok(())
    }

    /// Reconstrói o caminho completo do arquivo a partir de file_path + file_name
    pub fn get_score_file_path(&self, score_id: &str) -> Result<String, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT s.file_path, s.file_name FROM scores s WHERE s.id = ?1",
            params![score_id],
            |row| {
                let dir_path: String = row.get(0)?;
                let file_name: String = row.get(1)?;
                Ok(Self::build_score_full_path(&dir_path, &file_name))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::ScoreNotFound(score_id.to_string()),
            other => AppError::Database(other),
        })
    }

    /// Helper: busca metadados de scores com query e params
    /// Retorna: Vec<(score_id, file_path_completo, file_size, file_modified_at)>
    fn query_score_metadata(
        conn: &Connection,
        sql: &str,
        params: &[&dyn rusqlite::ToSql],
    ) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let mut stmt = conn.prepare(sql)?;
        let scores = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                let dir_path: String = row.get(1)?;
                let file_name: String = row.get(2)?;
                let file_path = Self::build_score_full_path(&dir_path, &file_name);
                Ok((
                    row.get::<_, String>(0)?,
                    file_path,
                    row.get::<_, u64>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(scores)
    }

    /// Obtém todos os scores com metadados para detecção de alterações
    #[allow(dead_code)]
    pub fn get_all_scores_with_metadata(
        &self,
    ) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_score_metadata(
            &conn,
            "SELECT s.id, s.file_path, s.file_name, s.file_size, s.file_modified_at
             FROM scores s",
            &[],
        )
    }

    /// Obtém todos os scores de um host específico com seus metadados
    pub fn get_all_scores_with_metadata_by_host(
        &self,
        host_id: &str,
    ) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::query_score_metadata(
            &conn,
            "SELECT s.id, s.file_path, s.file_name, s.file_size, s.file_modified_at
             FROM scores s
             WHERE s.host_id = ?1",
            &[&host_id as &dyn rusqlite::ToSql],
        )
    }

    /// Obtém todos os scores com status "not_found" de um host específico
    pub fn get_not_found_scores_by_host(
        &self,
        host_id: &str,
    ) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        let status = ScoreStatus::NotFound.as_str();
        Self::query_score_metadata(
            &conn,
            "SELECT s.id, s.file_path, s.file_name, s.file_size, s.file_modified_at
             FROM scores s
             WHERE s.status = ?1 AND s.host_id = ?2",
            &[
                &status as &dyn rusqlite::ToSql,
                &host_id as &dyn rusqlite::ToSql,
            ],
        )
    }

    /// Obtém todos os scores com status "not_found"
    #[allow(dead_code)]
    pub fn get_not_found_scores(&self) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        let status = ScoreStatus::NotFound.as_str();
        Self::query_score_metadata(
            &conn,
            "SELECT s.id, s.file_path, s.file_name, s.file_size, s.file_modified_at
             FROM scores s
             WHERE s.status = ?1",
            &[&status as &dyn rusqlite::ToSql],
        )
    }

    /// Atualiza o status de um score com metadados opcionais do arquivo
    pub fn update_score_status(
        &self,
        score_id: &str,
        status: ScoreStatus,
        _updated_by: &str,
        file_metadata: Option<(u64, chrono::NaiveDateTime)>,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        let old_status = conn
            .query_row(
                "SELECT status FROM scores WHERE id = ?1",
                params![score_id],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::ScoreNotFound(score_id.to_string())
                }
                other => AppError::Database(other),
            })?;

        let file_modified_at_ts = file_metadata
            .as_ref()
            .map(|(_, modified)| modified.and_utc().timestamp());

        if let Some((file_size, file_modified_at)) = file_metadata {
            conn.execute(
                "UPDATE scores SET status = ?1, file_size = ?2, file_modified_at = ?3 WHERE id = ?4",
                params![
                    status.as_str(),
                    file_size,
                    datetime_utils::format_datetime(file_modified_at),
                    score_id,
                ],
            )?;
        } else {
            conn.execute(
                "UPDATE scores SET status = ?1 WHERE id = ?2",
                params![status.as_str(), score_id],
            )?;
        }

        // Propagar alteração para a música
        let song_id: String = conn.query_row(
            "SELECT song_id FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        )?;

        if let Some(modified_ts) = file_modified_at_ts {
            conn.execute(
                "UPDATE songs
                 SET last_score_file_modified_at = CASE
                       WHEN last_score_file_modified_at > ?1 THEN last_score_file_modified_at
                       ELSE ?1
                     END
                 WHERE id = ?2",
                params![modified_ts, song_id],
            )?;
        }

        if old_status != status.as_str() {
            Self::insert_changed_field(
                &conn,
                "update",
                "scores",
                score_id,
                Some("status"),
                Some(old_status),
                Some(status.as_str().to_string()),
            )?;
        }

        Ok(())
    }

    /// Obtém o song_id de um score
    pub fn get_song_id_for_score(&self, score_id: &str) -> Result<String, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT song_id FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::ScoreNotFound(score_id.to_string()),
            other => AppError::Database(other),
        })
    }

    fn get_category_ids(conn: &Connection, song_id: &str) -> Result<Vec<String>, AppError> {
        let mut stmt =
            conn.prepare("SELECT category_id FROM categoriesSongs WHERE song_id = ?1")?;

        let category_ids: Vec<String> = stmt
            .query_map(params![song_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(category_ids)
    }

    // ── Categories ──

    pub fn insert_category(&self, category: &Category) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (id, name) VALUES (?1, ?2)",
            params![category.id, category.name,],
        )?;

        Self::insert_changed_field(
            &conn,
            "insert",
            "categories",
            &category.id,
            Some("name"),
            None,
            Some(category.name.clone()),
        )?;

        Ok(())
    }

    pub fn get_all_categories(&self) -> Result<Vec<Category>, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::ensure_default_category_with_conn(&conn)?;
        let mut stmt = conn.prepare("SELECT id, name FROM categories ORDER BY name")?;

        let categories = stmt
            .query_map([], |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    updated_at: chrono::Local::now().naive_local(),
                    updated_by: String::new(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(categories)
    }

    pub fn delete_category(&self, category_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        if category_id == DEFAULT_CATEGORY_ID {
            return Err(AppError::Generic(
                "A categoria 'Sem categoria' nao pode ser removida".to_string(),
            ));
        }

        let relation_ids: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM categoriesSongs WHERE category_id = ?1")?;
            let rows = stmt.query_map(params![category_id], |row| row.get::<_, String>(0))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        conn.execute("DELETE FROM categories WHERE id = ?1", params![category_id])?;

        for relation_id in relation_ids {
            Self::insert_changed_field(
                &conn,
                "delete",
                "categoriesSongs",
                &relation_id,
                None,
                None,
                None,
            )?;
        }

        Self::insert_changed_field(&conn, "delete", "categories", category_id, None, None, None)?;

        Ok(())
    }

    pub fn delete_song(&self, song_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id FROM songs WHERE id = ?1",
            params![song_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::SongNotFound(song_id.to_string()),
            other => AppError::Database(other),
        })?;

        let score_ids: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM scores WHERE song_id = ?1")?;
            let rows = stmt.query_map(params![song_id], |row| row.get::<_, String>(0))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        let relation_ids: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM categoriesSongs WHERE song_id = ?1")?;
            let rows = stmt.query_map(params![song_id], |row| row.get::<_, String>(0))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        // Deletar as partituras da música
        conn.execute("DELETE FROM scores WHERE song_id = ?1", params![song_id])?;

        // Deletar as associações de categorias
        conn.execute(
            "DELETE FROM categoriesSongs WHERE song_id = ?1",
            params![song_id],
        )?;

        // Deletar a música
        let affected = conn.execute("DELETE FROM songs WHERE id = ?1", params![song_id])?;
        if affected == 0 {
            return Err(AppError::Generic("Música não encontrada".into()));
        }

        for score_id in score_ids {
            Self::insert_changed_field(&conn, "delete", "scores", &score_id, None, None, None)?;
        }

        for relation_id in relation_ids {
            Self::insert_changed_field(
                &conn,
                "delete",
                "categoriesSongs",
                &relation_id,
                None,
                None,
                None,
            )?;
        }

        Self::insert_changed_field(&conn, "delete", "songs", song_id, None, None, None)?;

        Ok(())
    }
}

// ── REMOVIDO: Métodos de exportação para MessagePack (database completo) ──
//
// Conforme atualização da documentação v0.3, a estratégia mudou de:
// - ❌ Exportar todo o banco de dados como backup local
// Para:
// - ✅ Exportar apenas mudanças como {computerId}.msgpack
//
// Métodos removidos:
// - export_to_message_pack() - exportava banco completo
// - get_export_scores_for_song() - helper para export
// - get_export_change_lists() - helper para export
// - get_export_changes() - helper para export
// - serialize_to_msgpack() - serializava ExportDatabase
// - export_and_serialize_msgpack() - combinava os anteriores
//
// TODO: Implementar export_changes_to_msgpack() que lê apenas a tabela "changed"

#[allow(dead_code)]
impl Database {
    pub fn mark_all_song_archives_for_regeneration(&self) -> Result<usize, AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO backupSongs (id, song_id, status, last_backup_at, error_message)
             SELECT lower(hex(randomblob(16))), s.id, 'processing', NULL, NULL
             FROM songs s",
            [],
        )
        .map_err(AppError::Database)?;

        conn.execute(
            "UPDATE backupSongs
             SET
                status = 'processing',
                last_backup_at = NULL,
                error_message = NULL
             WHERE song_id IN (SELECT id FROM songs)",
            [],
        )
        .map_err(AppError::Database)
    }

    pub fn upsert_backup_song_status(
        &self,
        song_id: &str,
        status: &BackupStatus,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let status_str = status.as_str();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Local::now().timestamp();

        conn.execute(
            "INSERT INTO backupSongs (id, song_id, status, last_backup_at, error_message)
             VALUES (?1, ?2, ?3, ?4, NULL)
             ON CONFLICT(song_id) DO UPDATE SET
             status = ?3,
             last_backup_at = ?4",
            params![id, song_id, status_str, now],
        )?;
        Ok(())
    }

    /// Atualiza o status de backup de uma música com mensagem de erro opcional
    pub fn update_backup_song_status(
        &self,
        song_id: &str,
        status: &BackupStatus,
        error_message: Option<String>,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let status_str = status.as_str();
        let now = chrono::Local::now().timestamp();

        conn.execute(
            "UPDATE backupSongs
             SET status = ?1, last_backup_at = ?2, error_message = ?3
             WHERE song_id = ?4",
            params![status_str, now, error_message, song_id],
        )?;
        Ok(())
    }

    /// Obtém o status de backup de uma música
    pub fn get_backup_song_status(
        &self,
        song_id: &str,
    ) -> Result<Option<SongBackupStatus>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, song_id, status, last_backup_at, error_message
             FROM backupSongs WHERE song_id = ?1",
        )?;

        let result = stmt.query_row(params![song_id], |row| {
            Ok(SongBackupStatus {
                id: row.get(0)?,
                song_id: row.get(1)?,
                status: BackupStatus::from_str(&row.get::<_, String>(2)?),
                last_backup_at: row.get(3)?,
                error_message: row.get(4)?,
            })
        });

        match result {
            Ok(status) => Ok(Some(status)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// Obtém todos os status de backup de músicas
    pub fn get_all_backup_songs_status(&self) -> Result<Vec<SongBackupStatus>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, song_id, status, last_backup_at, error_message
             FROM backupSongs ORDER BY last_backup_at DESC",
        )?;

        let results = stmt.query_map([], |row| {
            Ok(SongBackupStatus {
                id: row.get(0)?,
                song_id: row.get(1)?,
                status: BackupStatus::from_str(&row.get::<_, String>(2)?),
                last_backup_at: row.get(3)?,
                error_message: row.get(4)?,
            })
        })?;

        let backup_songs: Result<Vec<_>, _> = results.collect();
        Ok(backup_songs?)
    }

    /// Obtém todos os status de backup com um status específico
    pub fn get_backup_songs_by_status(
        &self,
        status: &BackupStatus,
    ) -> Result<Vec<SongBackupStatus>, AppError> {
        let conn = self.conn.lock().unwrap();
        let status_str = status.as_str();
        let mut stmt = conn.prepare(
            "SELECT id, song_id, status, last_backup_at, error_message
             FROM backupSongs WHERE status = ?1 ORDER BY last_backup_at DESC",
        )?;

        let results = stmt.query_map(params![status_str], |row| {
            Ok(SongBackupStatus {
                id: row.get(0)?,
                song_id: row.get(1)?,
                status: BackupStatus::from_str(&row.get::<_, String>(2)?),
                last_backup_at: row.get(3)?,
                error_message: row.get(4)?,
            })
        })?;

        let backup_songs: Result<Vec<_>, _> = results.collect();
        Ok(backup_songs?)
    }

    /// Deleta um registro de status de backup
    pub fn delete_backup_song_status(&self, song_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM backupSongs WHERE song_id = ?1",
            params![song_id],
        )?;
        Ok(())
    }

    /// Limpa todos os registros de backupSongs com status de erro
    pub fn clear_backup_errors(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM backupSongs WHERE status = 'error'", [])?;
        Ok(())
    }

    /// Comprime dados com zstd (Zstandard)
    pub fn compress_zstd(data: &[u8]) -> Result<Vec<u8>, AppError> {
        zstd::encode_all(data, 3)
            .map_err(|e| AppError::Generic(format!("Erro ao comprimir com zstd: {}", e)))
    }

    // ===== Métodos para rastreamento de atualização do banco de dados =====

    /// Obtém o timestamp (em segundos) da última alteração em qualquer música
    /// Retorna None se não houver nenhuma música
    /// Baseado no campo canônico pré-v1: last_score_file_modified_at.
    pub fn get_latest_songs_update_timestamp(&self) -> Result<Option<i64>, AppError> {
        let conn = self.conn.lock().unwrap();

        match conn.query_row(
            "SELECT last_score_file_modified_at FROM songs ORDER BY last_score_file_modified_at DESC LIMIT 1",
            [],
            |row| row.get::<_, i64>(0)
        ) {
            Ok(timestamp) => Ok(Some(timestamp)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// Lista todas as alterações registradas em changedField em ordem cronológica.
    pub fn get_changed_fields_ordered(&self) -> Result<Vec<ChangedFieldRecord>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, type, entity, entityId, field, oldValue, newValue, timestamp
             FROM changedField
             ORDER BY timestamp ASC, id ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(ChangedFieldRecord {
                id: row.get(0)?,
                change_type: row.get(1)?,
                entity: row.get(2)?,
                entity_id: row.get(3)?,
                field: row.get(4)?,
                old_value: row.get(5)?,
                new_value: row.get(6)?,
                timestamp: row.get(7)?,
            })
        })?;

        let records: Result<Vec<_>, _> = rows.collect();
        Ok(records?)
    }

    /// Remove todos os registros de changedField e retorna quantos foram removidos.
    pub fn clear_changed_fields(&self) -> Result<usize, AppError> {
        let conn = self.conn.lock().unwrap();
        let deleted = conn.execute("DELETE FROM changedField", [])?;
        Ok(deleted)
    }

    /// Retorna true quando existe ao menos um evento pendente em changedField.
    pub fn has_pending_changes(&self) -> Result<bool, AppError> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(1) FROM changedField", [], |row| row.get(0))?;
        Ok(count > 0)
    }

    /// Retorna o timestamp mais recente da tabela changedField.
    pub fn get_latest_changed_field_timestamp(&self) -> Result<Option<i64>, AppError> {
        let conn = self.conn.lock().unwrap();
        let latest = conn.query_row("SELECT MAX(timestamp) FROM changedField", [], |row| {
            row.get::<_, Option<i64>>(0)
        })?;
        Ok(latest)
    }
}

fn parse_datetime(s: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[cfg(test)]
#[path = "database_tests.rs"]
mod database_tests;
