use rusqlite::{params, Connection};

use crate::domain::errors::AppError;
use crate::domain::models::datetime_utils;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::services::path_normalizer::to_storage_path;

impl Database {
    // ── Scores ──

    pub fn insert_score(&self, score: &Score) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let file_modified_at_ts = score.file_modified_at.and_utc().timestamp();
        let file_extension = Self::extract_file_extension(&score.file_name).unwrap_or_default();
        let storage_file_path = to_storage_path(&score.file_path);

        conn.execute(
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
                datetime_utils::format_datetime(score.file_modified_at),
                score.status.as_str(),
            ],
        )?;

        conn.execute(
            "UPDATE songs
             SET path = ?1,
                 last_score_file_modified_at = CASE
                   WHEN last_score_file_modified_at > ?2 THEN last_score_file_modified_at
                   ELSE ?2
                 END
                         WHERE id = ?3",
            params![storage_file_path, file_modified_at_ts, score.song_id],
        )?;

        Self::insert_changed_field(
            &conn,
            "insert",
            "scores",
            &score.id,
            Some("songId"),
            Some(score.song_id.clone()),
        )?;
        Self::insert_changed_field(
            &conn,
            "insert",
            "scores",
            &score.id,
            Some("name"),
            score.name.clone(),
        )?;
        Self::insert_changed_field(
            &conn,
            "insert",
            "scores",
            &score.id,
            Some("status"),
            Some(score.status.as_str().to_string()),
        )?;

        if let Some(extension) = Self::extract_file_extension(&score.file_name) {
            Self::insert_changed_field(
                &conn,
                "insert",
                "scores",
                &score.id,
                Some("extension"),
                Some(extension),
            )?;
        }

        Self::sync_song_status_from_scores(&conn, &score.song_id)?;

        conn.execute(
            "INSERT INTO songsBackup (songId, status)
             VALUES (?1, 'processing')
             ON CONFLICT(songId) DO UPDATE SET
                status = 'processing'",
            params![score.song_id],
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
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let file_modified_at_ts = file_modified_at.and_utc().timestamp();
        let file_extension = Self::extract_file_extension(file_name).unwrap_or_default();
        let storage_file_path = to_storage_path(file_path);

        let (original_name, original_file_path, original_file_name, original_status) = conn
            .query_row(
                "SELECT name, file_path, file_name, status FROM scores WHERE id = ?1",
                params![score_id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .map_err(|e| crate::infrastructure::database::to_not_found(AppError::ScoreNotFound(score_id.to_string()))(e))?;

        let file_changed = original_file_path != storage_file_path || original_file_name != file_name;
        let name_change_value = name.clone().or(original_name.clone());

        conn.execute(
            "UPDATE scores
             SET name = ?1,
                 file_path = ?2,
                 file_name = ?3,
                 file_extension = ?4,
                 file_size = ?5,
                 file_modified_at = ?6,
                 status = ?7
             WHERE id = ?8",
            params![
                name,
                storage_file_path,
                file_name,
                file_extension,
                file_size,
                datetime_utils::format_datetime(file_modified_at),
                original_status.clone(),
                score_id,
            ],
        )?;

        let song_id: String = conn.query_row(
            "SELECT song_id FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        )?;

        conn.execute(
            "UPDATE songs
             SET path = ?1,
                 last_score_file_modified_at = CASE
                   WHEN last_score_file_modified_at > ?2 THEN last_score_file_modified_at
                   ELSE ?2
                 END
                         WHERE id = ?3",
            params![storage_file_path, file_modified_at_ts, song_id],
        )?;

        if original_name != name {
            Self::insert_changed_field(
                &conn,
                "update",
                "scores",
                score_id,
                Some("name"),
                name_change_value,
            )?;
        }

        if file_changed {
            Self::insert_changed_field(&conn, "update", "scores", score_id, Some("file"), None)?;

            let old_extension = Self::extract_file_extension(&original_file_name);
            let new_extension = Self::extract_file_extension(file_name);
            if old_extension != new_extension {
                Self::insert_changed_field(
                    &conn,
                    "update",
                    "scores",
                    score_id,
                    Some("extension"),
                    new_extension.or(old_extension),
                )?;
            }

            let affected = conn.execute(
                "UPDATE songsBackup
                 SET status = 'processing'
                 WHERE songId = ?1",
                params![song_id],
            )?;

            if affected == 0 {
                conn.execute(
                    "INSERT INTO songsBackup (songId, status)
                     VALUES (?1, 'processing')",
                    params![song_id],
                )?;
            }
        }

        Ok(())
    }

    pub fn delete_score(&self, score_id: &str) -> Result<(), AppError> {
        let conn = self.lock_conn();

        let (song_id, file_name): (String, String) = conn
            .query_row(
                "SELECT song_id, file_name FROM scores WHERE id = ?1",
                params![score_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .map_err(|e| crate::infrastructure::database::to_not_found(AppError::ScoreNotFound(score_id.to_string()))(e))?;

        let affected = conn.execute("DELETE FROM scores WHERE id = ?1", params![score_id])?;
        if affected == 0 {
            return Err(AppError::ScoreNotFound(score_id.to_string()));
        }

        Self::insert_changed_field(
            &conn,
            "delete",
            "scores",
            score_id,
            Some("file_name"),
            Some(file_name),
        )?;

        Self::sync_song_status_from_scores(&conn, &song_id)?;

        conn.execute(
            "INSERT INTO songsBackup (songId, status)
             VALUES (?1, 'processing')
             ON CONFLICT(songId) DO UPDATE SET
                status = 'processing'",
            params![song_id],
        )?;

        Ok(())
    }

    pub fn get_score_file_path(&self, score_id: &str) -> Result<String, AppError> {
        let conn = self.lock_conn();
        conn.query_row(
            "SELECT s.file_path, s.file_name FROM scores s WHERE s.id = ?1",
            params![score_id],
            |row| {
                let dir_path: String = row.get(0)?;
                let file_name: String = row.get(1)?;
                Ok(Self::build_score_full_path(&dir_path, &file_name))
            },
        )
        .map_err(|e| crate::infrastructure::database::to_not_found(AppError::ScoreNotFound(score_id.to_string()))(e))
    }

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

    pub(crate) fn query_score_metadata_with_song_id(
        conn: &Connection,
        sql: &str,
        params: &[&dyn rusqlite::ToSql],
    ) -> Result<Vec<(String, String, String, String, Option<String>, u64, String, String)>, AppError> {
        let mut stmt = conn.prepare(sql)?;
        let scores = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                let dir_path: String = row.get(2)?;
                let file_name: String = row.get(3)?;
                let file_path = Self::build_score_full_path(&dir_path, &file_name);
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    file_path,
                    file_name,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, u64>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(scores)
    }

    #[allow(dead_code)]
    pub fn get_all_scores_with_metadata(
        &self,
    ) -> Result<Vec<(String, String, u64, String)>, AppError> {
        let conn = self.lock_conn();
        Self::query_score_metadata(
            &conn,
            "SELECT s.id, s.file_path, s.file_name, s.file_size, s.file_modified_at
             FROM scores s",
            &[],
        )
    }

    pub fn get_all_scores_with_metadata_by_host(
        &self,
        host_id: &str,
    ) -> Result<Vec<(String, String, String, String, Option<String>, u64, String, String)>, AppError> {
        let conn = self.lock_conn();
        Self::query_score_metadata_with_song_id(
            &conn,
            "SELECT s.song_id, s.id, s.file_path, s.file_name, s.name, s.file_size, s.file_modified_at, s.status
             FROM scores s
             WHERE s.host_id = ?1",
            &[&host_id as &dyn rusqlite::ToSql],
        )
    }

    pub fn update_score_status(
        &self,
        score_id: &str,
        status: ScoreStatus,
        _updated_by: &str,
        file_metadata: Option<(u64, chrono::NaiveDateTime)>,
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();

        let old_status = conn
            .query_row(
                "SELECT status FROM scores WHERE id = ?1",
                params![score_id],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| crate::infrastructure::database::to_not_found(AppError::ScoreNotFound(score_id.to_string()))(e))?;

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
                Some(old_status.clone()),
            )?;
        }

        if old_status != status.as_str() {
            conn.execute(
                "INSERT INTO songsBackup (songId, status)
                 VALUES (?1, 'processing')
                 ON CONFLICT(songId) DO UPDATE SET
                    status = 'processing'",
                params![song_id],
            )?;
        }

        Self::sync_song_status_from_scores(&conn, &song_id)?;

        Ok(())
    }

    pub fn get_song_id_for_score(&self, score_id: &str) -> Result<String, AppError> {
        let conn = self.lock_conn();
        conn.query_row(
            "SELECT song_id FROM scores WHERE id = ?1",
            params![score_id],
            |row| row.get(0),
        )
        .map_err(|e| crate::infrastructure::database::to_not_found(AppError::ScoreNotFound(score_id.to_string()))(e))
    }

    // ── Backup ──

    #[allow(dead_code)]
    pub fn mark_all_song_archives_for_regeneration(&self) -> Result<usize, AppError> {
        let conn = self.lock_conn();

        conn.execute(
            "INSERT OR IGNORE INTO songsBackup (songId, status)
             SELECT s.id, 'processing'
             FROM songs s",
            [],
        )
        .map_err(AppError::Database)?;

        conn.execute(
            "UPDATE songsBackup
             SET status = 'processing'
             WHERE songId IN (SELECT id FROM songs)",
            [],
        )
        .map_err(AppError::Database)
    }

    pub fn upsert_backup_song_status(
        &self,
        song_id: &str,
        status: &BackupStatus,
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let status_str = status.as_str();

        conn.execute(
            "INSERT INTO songsBackup (songId, status)
             VALUES (?1, ?2)
             ON CONFLICT(songId) DO UPDATE SET
             status = excluded.status",
            params![song_id, status_str],
        )?;
        Ok(())
    }

    pub fn update_backup_song_status(
        &self,
        song_id: &str,
        status: &BackupStatus,
    ) -> Result<(), AppError> {
        let conn = self.lock_conn();
        let status_str = status.as_str();

        conn.execute(
            "UPDATE songsBackup
             SET status = ?1
             WHERE songId = ?2",
            params![status_str, song_id],
        )?;
        Ok(())
    }

    pub fn get_backup_song_status(
        &self,
        song_id: &str,
    ) -> Result<Option<SongBackupStatus>, AppError> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare(
            "SELECT songId, status
             FROM songsBackup WHERE songId = ?1",
        )?;

        let result = stmt.query_row(params![song_id], |row| {
            Ok(SongBackupStatus {
                id: row.get(0)?,
                song_id: row.get(0)?,
                status: BackupStatus::from_str(&row.get::<_, String>(1)?),
                last_backup_at: None,
                error_message: None,
            })
        });

        match result {
            Ok(status) => Ok(Some(status)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    pub fn get_all_backup_songs_status(&self) -> Result<Vec<SongBackupStatus>, AppError> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare(
            "SELECT songId, status
               FROM songsBackup ORDER BY songId ASC",
        )?;

        let results = stmt.query_map([], |row| {
            Ok(SongBackupStatus {
                id: row.get(0)?,
                song_id: row.get(0)?,
                status: BackupStatus::from_str(&row.get::<_, String>(1)?),
                last_backup_at: None,
                error_message: None,
            })
        })?;

        let backup_songs: Result<Vec<_>, _> = results.collect();
        Ok(backup_songs?)
    }

    pub fn get_backup_songs_by_status(
        &self,
        status: &BackupStatus,
    ) -> Result<Vec<SongBackupStatus>, AppError> {
        let conn = self.lock_conn();
        let status_str = status.as_str();
        let mut stmt = conn.prepare(
            "SELECT songId, status
               FROM songsBackup WHERE status = ?1 ORDER BY songId ASC",
        )?;

        let results = stmt.query_map(params![status_str], |row| {
            Ok(SongBackupStatus {
                id: row.get(0)?,
                song_id: row.get(0)?,
                status: BackupStatus::from_str(&row.get::<_, String>(1)?),
                last_backup_at: None,
                error_message: None,
            })
        })?;

        let backup_songs: Result<Vec<_>, _> = results.collect();
        Ok(backup_songs?)
    }

    pub fn delete_backup_song_status(&self, song_id: &str) -> Result<(), AppError> {
        let conn = self.lock_conn();
        conn.execute(
            "DELETE FROM songsBackup WHERE songId = ?1",
            params![song_id],
        )?;
        Ok(())
    }

    pub fn clear_backup_errors(&self) -> Result<(), AppError> {
        let conn = self.lock_conn();
        conn.execute("DELETE FROM songsBackup WHERE status = 'error'", [])?;
        Ok(())
    }

    pub fn compress_zstd(data: &[u8]) -> Result<Vec<u8>, AppError> {
        zstd::encode_all(data, 3)
            .map_err(|e| AppError::Generic(format!("Erro ao comprimir com zstd: {}", e)))
    }
}
