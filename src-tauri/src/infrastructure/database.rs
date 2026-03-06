use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;

use crate::domain::errors::AppError;
use crate::domain::models::*;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    /// Cria um banco de dados em memória (para testes).
    #[cfg(test)]
    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()
            .map_err(|e| AppError::Database(e))?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch("
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
        ")?;

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                composer TEXT,
                arranger TEXT,
                category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                favorited INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS score_files (
                id TEXT PRIMARY KEY,
                score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
                instrument TEXT,
                original_path TEXT NOT NULL,
                file_extension TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                hash TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS file_versions (
                id TEXT PRIMARY KEY,
                score_file_id TEXT NOT NULL REFERENCES score_files(id) ON DELETE CASCADE,
                version_number INTEGER NOT NULL,
                label TEXT,
                status TEXT NOT NULL DEFAULT 'current',
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                hash TEXT,
                is_compressed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- FTS5 for full-text search on scores
            CREATE VIRTUAL TABLE IF NOT EXISTS scores_fts USING fts5(
                title, composer, arranger, tags,
                content='scores',
                content_rowid='rowid'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS scores_ai AFTER INSERT ON scores BEGIN
                INSERT INTO scores_fts(rowid, title, composer, arranger, tags)
                VALUES (new.rowid, new.title, new.composer, new.arranger, new.tags);
            END;

            CREATE TRIGGER IF NOT EXISTS scores_ad AFTER DELETE ON scores BEGIN
                INSERT INTO scores_fts(scores_fts, rowid, title, composer, arranger, tags)
                VALUES ('delete', old.rowid, old.title, old.composer, old.arranger, old.tags);
            END;

            CREATE TRIGGER IF NOT EXISTS scores_au AFTER UPDATE ON scores BEGIN
                INSERT INTO scores_fts(scores_fts, rowid, title, composer, arranger, tags)
                VALUES ('delete', old.rowid, old.title, old.composer, old.arranger, old.tags);
                INSERT INTO scores_fts(rowid, title, composer, arranger, tags)
                VALUES (new.rowid, new.title, new.composer, new.arranger, new.tags);
            END;

            CREATE INDEX IF NOT EXISTS idx_score_files_score_id ON score_files(score_id);
            CREATE INDEX IF NOT EXISTS idx_file_versions_score_file_id ON file_versions(score_file_id);
            CREATE INDEX IF NOT EXISTS idx_scores_category_id ON scores(category_id);
            CREATE INDEX IF NOT EXISTS idx_scores_favorited ON scores(favorited);
        ")?;

        Ok(())
    }

    // ── Scores ──

    pub fn insert_score(&self, score: &Score) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let tags_json = serde_json::to_string(&score.tags).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO scores (id, title, composer, arranger, category_id, tags, favorited, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                score.id,
                score.title,
                score.composer,
                score.arranger,
                score.category_id,
                tags_json,
                score.favorited as i32,
                score.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                score.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            ],
        )?;
        Ok(())
    }

    pub fn get_all_scores(&self) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT s.id, s.title, s.composer, s.arranger, s.updated_at, s.favorited
             FROM scores s
             ORDER BY s.updated_at DESC"
        )?;

        let scores: Vec<ScoreListItem> = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            Ok(ScoreListItem {
                id,
                title: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                favorited: row.get::<_, i32>(5)? != 0,
                instruments: Vec::new(),
            })
        })?.filter_map(|r| r.ok()).collect();

        // Load instruments for each score
        let mut result = Vec::with_capacity(scores.len());
        for mut score in scores {
            score.instruments = self.get_score_files_for_list(&conn, &score.id)?;
            result.push(score);
        }

        Ok(result)
    }

    fn get_score_files_for_list(&self, conn: &Connection, score_id: &str) -> Result<Vec<ScoreFileItem>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT sf.id, sf.instrument, sf.file_extension, sf.updated_at,
                    (SELECT COUNT(*) FROM file_versions fv WHERE fv.score_file_id = sf.id) as version_count,
                    (SELECT COUNT(*) FROM file_versions fv WHERE fv.score_file_id = sf.id AND fv.status = 'draft') as draft_count
             FROM score_files sf
             WHERE sf.score_id = ?1
             ORDER BY sf.instrument"
        )?;

        let files = stmt.query_map(params![score_id], |row| {
            Ok(ScoreFileItem {
                id: row.get(0)?,
                instrument: row.get(1)?,
                file_extension: row.get(2)?,
                updated_at: parse_datetime(&row.get::<_, String>(3)?),
                version_count: row.get(4)?,
                has_draft: row.get::<_, i32>(5)? > 0,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(files)
    }

    pub fn get_favorited_scores(&self) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT s.id, s.title, s.composer, s.arranger, s.updated_at, s.favorited
             FROM scores s WHERE s.favorited = 1
             ORDER BY s.updated_at DESC"
        )?;

        let scores: Vec<ScoreListItem> = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            Ok(ScoreListItem {
                id,
                title: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                favorited: true,
                instruments: Vec::new(),
            })
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(scores.len());
        for mut score in scores {
            score.instruments = self.get_score_files_for_list(&conn, &score.id)?;
            result.push(score);
        }

        Ok(result)
    }

    pub fn toggle_favorite(&self, score_id: &str) -> Result<bool, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET favorited = CASE WHEN favorited = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![score_id],
        )?;

        let favorited: i32 = conn.query_row(
            "SELECT favorited FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        )?;

        Ok(favorited != 0)
    }

    pub fn search_scores(&self, query: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        let fts_query = format!("{}*", query);

        let mut stmt = conn.prepare(
            "SELECT s.id, s.title, s.composer, s.arranger, s.updated_at, s.favorited
             FROM scores s
             INNER JOIN scores_fts ON scores_fts.rowid = s.rowid
             WHERE scores_fts MATCH ?1
             ORDER BY rank"
        )?;

        let scores: Vec<ScoreListItem> = stmt.query_map(params![fts_query], |row| {
            let id: String = row.get(0)?;
            Ok(ScoreListItem {
                id,
                title: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                favorited: row.get::<_, i32>(5)? != 0,
                instruments: Vec::new(),
            })
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(scores.len());
        for mut score in scores {
            score.instruments = self.get_score_files_for_list(&conn, &score.id)?;
            result.push(score);
        }

        Ok(result)
    }

    // ── Score Files ──

    pub fn insert_score_file(&self, file: &ScoreFile) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO score_files (id, score_id, instrument, original_path, file_extension, file_size, hash, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                file.id,
                file.score_id,
                file.instrument,
                file.original_path,
                file.file_extension,
                file.file_size as i64,
                file.hash,
                file.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                file.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            ],
        )?;
        Ok(())
    }

    // ── Versions ──

    pub fn insert_version(&self, version: &FileVersion) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO file_versions (id, score_file_id, version_number, label, status, file_path, file_size, hash, is_compressed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                version.id,
                version.score_file_id,
                version.version_number,
                version.label,
                version.status.as_str(),
                version.file_path,
                version.file_size as i64,
                version.hash,
                version.is_compressed as i32,
                version.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            ],
        )?;
        Ok(())
    }

    pub fn get_versions_for_file(&self, score_file_id: &str) -> Result<Vec<FileVersion>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, score_file_id, version_number, label, status, file_path, file_size, hash, is_compressed, created_at
             FROM file_versions
             WHERE score_file_id = ?1
             ORDER BY version_number DESC"
        )?;

        let versions = stmt.query_map(params![score_file_id], |row| {
            Ok(FileVersion {
                id: row.get(0)?,
                score_file_id: row.get(1)?,
                version_number: row.get(2)?,
                label: row.get(3)?,
                status: VersionStatus::from_str(&row.get::<_, String>(4)?),
                file_path: row.get(5)?,
                file_size: row.get::<_, i64>(6)? as u64,
                hash: row.get(7)?,
                is_compressed: row.get::<_, i32>(8)? != 0,
                created_at: parse_datetime(&row.get::<_, String>(9)?),
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(versions)
    }

    pub fn promote_draft_to_version(&self, version_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        // Get the draft info
        let (score_file_id, _): (String, i32) = conn.query_row(
            "SELECT score_file_id, version_number FROM file_versions WHERE id = ?1 AND status = 'draft'",
            params![version_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|_| AppError::VersionNotFound(version_id.to_string()))?;

        // Mark current as previous
        conn.execute(
            "UPDATE file_versions SET status = 'previous' WHERE score_file_id = ?1 AND status = 'current'",
            params![score_file_id],
        )?;

        // Get the next version number
        let max_version: i32 = conn.query_row(
            "SELECT COALESCE(MAX(version_number), 0) FROM file_versions WHERE score_file_id = ?1 AND status != 'draft'",
            params![score_file_id],
            |row| row.get(0),
        )?;

        // Promote draft to current
        conn.execute(
            "UPDATE file_versions SET status = 'current', version_number = ?1 WHERE id = ?2",
            params![max_version + 1, version_id],
        )?;

        Ok(())
    }

    pub fn delete_version(&self, version_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute(
            "DELETE FROM file_versions WHERE id = ?1 AND status != 'current'",
            params![version_id],
        )?;

        if affected == 0 {
            return Err(AppError::Generic("Não é possível deletar a versão atual".into()));
        }
        Ok(())
    }

    // ── Categories ──

    pub fn insert_category(&self, category: &Category) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (id, name, created_at) VALUES (?1, ?2, ?3)",
            params![
                category.id,
                category.name,
                category.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            ],
        )?;
        Ok(())
    }

    pub fn get_all_categories(&self) -> Result<Vec<Category>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, created_at FROM categories ORDER BY name")?;

        let categories = stmt.query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: parse_datetime(&row.get::<_, String>(2)?),
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(categories)
    }

    pub fn delete_category(&self, category_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM categories WHERE id = ?1", params![category_id])?;
        Ok(())
    }

    pub fn get_scores_by_category(&self, category_id: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT s.id, s.title, s.composer, s.arranger, s.updated_at, s.favorited
             FROM scores s WHERE s.category_id = ?1
             ORDER BY s.updated_at DESC"
        )?;

        let scores: Vec<ScoreListItem> = stmt.query_map(params![category_id], |row| {
            let id: String = row.get(0)?;
            Ok(ScoreListItem {
                id,
                title: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                favorited: row.get::<_, i32>(5)? != 0,
                instruments: Vec::new(),
            })
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(scores.len());
        for mut score in scores {
            score.instruments = self.get_score_files_for_list(&conn, &score.id)?;
            result.push(score);
        }

        Ok(result)
    }

    // ── Settings ──

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_app_settings(&self) -> Result<AppSettings, AppError> {
        let settings = AppSettings {
            computer_name: self.get_setting("computer_name")?,
            logo_path: self.get_setting("logo_path")?,
            google_drive_mode: match self.get_setting("google_drive_mode")?.as_deref() {
                Some("api") => GoogleDriveMode::Api,
                _ => GoogleDriveMode::Local,
            },
            hash_enabled: self.get_setting("hash_enabled")?.as_deref() == Some("true"),
            first_run_completed: self.get_setting("first_run_completed")?.as_deref() == Some("true"),
            api_key: self.get_setting("api_key")?,
        };
        Ok(settings)
    }

    pub fn save_app_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        if let Some(ref name) = settings.computer_name {
            self.set_setting("computer_name", name)?;
        }
        if let Some(ref path) = settings.logo_path {
            self.set_setting("logo_path", path)?;
        }
        if let Some(ref key) = settings.api_key {
            self.set_setting("api_key", key)?;
        }
        self.set_setting("google_drive_mode", match settings.google_drive_mode {
            GoogleDriveMode::Local => "local",
            GoogleDriveMode::Api => "api",
        })?;
        self.set_setting("hash_enabled", if settings.hash_enabled { "true" } else { "false" })?;
        self.set_setting("first_run_completed", if settings.first_run_completed { "true" } else { "false" })?;
        Ok(())
    }

    // ── Scores with active drafts ──

    pub fn get_scores_with_drafts(&self) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT DISTINCT s.id, s.title, s.composer, s.arranger, s.updated_at, s.favorited
             FROM scores s
             INNER JOIN score_files sf ON sf.score_id = s.id
             INNER JOIN file_versions fv ON fv.score_file_id = sf.id
             WHERE fv.status = 'draft'
             ORDER BY s.updated_at DESC"
        )?;

        let scores: Vec<ScoreListItem> = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            Ok(ScoreListItem {
                id,
                title: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                favorited: row.get::<_, i32>(5)? != 0,
                instruments: Vec::new(),
            })
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(scores.len());
        for mut score in scores {
            score.instruments = self.get_score_files_for_list(&conn, &score.id)?;
            result.push(score);
        }

        Ok(result)
    }
}

fn parse_datetime(s: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[cfg(test)]
#[path = "database_tests.rs"]
mod database_tests;
