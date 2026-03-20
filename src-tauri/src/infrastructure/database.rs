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
        Self::run_migrations_with_conn(&conn)
    }

    fn run_migrations_with_conn(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch("
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
        ")?;

        // Tabelas base (sem dependência)
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
                status TEXT NOT NULL DEFAULT 'main',
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_by TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS categories_songs (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE(category_id, song_id)
            );

            CREATE TABLE IF NOT EXISTS directories (
                id TEXT PRIMARY KEY,
                path_name TEXT NOT NULL UNIQUE
            );
        ")?;

        // Verificar se a tabela scores precisa de migração (file_path → directory_id + file_name)
        let columns = Self::get_table_columns(conn, "scores");
        let has_old_schema = columns.contains(&"file_path".to_string());
        let has_new_schema = columns.contains(&"directory_id".to_string());

        if has_old_schema && !has_new_schema {
            Self::migrate_scores_to_directory_schema(conn)?;
        } else if !has_new_schema {
            // Tabela não existe ou schema desconhecido - criar do zero
            conn.execute_batch("
                CREATE TABLE IF NOT EXISTS scores (
                    id TEXT PRIMARY KEY,
                    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                    name TEXT,
                    host_id TEXT NOT NULL,
                    directory_id TEXT NOT NULL REFERENCES directories(id),
                    file_name TEXT NOT NULL,
                    file_size INTEGER NOT NULL DEFAULT 0,
                    file_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    status TEXT NOT NULL DEFAULT 'main',
                    updated_by TEXT NOT NULL DEFAULT '',
                    UNIQUE(directory_id, file_name)
                );
            ")?;
        }

        // Migration: Adicionar status e updated_by em tabelas existentes
        let songs_columns = Self::get_table_columns(conn, "songs");
        if !songs_columns.contains(&"status".to_string()) {
            conn.execute(
                "ALTER TABLE songs ADD COLUMN status TEXT NOT NULL DEFAULT 'main'",
                [],
            ).ok(); // Ignore error if column already exists
        }
        if !songs_columns.contains(&"updated_by".to_string()) {
            conn.execute(
                "ALTER TABLE songs ADD COLUMN updated_by TEXT NOT NULL DEFAULT ''",
                [],
            ).ok(); // Ignore error if column already exists
        }

        let scores_columns = Self::get_table_columns(conn, "scores");
        if !scores_columns.contains(&"updated_by".to_string()) {
            conn.execute(
                "ALTER TABLE scores ADD COLUMN updated_by TEXT NOT NULL DEFAULT ''",
                [],
            ).ok(); // Ignore error if column already exists
        }

        // FTS5 para busca textual em músicas
        conn.execute_batch("
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
        ")?;

        // Índices
        conn.execute_batch("
            CREATE INDEX IF NOT EXISTS idx_scores_song_id ON scores(song_id);
            CREATE INDEX IF NOT EXISTS idx_scores_directory_id ON scores(directory_id);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_song_id ON categories_songs(song_id);
            CREATE INDEX IF NOT EXISTS idx_categories_songs_category_id ON categories_songs(category_id);
            CREATE INDEX IF NOT EXISTS idx_songs_is_favorite ON songs(is_favorite);
        ")?;

        Ok(())
    }

    /// Obtém os nomes das colunas de uma tabela
    fn get_table_columns(conn: &Connection, table: &str) -> Vec<String> {
        // Apenas nomes de tabelas hardcooded são passados aqui
        let sql = format!("PRAGMA table_info({})", table);
        match conn.prepare(&sql) {
            Ok(mut stmt) => {
                stmt.query_map([], |row| row.get::<_, String>(1))
                    .map(|rows| rows.filter_map(|r| r.ok()).collect())
                    .unwrap_or_default()
            }
            Err(_) => Vec::new(),
        }
    }

    /// Migra a tabela scores do schema antigo (file_path) para o novo (directory_id + file_name)
    fn migrate_scores_to_directory_schema(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch("PRAGMA foreign_keys=OFF;")?;

        // 1. Ler todos os scores com file_path
        let mut stmt = conn.prepare(
            "SELECT id, song_id, name, host_id, file_path, file_size, file_modified_at, updated_at, status FROM scores"
        )?;

        struct OldScore {
            id: String,
            song_id: String,
            name: Option<String>,
            host_id: String,
            file_path: String,
            file_size: u64,
            file_modified_at: String,
            updated_at: String,
            status: String,
        }

        let old_scores: Vec<OldScore> = stmt.query_map([], |row| {
            Ok(OldScore {
                id: row.get(0)?,
                song_id: row.get(1)?,
                name: row.get(2)?,
                host_id: row.get(3)?,
                file_path: row.get(4)?,
                file_size: row.get(5)?,
                file_modified_at: row.get(6)?,
                updated_at: row.get(7)?,
                status: row.get(8)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        // 2. Extrair diretórios únicos e inserir
        let mut dir_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        for score in &old_scores {
            let (dir_path, _) = crate::services::indexer::split_file_path(&score.file_path);
            if !dir_map.contains_key(&dir_path) {
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT OR IGNORE INTO directories (id, path_name) VALUES (?1, ?2)",
                    params![id, dir_path],
                )?;
                // Buscar o id real (pode já existir)
                let real_id: String = conn.query_row(
                    "SELECT id FROM directories WHERE path_name = ?1",
                    params![dir_path],
                    |row| row.get(0),
                )?;
                dir_map.insert(dir_path, real_id);
            }
        }

        // 3. Criar nova tabela scores
        conn.execute_batch("
            CREATE TABLE scores_new (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                name TEXT,
                host_id TEXT NOT NULL,
                directory_id TEXT NOT NULL REFERENCES directories(id),
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                file_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                status TEXT NOT NULL DEFAULT 'main',
                updated_by TEXT NOT NULL DEFAULT '',
                UNIQUE(directory_id, file_name)
            );
        ")?;

        // 4. Copiar dados com directory_id e file_name calculados
        for score in &old_scores {
            let (dir_path, file_name) = crate::services::indexer::split_file_path(&score.file_path);
            let dir_id = dir_map.get(&dir_path)
                .ok_or_else(|| AppError::Generic(format!("Diretório não encontrado na migração: {}", dir_path)))?;

            conn.execute(
                "INSERT INTO scores_new (id, song_id, name, host_id, directory_id, file_name, file_size, file_modified_at, updated_at, status, updated_by)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    score.id,
                    score.song_id,
                    score.name,
                    score.host_id,
                    dir_id,
                    file_name,
                    score.file_size,
                    score.file_modified_at,
                    score.updated_at,
                    score.status,
                    "", // updated_by default empty
                ],
            )?;
        }

        // 5. Substituir tabela
        conn.execute_batch("
            DROP TABLE scores;
            ALTER TABLE scores_new RENAME TO scores;
        ")?;

        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        Ok(())
    }

    // ── Directories ──

    /// Insere um diretório ou retorna o ID do existente
    pub fn insert_or_get_directory(&self, path_name: &str) -> Result<String, AppError> {
        let conn = self.conn.lock().unwrap();
        Self::insert_or_get_directory_with_conn(&conn, path_name)
    }

    fn insert_or_get_directory_with_conn(conn: &Connection, path_name: &str) -> Result<String, AppError> {
        let result = conn.query_row(
            "SELECT id FROM directories WHERE path_name = ?1",
            params![path_name],
            |row| row.get::<_, String>(0),
        );

        match result {
            Ok(id) => Ok(id),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO directories (id, path_name) VALUES (?1, ?2)",
                    params![id, path_name],
                )?;
                Ok(id)
            }
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// Resolve um caminho de arquivo em (directory_id, file_name)
    pub fn resolve_directory_for_path(&self, file_path: &str) -> Result<(String, String), AppError> {
        let (dir_path, file_name) = crate::services::indexer::split_file_path(file_path);
        let directory_id = self.insert_or_get_directory(&dir_path)?;
        Ok((directory_id, file_name))
    }

    #[allow(dead_code)]
    pub fn get_all_directories(&self) -> Result<Vec<Directory>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, path_name FROM directories ORDER BY path_name")?;

        let dirs = stmt.query_map([], |row| {
            Ok(Directory {
                id: row.get(0)?,
                path_name: row.get(1)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(dirs)
    }

    // ── Songs ──

    pub fn insert_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO songs (id, name, composer, arranger, is_favorite, status, updated_at, updated_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                song.id,
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                song.status.as_str(),
                song.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                song.updated_by,
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
            "UPDATE songs SET name = ?1, composer = ?2, arranger = ?3, is_favorite = ?4, status = ?5, updated_at = ?6, updated_by = ?7
             WHERE id = ?8",
            params![
                song.name,
                song.composer,
                song.arranger,
                song.is_favorite as i32,
                song.status.as_str(),
                song.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                song.updated_by,
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
            "SELECT id, name, composer, arranger, is_favorite, status, updated_at, updated_by FROM songs WHERE id = ?1",
            params![song_id],
            |row| {
                Ok(Song {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    composer: row.get(2)?,
                    arranger: row.get(3)?,
                    is_favorite: row.get::<_, i32>(4)? != 0,
                    status: ScoreStatus::from_str(&row.get::<_, String>(5)?),
                    updated_at: parse_datetime(&row.get::<_, String>(6)?),
                    updated_by: row.get(7)?,
                })
            },
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::SongNotFound(song_id.to_string()),
            other => AppError::Database(other),
        })
    }

    /// Busca uma música completa (com scores e categorias) pelo ID
    pub fn get_song_list_item_by_id(&self, song_id: &str) -> Result<SongListItem, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut song = conn.query_row(
            "SELECT id, name, composer, arranger, updated_at, is_favorite FROM songs WHERE id = ?1",
            params![song_id],
            |row| {
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
            },
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::SongNotFound(song_id.to_string()),
            other => AppError::Database(other),
        })?;

        song.scores = Self::get_scores_for_song(&conn, &song.id)?;
        song.category_ids = Self::get_category_ids(&conn, &song.id)?;

        Ok(song)
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
            song.scores = Self::get_scores_for_song(&conn, &song.id)?;
            song.category_ids = Self::get_category_ids(&conn, &song.id)?;
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
            song.scores = Self::get_scores_for_song(&conn, &song.id)?;
            song.category_ids = Self::get_category_ids(&conn, &song.id)?;
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
            song.scores = Self::get_scores_for_song(&conn, &song.id)?;
            song.category_ids = Self::get_category_ids(&conn, &song.id)?;
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
            song.scores = Self::get_scores_for_song(&conn, &song.id)?;
            song.category_ids = Self::get_category_ids(&conn, &song.id)?;
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
            song.scores = Self::get_scores_for_song(&conn, &song.id)?;
            song.category_ids = Self::get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
    }

    #[allow(dead_code)]
    pub fn get_songs_with_not_found(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, s.updated_at, s.is_favorite
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'not_found'
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
            song.scores = Self::get_scores_for_song(&conn, &song.id)?;
            song.category_ids = Self::get_category_ids(&conn, &song.id)?;
            result.push(song);
        }

        Ok(result)
    }

    // ── Scores ──

    pub fn insert_score(&self, score: &Score) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, directory_id, file_name, file_size, file_modified_at, updated_at, status, updated_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                score.id,
                score.song_id,
                score.name,
                score.host_id,
                score.directory_id,
                score.file_name,
                score.file_size,
                score.file_modified_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                score.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                score.status.as_str(),
                score.updated_by,
            ],
        )?;
        Ok(())
    }

    pub fn update_score(
        &self,
        score_id: &str,
        name: Option<String>,
        directory_id: &str,
        file_name: &str,
        file_size: u64,
        file_modified_at: chrono::NaiveDateTime,
        now: chrono::NaiveDateTime,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET name = ?1, directory_id = ?2, file_name = ?3, file_size = ?4, file_modified_at = ?5, updated_at = ?6 WHERE id = ?7",
            params![
                name,
                directory_id,
                file_name,
                file_size,
                file_modified_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                now.format("%Y-%m-%d %H:%M:%S").to_string(),
                score_id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_score(&self, score_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM scores WHERE id = ?1", params![score_id])?;
        if affected == 0 {
            return Err(AppError::ScoreNotFound(score_id.to_string()));
        }
        Ok(())
    }

    /// Reconstrói o caminho completo do arquivo a partir de directory + file_name
    pub fn get_score_file_path(&self, score_id: &str) -> Result<String, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT d.path_name, s.file_name
             FROM scores s
             JOIN directories d ON d.id = s.directory_id
             WHERE s.id = ?1",
            params![score_id],
            |row| {
                let dir_path: String = row.get(0)?;
                let file_name: String = row.get(1)?;
                Ok(std::path::PathBuf::from(&dir_path)
                    .join(&file_name)
                    .to_string_lossy()
                    .to_string())
            },
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::ScoreNotFound(score_id.to_string()),
            other => AppError::Database(other),
        })
    }

    /// Obtém todos os scores com metadados para detecção de alterações
    /// Retorna: (score_id, file_path_completo, file_size, file_modified_at)
    pub fn get_all_scores_with_metadata(&self) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT s.id, d.path_name, s.file_name, s.file_size, s.file_modified_at
             FROM scores s
             JOIN directories d ON d.id = s.directory_id"
        )?;

        let scores = stmt.query_map([], |row| {
            let dir_path: String = row.get(1)?;
            let file_name: String = row.get(2)?;
            let file_path = std::path::PathBuf::from(&dir_path)
                .join(&file_name)
                .to_string_lossy()
                .to_string();
            Ok((
                row.get::<_, String>(0)?,
                file_path,
                row.get::<_, u64>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?.filter_map(|r| r.ok()).collect();

        Ok(scores)
    }

    /// Obtém todos os scores com status "not_found"
    /// Retorna: (score_id, file_path_completo, file_size, file_modified_at)
    pub fn get_not_found_scores(&self) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT s.id, d.path_name, s.file_name, s.file_size, s.file_modified_at
             FROM scores s
             JOIN directories d ON d.id = s.directory_id
             WHERE s.status = ?1"
        )?;

        let scores = stmt.query_map([ScoreStatus::NotFound.as_str()], |row| {
            let dir_path: String = row.get(1)?;
            let file_name: String = row.get(2)?;
            let file_path = std::path::PathBuf::from(&dir_path)
                .join(&file_name)
                .to_string_lossy()
                .to_string();
            Ok((
                row.get::<_, String>(0)?,
                file_path,
                row.get::<_, u64>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?.filter_map(|r| r.ok()).collect();

        Ok(scores)
    }

    /// Atualiza o status de um score para draft, atualizando também os metadados do arquivo
    pub fn set_score_status_to_draft(
        &self,
        score_id: &str,
        file_size: u64,
        file_modified_at: chrono::NaiveDateTime,
        updated_by: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET status = ?1, file_size = ?2, file_modified_at = ?3, updated_at = ?4, updated_by = ?5 WHERE id = ?6",
            params![
                ScoreStatus::Draft.as_str(),
                file_size,
                file_modified_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                chrono::Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string(),
                updated_by,
                score_id,
            ],
        )?;
        Ok(())
    }

    /// Atualiza o status de um score para not_found
    pub fn set_score_status_to_not_found(&self, score_id: &str, updated_by: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET status = ?1, updated_at = ?2, updated_by = ?3 WHERE id = ?4",
            params![
                ScoreStatus::NotFound.as_str(),
                chrono::Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string(),
                updated_by,
                score_id,
            ],
        )?;
        Ok(())
    }

    /// Recupera um score do status not_found para main
    pub fn set_score_status_to_main(&self, score_id: &str, file_size: u64, file_modified_at: chrono::NaiveDateTime, updated_by: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET status = ?1, file_size = ?2, file_modified_at = ?3, updated_at = ?4, updated_by = ?5 WHERE id = ?6",
            params![
                ScoreStatus::Main.as_str(),
                file_size,
                file_modified_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                chrono::Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string(),
                updated_by,
                score_id,
            ],
        )?;
        Ok(())
    }

    /// Atualiza o status de um score para um status específico
    pub fn set_score_status(&self, score_id: &str, status: ScoreStatus, updated_by: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE scores SET status = ?1, updated_at = ?2, updated_by = ?3 WHERE id = ?4",
            params![
                status.as_str(),
                chrono::Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string(),
                updated_by,
                score_id,
            ],
        )?;
        Ok(())
    }

    /// Busca scores de uma música com caminho completo reconstruído
    fn get_scores_for_song(conn: &Connection, song_id: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT s.id, s.name, d.path_name, s.file_name, s.updated_at, s.status
             FROM scores s
             JOIN directories d ON d.id = s.directory_id
             WHERE s.song_id = ?1
             ORDER BY s.name"
        )?;

        let scores = stmt.query_map(params![song_id], |row| {
            let dir_path: String = row.get(2)?;
            let file_name: String = row.get(3)?;
            let file_path = std::path::PathBuf::from(&dir_path)
                .join(&file_name)
                .to_string_lossy()
                .to_string();
            let file_extension = file_name
                .rsplit('.')
                .next()
                .unwrap_or("")
                .to_lowercase();

            Ok(ScoreListItem {
                id: row.get(0)?,
                name: row.get(1)?,
                file_path,
                file_extension,
                updated_at: parse_datetime(&row.get::<_, String>(4)?),
                status: ScoreStatus::from_str(&row.get::<_, String>(5)?),
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(scores)
    }

    fn get_category_ids(conn: &Connection, song_id: &str) -> Result<Vec<String>, AppError> {
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

    pub fn delete_song(&self, song_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        
        // Obter todos os diretórios usados por essa música
        let mut stmt = conn.prepare(
            "SELECT DISTINCT directory_id FROM scores WHERE song_id = ?1"
        )?;
        let directory_ids: Vec<String> = stmt
            .query_map(params![song_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        
        // Deletar as partituras da música
        conn.execute("DELETE FROM scores WHERE song_id = ?1", params![song_id])?;
        
        // Deletar as associações de categorias
        conn.execute("DELETE FROM categories_songs WHERE song_id = ?1", params![song_id])?;
        
        // Deletar a música
        let affected = conn.execute("DELETE FROM songs WHERE id = ?1", params![song_id])?;
        if affected == 0 {
            return Err(AppError::Generic("Música não encontrada".into()));
        }
        
        // Verificar cada diretório: se não há mais scores usando esse diretório, deletar
        for dir_id in directory_ids {
            let has_scores: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM scores WHERE directory_id = ?1",
                params![&dir_id],
                |row| row.get(0)
            )?;
            
            if !has_scores {
                conn.execute("DELETE FROM directories WHERE id = ?1", params![&dir_id])?;
            }
        }
        
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
