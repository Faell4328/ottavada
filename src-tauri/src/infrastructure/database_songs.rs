use rusqlite::params;

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::{
    to_not_found, ChangedFieldRecord, Database, DEFAULT_CATEGORY_ID, SONGS_SELECT_FIELDS, parse_datetime,
};
use crate::services::path_normalizer::to_storage_path;

impl Database {
    fn get_category_ids(conn: &rusqlite::Connection, song_id: &str) -> Result<Vec<String>, AppError> {
        let mut stmt = conn.prepare("SELECT categoryId FROM categoriesSongs WHERE songId = ?1")?;

        let category_ids: Vec<String> = stmt
            .query_map(params![song_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(category_ids)
    }

    fn query_song_list_items(
        conn: &rusqlite::Connection,
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
                    path: row.get(4)?,
                    updated_at: parse_datetime(&row.get::<_, String>(5)?),
                    is_favorite: row.get::<_, i32>(6)? != 0,
                    status: ScoreStatus::from_str(&row.get::<_, String>(7)?),
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
        conn: &rusqlite::Connection,
        song_ids: &[String],
    ) -> Result<std::collections::HashMap<String, Vec<ScoreListItem>>, AppError> {
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

        let mut grouped: std::collections::HashMap<String, Vec<ScoreListItem>> =
            std::collections::HashMap::new();
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
        conn: &rusqlite::Connection,
        song_ids: &[String],
    ) -> Result<std::collections::HashMap<String, Vec<String>>, AppError> {
        let placeholders = std::iter::repeat("?")
            .take(song_ids.len())
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            "SELECT songId, categoryId
             FROM categoriesSongs
             WHERE songId IN ({})
             ORDER BY songId ASC, categoryId ASC",
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

        let mut grouped: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for row in rows {
            let (song_id, category_id) = row?;
            grouped.entry(song_id).or_default().push(category_id);
        }

        Ok(grouped)
    }

    // ── Songs ──

    pub fn insert_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let now_ts = chrono::Local::now().timestamp();
        let category_ids = Self::normalize_category_ids(category_ids);

        if song.path.trim().is_empty() {
            return Err(AppError::Generic(
                "Song path cannot be empty".to_string(),
            ));
        }

        let storage_path = to_storage_path(&song.path);

        conn.execute(
            "INSERT INTO songs (id, name, composer, arranger, path, is_favorite, status, last_score_file_modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                song.id,
                song.name,
                song.composer,
                song.arranger,
                storage_path,
                song.is_favorite,
                song.status.as_str(),
                now_ts,
            ],
        )?;

        for category_id in category_ids {
            let rel_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                params![rel_id, category_id, song.id],
            )?;

            Self::insert_changed_field(
                &conn,
                "insert",
                "categoriesSongs",
                &rel_id,
                Some("categoryId"),
                Some(category_id.clone()),
            )?;

            Self::insert_changed_field(
                &conn,
                "insert",
                "categoriesSongs",
                &rel_id,
                Some("songId"),
                Some(song.id.clone()),
            )?;
        }

        Self::insert_changed_field(
            &conn,
            "insert",
            "songs",
            &song.id,
            Some("name"),
            Some(song.name.clone()),
        )?;

        if let Some(composer) = song.composer.clone() {
            Self::insert_changed_field(
                &conn,
                "insert",
                "songs",
                &song.id,
                Some("composer"),
                Some(composer),
            )?;
        }

        if let Some(arranger) = song.arranger.clone() {
            Self::insert_changed_field(
                &conn,
                "insert",
                "songs",
                &song.id,
                Some("arranger"),
                Some(arranger),
            )?;
        }
        Ok(())
    }

    pub fn update_song(&self, song: &Song, category_ids: &[String]) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let category_ids = Self::normalize_category_ids(category_ids);

        let original_song = conn
            .query_row(
                "SELECT name, composer, arranger, path FROM songs WHERE id = ?1",
                params![song.id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .map_err(|e| to_not_found(AppError::SongNotFound(song.id.clone()))(e))?;

        let old_category_ids = Self::get_category_ids(&conn, &song.id)?;

        let storage_path = to_storage_path(&song.path);

        conn.execute(
            "UPDATE songs SET name = ?1, composer = ?2, arranger = ?3, path = ?4, is_favorite = ?5
             WHERE id = ?6",
            params![
                song.name,
                song.composer,
                song.arranger,
                storage_path,
                song.is_favorite,
                song.id,
            ],
        )?;

        conn.execute(
            "DELETE FROM categoriesSongs WHERE songId = ?1",
            params![song.id],
        )?;

        for category_id in &category_ids {
            let rel_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                params![rel_id, category_id, song.id],
            )?;

            if !old_category_ids.iter().any(|id| id == category_id) {
                Self::insert_changed_field(
                    &conn,
                    "insert",
                    "categoriesSongs",
                    &rel_id,
                    Some("categoryId"),
                    Some(category_id.clone()),
                )?;

                Self::insert_changed_field(
                    &conn,
                    "insert",
                    "categoriesSongs",
                    &rel_id,
                    Some("songId"),
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
            )?;
        }

        for old_category_id in old_category_ids {
            if !category_ids.iter().any(|id| id == &old_category_id) {
                Self::insert_changed_field(
                    &conn,
                    "delete",
                    "categoriesSongs",
                    &song.id,
                    Some("categoryId"),
                    Some(old_category_id.clone()),
                )?;
            }
        }

        Ok(())
    }

    pub fn get_song_by_id(&self, song_id: &str) -> Result<Song, AppError> {
        let conn = self.lock_conn();

        conn.query_row(
            "SELECT id, name, composer, arranger, path, is_favorite, status FROM songs WHERE id = ?1",
            params![song_id],
            |row| {
                Ok(Song {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    composer: row.get(2)?,
                    arranger: row.get(3)?,
                    path: row.get(4)?,
                    is_favorite: row.get::<_, bool>(5)?,
                    status: ScoreStatus::from_str(&row.get::<_, String>(6)?),
                    updated_at: chrono::Local::now().naive_local(),
                    updated_by: String::new(),
                })
            },
        )
        .map_err(|e| to_not_found(AppError::SongNotFound(song_id.to_string()))(e))
    }

    pub fn get_song_list_item_by_id(&self, song_id: &str) -> Result<SongListItem, AppError> {
        let conn = self.lock_conn();
        let mut items = Self::query_song_list_items(
            &conn,
            &format!("SELECT {SONGS_SELECT_FIELDS} FROM songs WHERE id = ?1"),
            &[&song_id as &dyn rusqlite::ToSql],
            true,
        )?;
        items
            .pop()
            .ok_or_else(|| AppError::SongNotFound(song_id.to_string()))
    }

    pub fn get_library_summary_counts(&self) -> Result<LibrarySummary, AppError> {
        let conn = self.lock_conn();
        let mut summary = LibrarySummary::default();

        let mut stmt = conn.prepare(
            r#"SELECT status, COUNT(*) AS scores_count, COUNT(DISTINCT song_id) AS songs_count
                         FROM scores
                             WHERE status IN ('main', 'draft')
                         GROUP BY status"#,
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
                "draft" => summary.draft = bucket,
                _ => {}
            }
        }

        Ok(summary)
    }

    pub fn get_all_songs(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            &format!("SELECT {SONGS_SELECT_FIELDS} FROM songs ORDER BY name COLLATE NOCASE ASC, id ASC"),
            &[],
            true,
        )
    }

    pub fn get_all_song_summaries(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            &format!("SELECT {SONGS_SELECT_FIELDS} FROM songs ORDER BY name COLLATE NOCASE ASC, id ASC"),
            &[],
            false,
        )
    }

    pub fn get_favorited_songs(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            &format!("SELECT {SONGS_SELECT_FIELDS} FROM songs WHERE is_favorite = 1 ORDER BY name COLLATE NOCASE ASC, id ASC"),
            &[],
            true,
        )
    }

    pub fn get_favorited_song_summaries(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            &format!("SELECT {SONGS_SELECT_FIELDS} FROM songs WHERE is_favorite = 1 ORDER BY name COLLATE NOCASE ASC, id ASC"),
            &[],
            false,
        )
    }

    pub fn toggle_favorite(&self, song_id: &str) -> Result<bool, AppError> {
        let conn = self.lock_conn();

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
        let conn = self.lock_conn();
        let like_query = format!("%{}%", query.trim());
        Self::query_song_list_items(
            &conn,
            r#"SELECT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             WHERE s.name LIKE ?1
                OR COALESCE(s.composer, '') LIKE ?1
                OR COALESCE(s.arranger, '') LIKE ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC"#,
            &[&like_query as &dyn rusqlite::ToSql],
            true,
        )
    }

    #[allow(dead_code)]
    pub fn search_song_summaries(&self, query: &str) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        let like_query = format!("%{}%", query.trim());
        Self::query_song_list_items(
            &conn,
            r#"SELECT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             WHERE s.name LIKE ?1
                OR COALESCE(s.composer, '') LIKE ?1
                OR COALESCE(s.arranger, '') LIKE ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC"#,
            &[&like_query as &dyn rusqlite::ToSql],
            false,
        )
    }

    pub fn get_songs_by_category(&self, category_id: &str) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             INNER JOIN categoriesSongs cs ON cs.songId = s.id
             WHERE cs.categoryId = ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[&category_id as &dyn rusqlite::ToSql],
            true,
        )
    }

    pub fn get_song_summaries_by_category(
        &self,
        category_id: &str,
    ) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             INNER JOIN categoriesSongs cs ON cs.songId = s.id
             WHERE cs.categoryId = ?1
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[&category_id as &dyn rusqlite::ToSql],
            false,
        )
    }

    pub fn get_songs_with_drafts(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'draft'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            true,
        )
    }

    pub fn get_song_summaries_with_drafts(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            "SELECT DISTINCT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             INNER JOIN scores sc ON sc.song_id = s.id
             WHERE sc.status = 'draft'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            false,
        )
    }

    pub fn get_songs_with_not_found(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             WHERE s.status = 'not_found'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            true,
        )
    }

    pub fn get_song_summaries_with_not_found(&self) -> Result<Vec<SongListItem>, AppError> {
        let conn = self.lock_conn();
        Self::query_song_list_items(
            &conn,
            "SELECT s.id, s.name, s.composer, s.arranger, s.path, datetime('now') AS updated_at, s.is_favorite, s.status
             FROM songs s
             WHERE s.status = 'not_found'
             ORDER BY s.name COLLATE NOCASE ASC, s.id ASC",
            &[],
            false,
        )
    }

    pub fn get_scores_for_song(&self, song_id: &str) -> Result<Vec<ScoreListItem>, AppError> {
        let conn = self.lock_conn();
        let mut grouped = Self::get_scores_for_songs(&conn, &[song_id.to_string()])?;
        Ok(grouped.remove(song_id).unwrap_or_default())
    }

    pub fn update_song_status_for_song(
        &self,
        song_id: &str,
        status: ScoreStatus,
        _updated_by: &str,
    ) -> Result<(), AppError> {
        let mut conn = self.lock_conn();
        let tx = conn.transaction()?;

        let current_status: String = tx
            .query_row(
                "SELECT status FROM songs WHERE id = ?1",
                params![song_id],
                |row| row.get(0),
            )
            .map_err(|e| to_not_found(AppError::SongNotFound(song_id.to_string()))(e))?;

        let mut score_stmt = tx.prepare("SELECT id, status FROM scores WHERE song_id = ?1")?;
        let score_rows = score_stmt.query_map(params![song_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut score_updates = Vec::new();
        for row in score_rows {
            score_updates.push(row?);
        }

        if current_status != status.as_str() {
            tx.execute(
                "UPDATE songs SET status = ?1 WHERE id = ?2",
                params![status.as_str(), song_id],
            )?;

            Self::insert_changed_field(
                &tx,
                "update",
                "songs",
                song_id,
                Some("status"),
                Some(current_status.clone()),
            )?;
        }

        let mut score_status_changed = false;
        for (score_id, old_status) in score_updates {
            if old_status == ScoreStatus::Ignored.as_str() {
                continue;
            }

            if old_status == status.as_str() {
                continue;
            }

            score_status_changed = true;
            tx.execute(
                "UPDATE scores SET status = ?1 WHERE id = ?2",
                params![status.as_str(), score_id],
            )?;

            Self::insert_changed_field(
                &tx,
                "update",
                "scores",
                &score_id,
                Some("status"),
                Some(old_status),
            )?;
        }

        drop(score_stmt);

        if score_status_changed || current_status != status.as_str() {
            tx.execute(
                "INSERT INTO songsBackup (songId, status)
                 VALUES (?1, 'processing')
                 ON CONFLICT(songId) DO UPDATE SET
                    status = 'processing'",
                params![song_id],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    // ── Categories ──

    pub fn insert_category(&self, category: &Category) -> Result<(), AppError> {
        let conn = self.lock_conn();
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
            Some(category.name.clone()),
        )?;

        Ok(())
    }

    pub fn update_category(
        &self,
        category_id: &str,
        name: &str,
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();

        if category_id == DEFAULT_CATEGORY_ID {
            return Err(AppError::Generic(
                "The 'Uncategorized' category cannot be edited".to_string(),
            ));
        }

        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(AppError::Generic(
                "Category name cannot be empty".to_string(),
            ));
        }

        let current_name: String = conn
            .query_row(
                "SELECT name FROM categories WHERE id = ?1",
                params![category_id],
                |row| row.get(0),
            )
            .map_err(|_| AppError::Generic("Category not found".to_string()))?;

        if current_name == trimmed_name {
            return Ok(());
        }

        let duplicate_exists: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT id FROM categories WHERE name = ?1 AND id <> ?2",
            params![trimmed_name, category_id],
            |row| row.get(0),
        );

        if duplicate_exists.is_ok() {
            return Err(AppError::Generic(
                "A category with this name already exists".to_string(),
            ));
        }

        conn.execute(
            "UPDATE categories SET name = ?1 WHERE id = ?2",
            params![trimmed_name, category_id],
        )?;

        Self::insert_changed_field(
            &conn,
            "update",
            "categories",
            category_id,
            Some("name"),
            Some(trimmed_name.to_string()),
        )?;

        Ok(())
    }

    fn update_song_author_field(
        &self,
        field_name: &str,
        old_name: &str,
        new_name: Option<&str>,
    ) -> Result<usize, AppError> {
        let conn = self.lock_conn();
        let trimmed_old_name = old_name.trim();

        if trimmed_old_name.is_empty() {
            return Err(AppError::Generic(
                "Name cannot be empty".to_string(),
            ));
        }

        let normalized_new_name = new_name.map(str::trim).filter(|value| !value.is_empty());

        if let Some(next_name) = normalized_new_name {
            if next_name.eq_ignore_ascii_case(trimmed_old_name) {
                return Ok(0);
            }
        }

        if !matches!(field_name, "composer" | "arranger") {
            return Err(AppError::Generic(format!(
                "Invalid field for author update: {}",
                field_name
            )));
        }

        let select_sql = format!(
            "SELECT id FROM songs WHERE {} IS NOT NULL AND LOWER(TRIM({})) = LOWER(?1)",
            field_name, field_name
        );
        let mut stmt = conn.prepare(&select_sql)?;
        let song_ids: Vec<String> = stmt
            .query_map(params![trimmed_old_name], |row| row.get(0))?
            .filter_map(|row| row.ok())
            .collect();

        if song_ids.is_empty() {
            return Ok(0);
        }

        let update_sql = format!("UPDATE songs SET {} = ?1 WHERE id = ?2", field_name);
        let change_value = normalized_new_name.map(str::to_string);

        for song_id in &song_ids {
            let previous_value: Option<String> = conn
                .query_row(
                    &format!("SELECT {} FROM songs WHERE id = ?1", field_name),
                    params![song_id],
                    |row| row.get(0),
                )
                .ok()
                .flatten();

            conn.execute(&update_sql, params![change_value, song_id])?;
            Self::insert_changed_field(
                &conn,
                "update",
                "songs",
                song_id,
                Some(field_name),
                change_value.clone().or(previous_value),
            )?;
        }

        Ok(song_ids.len())
    }

    pub fn update_composer(&self, old_name: &str, new_name: &str) -> Result<usize, AppError> {
        self.update_song_author_field("composer", old_name, Some(new_name))
    }

    pub fn delete_composer(&self, old_name: &str) -> Result<usize, AppError> {
        self.update_song_author_field("composer", old_name, None)
    }

    pub fn update_arranger(&self, old_name: &str, new_name: &str) -> Result<usize, AppError> {
        self.update_song_author_field("arranger", old_name, Some(new_name))
    }

    pub fn delete_arranger(&self, old_name: &str) -> Result<usize, AppError> {
        self.update_song_author_field("arranger", old_name, None)
    }

    pub fn get_all_categories(&self) -> Result<Vec<Category>, AppError> {
        let conn = self.lock_conn();
        Self::ensure_default_category_with_conn(&conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, name FROM categories
             ORDER BY CASE WHEN id = 'default-category' THEN 0 ELSE 1 END, name COLLATE NOCASE",
        )?;

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
        let conn = self.lock_conn();

        if category_id == DEFAULT_CATEGORY_ID {
            return Err(AppError::Generic(
                "The 'Uncategorized' category cannot be removed".to_string(),
            ));
        }

        let category_name: String = conn.query_row(
            "SELECT name FROM categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        )?;

        let relation_ids: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM categoriesSongs WHERE categoryId = ?1")?;
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
            )?;
        }

        Self::insert_changed_field(
            &conn,
            "delete",
            "categories",
            category_id,
            Some("name"),
            Some(category_name),
        )?;

        Ok(())
    }

    pub fn delete_song(&self, song_id: &str) -> Result<(), AppError> {
        let conn = self.lock_conn();

        let (song_name, score_rows): (String, Vec<(String, String)>) = {
            let song_name: String = conn.query_row(
                "SELECT name FROM songs WHERE id = ?1",
                params![song_id],
                |row| row.get(0),
            )?;

            let mut stmt = conn.prepare("SELECT id, file_name FROM scores WHERE song_id = ?1")?;
            let rows = stmt.query_map(params![song_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;

            let score_rows = rows.filter_map(|row| row.ok()).collect();
            (song_name, score_rows)
        };

        conn.query_row(
            "SELECT id FROM songs WHERE id = ?1",
            params![song_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| to_not_found(AppError::SongNotFound(song_id.to_string()))(e))?;

        let relation_ids: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM categoriesSongs WHERE songId = ?1")?;
            let rows = stmt.query_map(params![song_id], |row| row.get::<_, String>(0))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        conn.execute("DELETE FROM scores WHERE song_id = ?1", params![song_id])?;

        conn.execute(
            "DELETE FROM categoriesSongs WHERE songId = ?1",
            params![song_id],
        )?;

        let affected = conn.execute("DELETE FROM songs WHERE id = ?1", params![song_id])?;
        if affected == 0 {
            return Err(AppError::Generic("Song not found".into()));
        }

        for (score_id, file_name) in score_rows {
            Self::insert_changed_field(
                &conn,
                "delete",
                "scores",
                &score_id,
                Some("file_name"),
                Some(file_name),
            )?;
        }

        for relation_id in relation_ids {
            Self::insert_changed_field(
                &conn,
                "delete",
                "categoriesSongs",
                &relation_id,
                None,
                None,
            )?;
        }

        Self::insert_changed_field(
            &conn,
            "delete",
            "songs",
            song_id,
            Some("name"),
            Some(song_name),
        )?;

        Ok(())
    }
}

impl Database {
    // ===== Methods for tracking database updates =====

    pub fn get_latest_songs_update_timestamp(&self) -> Result<Option<i64>, AppError> {
        let conn = self.lock_conn();

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

    pub fn get_changed_fields_ordered(&self) -> Result<Vec<ChangedFieldRecord>, AppError> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare(
            "SELECT id, type, entity, entityId, field, value, timestamp
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
                value: row.get(5)?,
                timestamp: row.get(6)?,
            })
        })?;

        let records: Result<Vec<_>, _> = rows.collect();
        Ok(records?)
    }

    pub fn clear_changed_fields(&self) -> Result<usize, AppError> {
        let conn = self.lock_conn();
        let deleted = conn.execute("DELETE FROM changedField", [])?;
        Ok(deleted)
    }

    pub fn clear_changed_fields_before(&self, timestamp: i64) -> Result<usize, AppError> {
        let conn = self.lock_conn();
        let deleted = conn.execute(
            "DELETE FROM changedField WHERE timestamp <= ?1",
            params![timestamp],
        )?;
        Ok(deleted)
    }

    pub fn clear_changed_fields_for_entity(
        &self,
        entity: &str,
        entity_id: &str,
    ) -> Result<usize, AppError> {
        let conn = self.lock_conn();
        let deleted = conn.execute(
            "DELETE FROM changedField WHERE entity = ?1 AND entityId = ?2",
            params![entity, entity_id],
        )?;
        Ok(deleted)
    }

    pub fn has_pending_changes(&self) -> Result<bool, AppError> {
        let conn = self.lock_conn();
        let count: i64 =
            conn.query_row("SELECT COUNT(1) FROM changedField", [], |row| row.get(0))?;
        Ok(count > 0)
    }

    pub fn get_pending_changes_count(&self) -> Result<usize, AppError> {
        let conn = self.lock_conn();
        let count: i64 =
            conn.query_row("SELECT COUNT(1) FROM changedField", [], |row| row.get(0))?;
        Ok(count as usize)
    }

    pub fn get_latest_changed_field_timestamp(&self) -> Result<Option<i64>, AppError> {
        let conn = self.lock_conn();
        let latest = conn.query_row("SELECT MAX(timestamp) FROM changedField", [], |row| {
            row.get::<_, Option<i64>>(0)
        })?;
        Ok(latest)
    }

    pub fn get_telemetry_summary_counts(
        &self,
    ) -> Result<crate::services::telemetry_service::TelemetrySummaryCounts, AppError> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare(
            "WITH score_status_by_song AS (
                SELECT
                    song_id,
                    MAX(CASE WHEN status = 'main' THEN 1 ELSE 0 END) AS has_main,
                    MAX(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS has_draft,
                    COUNT(*) AS scores_count,
                    SUM(CASE WHEN status = 'main' THEN 1 ELSE 0 END) AS scores_main,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS scores_draft
                FROM scores
                GROUP BY song_id
            )
            SELECT
                COUNT(s.id) AS music_count,
                COALESCE(SUM(CASE WHEN COALESCE(ss.has_main, 0) = 1 THEN 1 ELSE 0 END), 0) AS music_main,
                COALESCE(SUM(CASE WHEN COALESCE(ss.has_main, 0) = 0 AND COALESCE(ss.has_draft, 0) = 1 THEN 1 ELSE 0 END), 0) AS music_draft,
                COALESCE(SUM(ss.scores_count), 0) AS scores_count,
                COALESCE(SUM(ss.scores_main), 0) AS scores_main,
                COALESCE(SUM(ss.scores_draft), 0) AS scores_draft
            FROM songs s
            LEFT JOIN score_status_by_song ss ON ss.song_id = s.id",
        )?;

        let counts = stmt.query_row([], |row| {
            Ok(crate::services::telemetry_service::TelemetrySummaryCounts {
                music_count: row.get::<_, i64>(0)? as u64,
                music_main: row.get::<_, i64>(1)? as u64,
                music_draft: row.get::<_, i64>(2)? as u64,
                scores_count: row.get::<_, i64>(3)? as u64,
                scores_main: row.get::<_, i64>(4)? as u64,
                scores_draft: row.get::<_, i64>(5)? as u64,
            })
        })?;

        Ok(counts)
    }

    pub fn list_telemetry_errors(
        &self,
    ) -> Result<Vec<crate::services::telemetry_service::TelemetryErrorPayload>, AppError> {
        let conn = self.lock_conn();
        let mut stmt =
            conn.prepare("SELECT id, message, timestamp FROM errors ORDER BY timestamp ASC")?;

        let errors = stmt
            .query_map([], |row| {
                let timestamp: i64 = row.get(2)?;
                let date = chrono::DateTime::from_timestamp(timestamp, 0)
                    .map(|value| value.format("%Y-%m-%d").to_string())
                    .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

                Ok(crate::services::telemetry_service::TelemetryErrorPayload {
                    id: row.get(0)?,
                    date,
                    message: row.get(1)?,
                    timestamp,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        Ok(errors)
    }

    pub fn prune_telemetry_errors_older_than_week(
        &self,
        now_timestamp: i64,
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let cutoff = now_timestamp - 7 * 24 * 60 * 60;
        conn.execute("DELETE FROM errors WHERE timestamp < ?1", params![cutoff])?;
        Ok(())
    }

    pub fn clear_telemetry_errors(&self) -> Result<(), AppError> {
        let conn = self.lock_conn();
        conn.execute("DELETE FROM errors", [])?;
        Ok(())
    }

    pub fn record_telemetry_error(
        &self,
        computer_id: &str,
        message: &str,
        timestamp: i64,
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let date = chrono::DateTime::from_timestamp(timestamp, 0)
            .map(|value| value.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

        conn.execute(
            "INSERT OR IGNORE INTO computerInformation (
                computerId, organizationName, computerName, type, appVersion, os, arch, date, report
             ) VALUES (?1, '', '', 'server', '', '', '', ?2, 0)",
            params![computer_id, date],
        )?;

        conn.execute(
            "INSERT OR IGNORE INTO errors (id, message, timestamp)
             VALUES (?1, ?2, ?3)",
            params![id, message, timestamp],
        )?;

        Ok(())
    }
}
