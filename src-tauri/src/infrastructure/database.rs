use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::{Mutex, Arc};

use crate::domain::errors::AppError;
use crate::domain::models::*;

#[derive(Clone)]
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
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
        let conn = Connection::open_in_memory()
            .map_err(|e| AppError::Database(e))?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
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
                file_size INTEGER NOT NULL DEFAULT 0,
                file_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                status TEXT NOT NULL DEFAULT 'main'
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

        // Migrations - adicionar colunas se não existirem (após CREATE TABLE)
        let _ = conn.execute(
            "ALTER TABLE scores ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE scores ADD COLUMN file_modified_at TEXT NOT NULL DEFAULT (datetime('now'))",
            [],
        );

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
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_size, file_modified_at, updated_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                score.id,
                score.song_id,
                score.name,
                score.host_id,
                score.file_path,
                score.file_size,
                score.file_modified_at.format("%Y-%m-%d %H:%M:%S").to_string(),
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
        file_size: u64,
        file_modified_at: chrono::NaiveDateTime,
        now: chrono::NaiveDateTime,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET name = ?1, file_path = ?2, file_size = ?3, file_modified_at = ?4, updated_at = ?5 WHERE id = ?6",
            params![
                name,
                file_path,
                file_size,
                file_modified_at.format("%Y-%m-%d %H:%M:%S").to_string(),
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

    /// Obtém todos os scores com seus metadados para detecção de alterações
    pub fn get_all_scores_with_metadata(&self) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_path, file_size, file_modified_at FROM scores"
        )?;

        let scores: Vec<(String, String, u64, String)> = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, u64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?.filter_map(|r| r.ok()).collect();

        Ok(scores)
    }

    /// Atualiza o status de um score para draft
    pub fn set_score_status_to_draft(&self, score_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![
                ScoreStatus::Draft.as_str(),
                chrono::Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string(),
                score_id,
            ],
        )?;
        Ok(())
    }

    fn get_scores_for_song(&self, conn: &Connection, song_id: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, file_path, file_size, file_modified_at, updated_at, status
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
                updated_at: parse_datetime(&row.get::<_, String>(5)?),
                status: ScoreStatus::from_str(&row.get::<_, String>(6)?),
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
}

fn parse_datetime(s: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[cfg(test)]
#[path = "database_tests.rs"]
mod database_tests;
