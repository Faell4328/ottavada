use std::collections::HashMap;
use std::path::Path;
use tracing::{info, warn};

use crate::domain::models::{Score, ScoreStatus};
use crate::infrastructure::database::Database;
use crate::services::indexer::{
    get_file_metadata, paths_match, scan_directory, split_file_path, FileChangeDetector,
};
use crate::services::path_normalizer::from_storage_path;

#[derive(Debug, Clone)]
struct ScoreMetadataEntry {
    score_id: String,
    file_path: String,
    file_name: String,
    score_name: Option<String>,
    stored_size: u64,
    stored_modified_at_str: String,
    status: ScoreStatus,
}

/// Runs the initial check for changes in score files
pub fn run_initial_scan(db: &Database, updated_by: &str) {
    info!("Running initial change check");

    let scores = match db.get_all_scores_for_scan() {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Error fetching scores for initial check: {:?}", e);
            return;
        }
    };

    let mut changed_count = 0;
    let mut added_count = 0;
    let mut deleted_count = 0;
    let mut recovered_count = 0;

    let mut scores_by_song: HashMap<String, Vec<ScoreMetadataEntry>> = HashMap::new();
    for (
        song_id,
        score_id,
        file_path,
        file_name,
        score_name,
        stored_size,
        stored_modified_at_str,
        status,
    ) in scores
    {
        scores_by_song
            .entry(song_id)
            .or_default()
            .push(ScoreMetadataEntry {
                score_id,
                file_path,
                file_name,
                score_name,
                stored_size,
                stored_modified_at_str,
                status: ScoreStatus::from_str(&status),
            });
    }

    info!("Total songs to check: {}", scores_by_song.len());

    for (song_id, song_scores) in scores_by_song {
        if song_scores.is_empty() {
            continue;
        }
        let Some(reference_score) = song_scores
            .iter()
            .find(|score| score.status != ScoreStatus::Ignored)
        else {
            continue;
        };

        let scanable_scores: Vec<&ScoreMetadataEntry> = song_scores
            .iter()
            .filter(|score| score.status == ScoreStatus::Main)
            .collect();

        let song_directory =
            match score_directory(&reference_score.file_path, &reference_score.file_name) {
                Some(directory) => directory,
                None => continue,
            };

        let current_files = scan_directory(Path::new(&song_directory));

        for score in &scanable_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                deleted_count += 1;
                info!("✓ File not found: {}", full_path);
                continue;
            }

            if let Ok((current_size, current_modified_at)) = get_file_metadata(path) {
                let stored_modified_at = parse_stored_modified_at(&score.stored_modified_at_str);

                let detector = FileChangeDetector::new(
                    current_size,
                    current_modified_at,
                    score.stored_size,
                    stored_modified_at,
                );

                if detector.has_changed() {
                    if db
                        .update_score_status(
                            &score.score_id,
                            ScoreStatus::Draft,
                            updated_by,
                            Some((current_size, current_modified_at)),
                        )
                        .is_ok()
                    {
                        changed_count += 1;
                        info!("✓ Status updated to draft: {}", full_path);
                    }
                }
            }
        }

        for score in song_scores
            .iter()
            .filter(|s| s.status == ScoreStatus::Draft)
        {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                continue;
            }

            if let Ok((current_size, current_modified_at)) = get_file_metadata(path) {
                let new_status = resolve_recovered_score_status(
                    db,
                    &score.score_id,
                    current_size,
                    current_modified_at,
                    score.stored_size,
                    &score.stored_modified_at_str,
                );

                if db
                    .update_score_status(
                        &score.score_id,
                        new_status,
                        updated_by,
                        Some((current_size, current_modified_at)),
                    )
                    .is_ok()
                {
                    recovered_count += 1;
                    info!("✓ Score recovered: {}", full_path);
                }
            }
        }

        for current_file in current_files {
            let current_path = &current_file.path;
            if song_scores.iter().any(|score| {
                let score_full_path = build_score_full_path(&score.file_path, &score.file_name);
                paths_match(&score_full_path, current_path)
            }) {
                continue;
            }

            match get_file_metadata(Path::new(current_path)) {
                Ok((file_size, file_modified_at)) => {
                    let (file_path, file_name) = split_file_path(current_path);
                    let score = Score::new_from_file(
                        song_id.clone(),
                        &current_file,
                        file_path,
                        file_name,
                        (file_size, file_modified_at),
                    );

                    if db.insert_score(&score).is_ok() {
                        added_count += 1;
                        info!("✓ New file indexed: {}", current_path);
                    } else {
                        warn!("Error indexing new file: {}", current_path);
                    }
                }
                Err(e) => {
                    warn!(
                        "Error getting metadata for new file {}: {:?}",
                        current_path, e
                    );
                }
            }
        }
    }

    info!(
        "Initial check completed: {} changes, {} added, {} deleted, {} recovered",
        changed_count, added_count, deleted_count, recovered_count
    );
}

fn build_score_full_path(file_path: &str, file_name: &str) -> String {
    let expanded_file_path = from_storage_path(file_path);
    let base_path = Path::new(&expanded_file_path);
    let legacy_full_path = base_path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case(file_name))
        .unwrap_or(false);

    if legacy_full_path {
        expanded_file_path
    } else {
        base_path.join(file_name).to_string_lossy().to_string()
    }
}

fn score_directory(file_path: &str, file_name: &str) -> Option<String> {
    let full_path = build_score_full_path(file_path, file_name);
    Path::new(&full_path)
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
}

fn parse_stored_modified_at(stored_modified_at_str: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(stored_modified_at_str, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

fn resolve_recovered_score_status(
    _db: &Database,
    _score_id: &str,
    current_size: u64,
    current_modified_at: chrono::NaiveDateTime,
    stored_size: u64,
    stored_modified_at_str: &str,
) -> ScoreStatus {
    let stored_modified_at = parse_stored_modified_at(stored_modified_at_str);
    if current_size == stored_size && current_modified_at == stored_modified_at {
        ScoreStatus::Main
    } else {
        ScoreStatus::Draft
    }
}

#[cfg(test)]
mod tests {
    use super::run_initial_scan;
    use crate::domain::models::{Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use chrono::Local;
    use rusqlite::params;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn does_not_recheck_draft_scores_after_they_change_again() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        let song_dir = dir.path().join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        let score_path = song_dir.join("score-1.musx");
        fs::write(&score_path, b"main-v1").expect("write score v1");

        let metadata_v1 = super::get_file_metadata(&score_path).expect("metadata v1");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "score-1.musx".to_string(),
            file_size: metadata_v1.0,
            file_modified_at: metadata_v1.1,
            status: ScoreStatus::Main,
        })
        .expect("insert score");

        fs::write(&score_path, b"main-v2").expect("write score v2");
        run_initial_scan(&db, "server-1");

        let first_scan_size: i64 = db
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT file_size FROM scores WHERE id = ?1",
                params!["score-1"],
                |row| row.get(0),
            )
            .expect("first scan size");

        let after_first_scan = db
            .get_song_list_item_by_id("song-1")
            .expect("song after first scan");
        assert_eq!(after_first_scan.scores[0].status, ScoreStatus::Main);

        fs::write(&score_path, b"main-v3-changed-again").expect("write score v3");
        run_initial_scan(&db, "server-1");

        let after_second_scan = db
            .get_song_list_item_by_id("song-1")
            .expect("song after second scan");

        assert_eq!(after_second_scan.scores[0].status, ScoreStatus::Draft);
        let second_scan_size: i64 = db
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT file_size FROM scores WHERE id = ?1",
                params!["score-1"],
                |row| row.get(0),
            )
            .expect("second scan size");
    }
}
