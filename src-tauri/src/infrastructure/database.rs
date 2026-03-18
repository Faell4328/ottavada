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
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                composer TEXT,
                arranger TEXT,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS categories_songs (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE(category_id, song_id)
            );

            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                name TEXT,
                host_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                status TEXT NOT NULL DEFAULT 'main'
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- FTS5 para busca textual em músicas
            CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
                name, composer, arranger,
                content='songs',
                content_rowid='rowid'
            );

            -- Triggers para manter FTS sincronizado
            CREATE TRIGGER IF NOT EXISTS songs_ai AFTER INSERT ON songs BEGIN
                INSERT INTO songs_fts(rowid, name, composer, arranger)
                VALUES (new.rowid, new.name, new.composer, new.arranger);
            END;

            CREATE TRIGGER IF NOT EXISTS songs_ad AFTER DELETE ON songs BEGIN
                INSERT INTO songs_fts(songs_fts, rowid, name, composer, arranger)
                VALUES ('delete', old.rowid, old.name, old.composer, old.arranger);
            END;

            CREATE TRIGGER IF NOT EXISTS songs_au AFTER UPDATE ON songs BEGIN
                INSERT INTO songs_fts(songs_fts, rowid, name, composer, arranger)
                VALUES ('delete', old.rowid, old.name, old.composer, old.arranger);
                INSERT INTO songs_fts(rowid, name, composer, arranger)
                VALUES (new.rowid, new.name, new.composer, new.arranger);
            END;

            CREATE INDEX IF NOT EXISTS idx_scores_song_id ON scores(song_id);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_song_id ON categories_songs(song_id);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_category_id ON categories_songs(category_id);
            CREATE INDEX IF NOT EXISTS idx_songs_is_favorite ON songs(is_favorite);
        ")?;

        Ok(())
    }

    // ── Songs ──

    pub fn insert_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO songs (id, name, composer, arranger, is_favorite, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                song.id,
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                song.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            ],
        )?;

        for category_id in category_ids {
            let rel_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO categories_songs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                params![rel_id, category_id, song.id],
            )?;
        }

        Ok(())
    }

    pub fn update_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE songs SET name = ?1, composer = ?2, arranger = ?3, is_favorite = ?4, updated_at = ?5
             WHERE id = ?6",
            params![
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                song.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                song.id,
            ],
        )?;

        conn.execute(
            "DELETE FROM categories_songs WHERE song_id = ?1",
            params![song.id],
        )?;

        for category_id in category_ids {
            let rel_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO categories_songs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                params![rel_id, category_id, song.id],
            )?;
        }

        Ok(())
    }

    pub fn get_song_by_id(&self, song_id: &str) -> Result<Song, AppError> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, name, composer, arranger, is_favorite, updated_at FROM songs WHERE id = ?1",
            params![song_id],
            |row| {
                Ok(Song {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    composer: row.get(2)?,
                    arranger: row.get(3)?,
                    is_favorite: row.get::<_, i32>(4)? != 0,
                    updated_at: parse_datetime(&row.get::<_, String>(5)?),
                })
            },
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::SongNotFound(song_id.to_string()),
            other => AppError::Database(other),
        })
    }

    pub fn get_all_songs(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, composer, arranger, updated_at, is_favorite
             FROM songs
             ORDER BY updated_at DESC"
        )?;

        let songs: Vec<SongListItem> = stmt.query_map([], |row| {
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
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(songs.len());
        for mut song in songs {
            song.scores = self.get_scores_for_song(&conn, &song.id)?;
            song.category_ids = self.get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
    }

    pub fn get_favorited_songs(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, composer, arranger, updated_at, is_favorite
             FROM songs WHERE is_favorite = 1
             ORDER BY updated_at DESC"
        )?;

        let songs: Vec<SongListItem> = stmt.query_map([], |row| {
            Ok(SongListItem {
                id: row.get(0)?,
                name: row.get(1)?,
                composer: row.get(2)?,
                arranger: row.get(3)?,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                is_favorite: true,
                category_ids: Vec::new(),
                scores: Vec::new(),
            })
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(songs.len());
        for mut song in songs {
            song.scores = self.get_scores_for_song(&conn, &song.id)?;
            song.category_ids = self.get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
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
        let fts_query = format!("{}*", query);

        let mut stmt = conn.prepare(
            "SELECT s.id, s.name, s.composer, s.arranger, s.updated_at, s.is_favorite
             FROM songs s
             INNER JOIN songs_fts ON songs_fts.rowid = s.rowid
             WHERE songs_fts MATCH ?1
             ORDER BY rank"
        )?;

        let songs: Vec<SongListItem> = stmt.query_map(params![fts_query], |row| {
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
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(songs.len());
        for mut song in songs {
            song.scores = self.get_scores_for_song(&conn, &song.id)?;
            song.category_ids = self.get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
    }

    pub fn get_songs_by_category(&self, category_id: &str) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT s.id, s.name, s.composer, s.arranger, s.updated_at, s.is_favorite
             FROM songs s
             INNER JOIN categories_songs cs ON cs.song_id = s.id
             WHERE cs.category_id = ?1
             ORDER BY s.updated_at DESC"
        )?;

        let songs: Vec<SongListItem> = stmt.query_map(params![category_id], |row| {
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
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(songs.len());
        for mut song in songs {
            song.scores = self.get_scores_for_song(&conn, &song.id)?;
            song.category_ids = self.get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
    }

    pub fn get_songs_with_drafts(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, s.updated_at, s.is_favorite
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'draft'
             ORDER BY s.updated_at DESC"
        )?;

        let songs: Vec<SongListItem> = stmt.query_map([], |row| {
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
        })?.filter_map(|r| r.ok()).collect();

        let mut result = Vec::with_capacity(songs.len());
        for mut song in songs {
            song.scores = self.get_scores_for_song(&conn, &song.id)?;
            song.category_ids = self.get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
    }

    // ── Scores ──

    pub fn insert_score(&self, score: &Score) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, updated_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                score.id,
                score.song_id,
                score.name,
                score.host_id,
                score.file_path,
                score.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                score.status.as_str(),
            ],
        )?;
        Ok(())
    }

    pub fn update_score(
        &self,
        score_id: &str,
        name: Option<String>,
        file_path: &str,
        now: chrono::NaiveDateTime,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET name = ?1, file_path = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                name,
                file_path,
                now.format("%Y-%m-%d %H:%M:%S").to_string(),
                score_id,
            ],
        )?;
        Ok(())
    }

    pub fn get_score_file_path(&self, score_id: &str) -> Result<String, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT file_path FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::ScoreNotFound(score_id.to_string()),
            other => AppError::Database(other),
        })
    }

    fn get_scores_for_song(&self, conn: &Connection, song_id: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, file_path, updated_at, status
             FROM scores
             WHERE song_id = ?1
             ORDER BY name"
        )?;

        let scores = stmt.query_map(params![song_id], |row| {
            let file_path: String = row.get(2)?;
            let file_extension = file_path
                .rsplit('.')
                .next()
                .unwrap_or("")
                .to_lowercase();

            Ok(ScoreListItem {
                id: row.get(0)?,
                name: row.get(1)?,
                file_path,
                file_extension,
                updated_at: parse_datetime(&row.get::<_, String>(3)?),
                status: ScoreStatus::from_str(&row.get::<_, String>(4)?),
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(scores)
    }

    fn get_category_ids(&self, conn: &Connection, song_id: &str) -> Result<Vec<String>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT category_id FROM categories_songs WHERE song_id = ?1"
        )?;

        let category_ids: Vec<String> = stmt.query_map(params![song_id], |row| {
            row.get(0)
        })?.filter_map(|r| r.ok()).collect();

        Ok(category_ids)
    }

    // ── Categories ──

    pub fn insert_category(&self, category: &Category) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (id, name) VALUES (?1, ?2)",
            params![category.id, category.name],
        )?;
        Ok(())
    }

    pub fn get_all_categories(&self) -> Result<Vec<Category>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name FROM categories ORDER BY name")?;

        let categories = stmt.query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(categories)
    }

    pub fn delete_category(&self, category_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM categories WHERE id = ?1", params![category_id])?;
        Ok(())
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
            computer_id: self.get_setting("computer_id")?.unwrap_or_default(),
            computer_name: self.get_setting("computer_name")?,
            google_drive_mode: match self.get_setting("google_drive_mode")?.as_deref() {
                Some("api") => GoogleDriveMode::Api,
                _ => GoogleDriveMode::Local,
            },
            first_run_completed: self.get_setting("first_run_completed")?.as_deref() == Some("true"),
            google_service_account: self.get_setting("google_service_account")?
                .and_then(|json| serde_json::from_str(&json).ok()),
        };
        Ok(settings)
    }

    pub fn save_app_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        self.set_setting("computer_id", &settings.computer_id)?;
        if let Some(ref name) = settings.computer_name {
            self.set_setting("computer_name", name)?;
        }
        if let Some(ref service_account) = settings.google_service_account {
            if let Ok(json) = serde_json::to_string(service_account) {
                self.set_setting("google_service_account", &json)?;
            }
        }
        self.set_setting("google_drive_mode", match settings.google_drive_mode {
            GoogleDriveMode::Local => "local",
            GoogleDriveMode::Api => "api",
        })?;
        self.set_setting("first_run_completed", if settings.first_run_completed { "true" } else { "false" })?;
        Ok(())
    }
}

fn parse_datetime(s: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[cfg(test)]
#[path = "database_tests.rs"]
mod database_tests;
