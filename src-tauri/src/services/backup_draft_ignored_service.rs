use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use tracing::{info, warn};

use crate::commands::rclone_commands::sync_cloud_directory_with_rclone_impl;
use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::{
    ensure_draft_ignored_backup_dir, CLOUD_BACKUP_DRAFT_IGNORED_DIR_NAME,
};
use crate::services::path_normalizer::from_storage_path;

const BACKUP_DRAFT_IGNORED_RELATIVE_PATH: &str = CLOUD_BACKUP_DRAFT_IGNORED_DIR_NAME;

pub fn backup_draft_ignored_scores(
    db: &Database,
    store: &SystemStore,
) -> Result<usize, AppError> {
    let has_rclone = store
        .get_app_settings()
        .ok()
        .and_then(|s| s.rclone_config)
        .is_some();

    if has_rclone {
        if let Err(err) = sync_cloud_directory_with_rclone_impl(
            store,
            "download",
            Some(BACKUP_DRAFT_IGNORED_RELATIVE_PATH),
        ) {
            warn!(
                "Nao foi possivel baixar backups draft/ignored existentes (primeira vez?): {}",
                err
            );
        }
    }

    let backup_dir = ensure_draft_ignored_backup_dir(store.app_data_dir())?;

    let backed_up = backup_draft_ignored_scores_to_dir(db, &backup_dir)?;

    if has_rclone && backed_up > 0 {
        sync_cloud_directory_with_rclone_impl(
            store,
            "upload",
            Some(BACKUP_DRAFT_IGNORED_RELATIVE_PATH),
        )?;
    }

    Ok(backed_up)
}

pub fn restore_draft_ignored_scores_from_backup(
    db: &Database,
    store: &SystemStore,
) -> Result<usize, AppError> {
    if let Err(err) = sync_cloud_directory_with_rclone_impl(
        store,
        "download",
        Some(BACKUP_DRAFT_IGNORED_RELATIVE_PATH),
    ) {
        warn!(
            "Nao foi possivel baixar backups draft/ignored da nuvem: {}",
            err
        );
        return Ok(0);
    }

    let backup_dir = ensure_draft_ignored_backup_dir(store.app_data_dir())?;

    restore_draft_ignored_scores_from_dir(db, &backup_dir)
}

pub fn remove_backup_file_for_draft_ignored_score(
    store: &SystemStore,
    score_id: &str,
    file_extension: &str,
) -> Result<(), AppError> {
    let backup_dir = ensure_draft_ignored_backup_dir(store.app_data_dir())?;
    let file_path = backup_dir.join(format!("{}.{}", score_id, file_extension));

    if file_path.is_file() {
        fs::remove_file(&file_path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao remover arquivo draft/ignored do backup {}: {}",
                file_path.display(),
                e
            ))
        })?;
        info!(
            "Arquivo draft/ignored removido do backup_scores_draft_ignored: {}",
            file_path.display()
        );
    }

    Ok(())
}

fn restore_draft_ignored_scores_from_dir(
    db: &Database,
    backup_dir: &Path,
) -> Result<usize, AppError> {
    let scores = query_draft_ignored_scores(db)?;

    let mut restored = 0usize;

    for score in &scores {
        let dest_path = build_source_path(&score.file_path, &score.file_name);
        let source_name = format!("{}.{}", score.id, score.extension);
        let source_path = backup_dir.join(&source_name);

        if !source_path.is_file() {
            continue;
        }

        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                AppError::Generic(format!(
                    "Erro ao criar diretorio para restaurar partitura draft/ignored {}: {}",
                    dest_path.display(),
                    e
                ))
            })?;
        }

        fs::copy(&source_path, &dest_path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao restaurar partitura draft/ignored {} -> {}: {}",
                source_path.display(),
                dest_path.display(),
                e
            ))
        })?;

        restored += 1;
        info!(
            "Partitura draft/ignored restaurada: {} -> {}",
            score.id,
            dest_path.display()
        );
    }

    Ok(restored)
}

fn backup_draft_ignored_scores_to_dir(
    db: &Database,
    backup_dir: &Path,
) -> Result<usize, AppError> {
    let scores = query_draft_ignored_scores(db)?;

    let active_ids: HashSet<String> = scores.iter().map(|s| s.id.clone()).collect();

    let mut backed_up = 0usize;

    for score in &scores {
        let source_path = build_source_path(&score.file_path, &score.file_name);
        let dest_name = format!("{}.{}", score.id, score.extension);
        let dest_path = backup_dir.join(&dest_name);

        if !source_path.is_file() {
            warn!(
                "Arquivo de partitura draft/ignored nao encontrado: {}",
                source_path.display()
            );
            continue;
        }

        if needs_update(&source_path, &dest_path) {
            fs::copy(&source_path, &dest_path).map_err(|e| {
                AppError::Generic(format!(
                    "Erro ao copiar partitura draft/ignored {} -> {}: {}",
                    source_path.display(),
                    dest_path.display(),
                    e
                ))
            })?;
            backed_up += 1;
            info!(
                "Partitura draft/ignored copiada: {} -> {}",
                score.id,
                dest_path.display()
            );
        }
    }

    let removed = cleanup_orphan_draft_ignored_files(backup_dir, &active_ids)?;
    if removed > 0 {
        info!(
            "Limpeza de arquivos draft/ignored orfaos: {} removido(s)",
            removed
        );
    }

    Ok(backed_up)
}

#[derive(Debug, Clone)]
struct DraftIgnoredScore {
    id: String,
    file_path: String,
    file_name: String,
    extension: String,
}

fn query_draft_ignored_scores(db: &Database) -> Result<Vec<DraftIgnoredScore>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, file_extension
         FROM scores
         WHERE status IN ('draft', 'ignored')
         ORDER BY id",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(DraftIgnoredScore {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            extension: row.get::<_, String>(3)?.to_ascii_lowercase(),
        })
    })?;

    let result: Result<Vec<_>, _> = rows.collect();
    Ok(result?)
}

fn build_source_path(file_path: &str, file_name: &str) -> PathBuf {
    let expanded_dir = from_storage_path(file_path);
    PathBuf::from(&expanded_dir).join(file_name)
}

fn needs_update(source: &Path, dest: &Path) -> bool {
    if !dest.is_file() {
        return true;
    }

    let source_modified = match fs::metadata(source)
        .ok()
        .and_then(|m| m.modified().ok())
    {
        Some(time) => time,
        None => return true,
    };

    let dest_modified = match fs::metadata(dest)
        .ok()
        .and_then(|m| m.modified().ok())
    {
        Some(time) => time,
        None => return true,
    };

    source_modified > dest_modified
}

fn cleanup_orphan_draft_ignored_files(
    backup_dir: &Path,
    active_ids: &HashSet<String>,
) -> Result<usize, AppError> {
    let mut removed = 0usize;

    if !backup_dir.is_dir() {
        return Ok(0);
    }

    for entry in fs::read_dir(backup_dir).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao ler diretorio backup_scores_draft_ignored: {}",
            e
        ))
    })? {
        let entry = entry.map_err(|e| {
            AppError::Generic(format!(
                "Erro ao ler entrada de backup_scores_draft_ignored: {}",
                e
            ))
        })?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        let score_id = match extract_score_id_from_backup_file(file_name) {
            Some(id) => id,
            None => continue,
        };

        if active_ids.contains(score_id) {
            continue;
        }

        fs::remove_file(&path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao remover arquivo orfao draft/ignored {}: {}",
                path.display(),
                e
            ))
        })?;
        removed += 1;
    }

    Ok(removed)
}

fn extract_score_id_from_backup_file(file_name: &str) -> Option<&str> {
    let stem = Path::new(file_name).file_stem()?.to_str()?;
    if stem.is_empty() {
        return None;
    }
    Some(stem)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use crate::domain::models::{Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::backup_draft_ignored_scores_to_dir;
    use super::restore_draft_ignored_scores_from_dir;

    fn setup_test_db_and_dir(
        temp: &tempfile::TempDir,
    ) -> Result<(Database, SystemStore, std::path::PathBuf), Box<dyn std::error::Error>> {
        let store = SystemStore::new(temp.path().to_path_buf());
        let db = Database::new(&store.app_data_dir().join("test.db"))?;

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-test".to_string(),
            computer_type: crate::domain::models::ComputerType::Server,
            first_run_completed: true,
            ..Default::default()
        };
        store.save_app_settings(&settings)?;

        let backup_dir = temp
            .path()
            .join("cloud")
            .join("backup_scores_draft_ignored");
        fs::create_dir_all(&backup_dir)?;

        Ok((db, store, backup_dir))
    }

    #[test]
    fn backs_up_draft_and_ignored_scores() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let song_dir = temp.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let draft_file = song_dir.join("draft-score.musx");
        let ignored_file = song_dir.join("ignored-score.musx");
        fs::write(&draft_file, b"draft").expect("write draft");
        fs::write(&ignored_file, b"ignored").expect("write ignored");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Draft,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let now = chrono::Local::now().naive_local();
        db.insert_score(&Score {
            id: "score-draft".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "draft-score.musx".to_string(),
            file_size: 5,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Draft,
            updated_by: "server-test".to_string(),
        })
        .expect("insert draft score");

        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "ignored-score.musx".to_string(),
            file_size: 7,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Ignored,
            updated_by: "server-test".to_string(),
        })
        .expect("insert ignored score");

        let backed_up =
            backup_draft_ignored_scores_to_dir(&db, &backup_dir).expect("backup scores");

        assert_eq!(backed_up, 2);
        assert!(backup_dir.join("score-draft.musx").is_file());
        assert!(backup_dir.join("score-ignored.musx").is_file());
    }

    #[test]
    fn skips_when_no_draft_or_ignored_scores() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let backed_up =
            backup_draft_ignored_scores_to_dir(&db, &backup_dir).expect("backup scores");
        assert_eq!(backed_up, 0);
    }

    #[test]
    fn skips_when_source_file_missing() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let song_dir = temp.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Draft,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let now = chrono::Local::now().naive_local();
        db.insert_score(&Score {
            id: "score-missing".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "nao-existe.musx".to_string(),
            file_size: 0,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Draft,
            updated_by: "server-test".to_string(),
        })
        .expect("insert score");

        let backed_up =
            backup_draft_ignored_scores_to_dir(&db, &backup_dir).expect("backup scores");
        assert_eq!(backed_up, 0);
    }

    #[test]
    fn skips_when_dest_file_is_up_to_date() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let song_dir = temp.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let source_file = song_dir.join("score.musx");
        fs::write(&source_file, b"score").expect("write score");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Draft,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let now = chrono::Local::now().naive_local();
        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "score.musx".to_string(),
            file_size: 5,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Draft,
            updated_by: "server-test".to_string(),
        })
        .expect("insert score");

        fs::write(backup_dir.join("score-1.musx"), b"score").expect("create dest file");

        let backed_up =
            backup_draft_ignored_scores_to_dir(&db, &backup_dir).expect("backup scores");
        assert_eq!(backed_up, 0);
    }

    #[test]
    fn cleans_up_orphan_files() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        fs::write(backup_dir.join("orphan-id.musx"), b"orphan").expect("create orphan file");

        let backed_up =
            backup_draft_ignored_scores_to_dir(&db, &backup_dir).expect("backup scores");
        assert_eq!(backed_up, 0);
        assert!(!backup_dir.join("orphan-id.musx").exists());
    }

    #[test]
    fn restores_draft_and_ignored_scores_from_backup_dir() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let song_dir = temp.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        fs::write(backup_dir.join("score-draft.musx"), b"draft").expect("create draft backup");
        fs::write(backup_dir.join("score-ignored.musx"), b"ignored").expect("create ignored backup");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Draft,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let now = chrono::Local::now().naive_local();
        db.insert_score(&Score {
            id: "score-draft".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "draft-score.musx".to_string(),
            file_size: 5,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Draft,
            updated_by: "server-test".to_string(),
        })
        .expect("insert draft score");

        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "ignored-score.musx".to_string(),
            file_size: 7,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Ignored,
            updated_by: "server-test".to_string(),
        })
        .expect("insert ignored score");

        let restored =
            restore_draft_ignored_scores_from_dir(&db, &backup_dir).expect("restore scores");

        assert_eq!(restored, 2);
        assert_eq!(
            fs::read(song_dir.join("draft-score.musx")).expect("read draft"),
            b"draft"
        );
        assert_eq!(
            fs::read(song_dir.join("ignored-score.musx")).expect("read ignored"),
            b"ignored"
        );
    }

    #[test]
    fn restore_skips_when_backup_file_missing() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let song_dir = temp.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Draft,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let now = chrono::Local::now().naive_local();
        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "score.musx".to_string(),
            file_size: 5,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Draft,
            updated_by: "server-test".to_string(),
        })
        .expect("insert score");

        let restored =
            restore_draft_ignored_scores_from_dir(&db, &backup_dir).expect("restore scores");

        assert_eq!(restored, 0);
    }

    #[test]
    fn restore_overwrites_existing_file() {
        let temp = tempdir().expect("temp dir");
        let (db, _store, backup_dir) = setup_test_db_and_dir(&temp).expect("setup");

        let song_dir = temp.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let existing_file = song_dir.join("score.musx");
        fs::write(&existing_file, b"old content").expect("write existing file");
        fs::write(backup_dir.join("score-1.musx"), b"new content").expect("create backup file");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Draft,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let now = chrono::Local::now().naive_local();
        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-test".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "score.musx".to_string(),
            file_size: 11,
            file_modified_at: now,
            updated_at: now,
            status: ScoreStatus::Draft,
            updated_by: "server-test".to_string(),
        })
        .expect("insert score");

        let restored =
            restore_draft_ignored_scores_from_dir(&db, &backup_dir).expect("restore scores");

        assert_eq!(restored, 1);
        assert_eq!(
            fs::read(existing_file).expect("read file"),
            b"new content"
        );
    }
}
