use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;
use tauri::State;
use tracing::{info, warn};

use crate::commands::common::run_blocking_with_store;
use crate::commands::scan_report::build_report_items;
use crate::commands::scan_report::build_score_change_report_item;
use crate::domain::errors::AppError;
use crate::domain::models::{OperationGuard, Score, ScoreStatus};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
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

/// Checks for changes in score files.
/// Changed files move to draft and missing files only appear in the report.
#[tauri::command]
pub async fn scan_files_for_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    apply_missing_deletions: Option<bool>,
) -> Result<ScanResult, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();
    let apply_missing_deletions = apply_missing_deletions.unwrap_or(false);

    run_blocking_with_store(
        app_data_dir,
        "Internal failure checking for changes",
        move |store| scan_files_for_changes_impl(&db, &store, apply_missing_deletions),
    )
    .await
}

#[tauri::command]
pub async fn preview_scan_files_for_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<ScanResult, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Internal failure checking for changes",
        move |store| preview_scan_files_for_changes_impl(&db, &store),
    )
    .await
}

fn scan_files_for_changes_impl(
    db: &Database,
    store: &SystemStore,
    apply_missing_deletions: bool,
) -> Result<ScanResult, AppError> {
    info!("Starting score file change check");

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let updated_by = settings.computer_id.clone();

    let scores = db.get_all_scores_for_scan()?;
    let songs = db.get_all_songs()?;
    let mut changed_files = Vec::new();
    let mut added_files = Vec::new();
    let mut deleted_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

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

    for song in &songs {
        let Some(song_scores) = scores_by_song.get(&song.id) else {
            if song.status != ScoreStatus::NotFound {
                continue;
            }

            let expanded_song_path = from_storage_path(&song.path);
            let current_files = scan_directory(Path::new(&expanded_song_path));

            for current_file in current_files {
                let current_path = &current_file.path;

                match get_file_metadata(Path::new(current_path)) {
                    Ok((file_size, file_modified_at)) => {
                        let (file_path, file_name) = split_file_path(current_path);
                        let score = Score::new_from_file(
                            song.id.clone(),
                            updated_by.clone(),
                            &current_file,
                            file_path,
                            file_name,
                            (file_size, file_modified_at),
                        );

                        match db.insert_score(&score) {
                            Ok(()) => {
                                info!("New file indexed: {}", current_path);
                                added_files.push(build_score_change_report_item(
                                    &song.name,
                                    &None,
                                    current_path,
                                ));
                            }
                            Err(e) => {
                                warn!("Error inserting new file {}: {:?}", current_path, e);
                                failed_files.push((
                                    current_path.clone(),
                                    format!("Error indexing new file: {:?}", e),
                                ));
                            }
                        }
                    }
                    Err(e) => {
                        warn!(
                            "Error getting metadata for new file {}: {:?}",
                            current_path, e
                        );
                        failed_files.push((current_path.clone(), format!("Error reading: {}", e)));
                    }
                }
            }

            continue;
        };

        let Some(_reference_score) = song_scores
            .iter()
            .find(|score| score.status != ScoreStatus::Ignored)
        else {
            continue;
        };

        let scanable_scores: Vec<&ScoreMetadataEntry> = song_scores
            .iter()
            .filter(|score| score.status == ScoreStatus::Main)
            .collect();

        let expanded_song_path = from_storage_path(&song.path);
        let current_files = scan_directory(Path::new(&expanded_song_path));

        for score in &scanable_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                warn!("File not found: {}", full_path);
                if apply_missing_deletions {
                    if let Err(e) = db.delete_score(&score.score_id) {
                        warn!("Error removing missing score from database: {:?}", e);
                        failed_files.push((
                            full_path.clone(),
                            format!("Error removing from database: {:?}", e),
                        ));
                    }
                }
                deleted_files.push(build_score_change_report_item(
                    &song.name,
                    &score.score_name,
                    &full_path,
                ));
                continue;
            }

            match get_file_metadata(path) {
                Ok((current_size, current_modified_at)) => {
                    let stored_modified_at =
                        parse_stored_modified_at(&score.stored_modified_at_str);

                    let detector = FileChangeDetector::new(
                        current_size,
                        current_modified_at,
                        score.stored_size,
                        stored_modified_at,
                    );

                    if detector.has_changed() {
                        info!("Change detected in: {}", full_path);

                        if let Err(e) = db.update_score_status(
                            &score.score_id,
                            ScoreStatus::Draft,
                            &updated_by,
                            Some((current_size, current_modified_at)),
                        ) {
                            warn!("Error updating status to draft: {:?}", e);
                            failed_files
                                .push((full_path.clone(), format!("Error updating: {:?}", e)));
                        } else {
                            changed_files.push(build_score_change_report_item(
                                &song.name,
                                &score.score_name,
                                &full_path,
                            ));
                        }
                    }
                }
                Err(e) => {
                    warn!("Error getting file metadata {}: {:?}", full_path, e);
                    failed_files.push((full_path, format!("Error reading: {}", e)));
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
                            song.id.clone(),
                        updated_by.clone(),
                        &current_file,
                        file_path,
                        file_name,
                        (file_size, file_modified_at),
                    );

                    match db.insert_score(&score) {
                        Ok(()) => {
                            info!("New file indexed: {}", current_path);
                            added_files.push(build_score_change_report_item(
                                &song.name,
                                &None,
                                current_path,
                            ));
                        }
                        Err(e) => {
                            warn!("Error inserting new file {}: {:?}", current_path, e);
                            failed_files.push((
                                current_path.clone(),
                                format!("Error indexing new file: {:?}", e),
                            ));
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        "Error getting metadata for new file {}: {:?}",
                        current_path, e
                    );
                    failed_files.push((current_path.clone(), format!("Error reading: {}", e)));
                }
            }
        }
    }

    info!(
        "Check completed. {} changed, {} added, {} not found, {} recovered, {} errors",
        changed_files.len(),
        added_files.len(),
        deleted_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    let changed_fields = db.get_changed_fields_ordered()?;
    let report_items = build_report_items(
        &db,
        &changed_files,
        &added_files,
        &deleted_files,
        &recovered_files,
        &failed_files,
        &changed_fields,
    );

    Ok(ScanResult {
        changed_files,
        added_files,
        deleted_files,
        recovered_files,
        failed_files,
        report_items,
        database_changes_count: db.get_pending_changes_count()?,
    })
}

fn preview_scan_files_for_changes_impl(
    db: &Database,
    store: &SystemStore,
) -> Result<ScanResult, AppError> {
    info!("Starting score file change preview");

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let updated_by = settings.computer_id.clone();

    let scores = db.get_all_scores_for_scan()?;
    let songs = db.get_all_songs()?;
    let mut changed_files = Vec::new();
    let mut added_files = Vec::new();
    let mut deleted_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

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

    for song in &songs {
        let Some(song_scores) = scores_by_song.get(&song.id) else {
            if song.status != ScoreStatus::NotFound {
                continue;
            }

            let expanded_song_path = from_storage_path(&song.path);
            let current_files = scan_directory(Path::new(&expanded_song_path));

            for current_file in current_files {
                let current_path = &current_file.path;
                added_files.push(build_score_change_report_item(
                    &song.name,
                    &None,
                    current_path,
                ));
            }

            continue;
        };

        let Some(_reference_score) = song_scores
            .iter()
            .find(|score| score.status != ScoreStatus::Ignored)
        else {
            continue;
        };

        let scanable_scores: Vec<&ScoreMetadataEntry> = song_scores
            .iter()
            .filter(|score| score.status == ScoreStatus::Main)
            .collect();

        let expanded_song_path = from_storage_path(&song.path);
        let current_files = scan_directory(Path::new(&expanded_song_path));

        for score in &scanable_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                deleted_files.push(build_score_change_report_item(
                    &song.name,
                    &score.score_name,
                    &full_path,
                ));
                continue;
            }

            match get_file_metadata(path) {
                Ok((current_size, current_modified_at)) => {
                    let stored_modified_at =
                        parse_stored_modified_at(&score.stored_modified_at_str);
                    let detector = FileChangeDetector::new(
                        current_size,
                        current_modified_at,
                        score.stored_size,
                        stored_modified_at,
                    );

                    if detector.has_changed() {
                        if let Err(e) = db.update_score_status(
                            &score.score_id,
                            ScoreStatus::Draft,
                            &updated_by,
                            Some((current_size, current_modified_at)),
                        ) {
                            warn!("Error updating status to draft: {:?}", e);
                            failed_files
                                .push((full_path.clone(), format!("Error updating: {:?}", e)));
                        } else {
                            changed_files.push(build_score_change_report_item(
                                &song.name,
                                &score.score_name,
                                &full_path,
                            ));
                        }
                    }
                }
                Err(e) => {
                    warn!("Error getting file metadata {}: {:?}", full_path, e);
                    failed_files.push((full_path, format!("Error reading: {}", e)));
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

            added_files.push(build_score_change_report_item(
                &song.name,
                &None,
                current_path,
            ));
        }
    }

    info!(
        "Preview completed. {} changed, {} added, {} deleted, {} recovered, {} errors",
        changed_files.len(),
        added_files.len(),
        deleted_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    let changed_fields = db.get_changed_fields_ordered()?;
    let report_items = build_report_items(
        &db,
        &changed_files,
        &added_files,
        &deleted_files,
        &recovered_files,
        &failed_files,
        &changed_fields,
    );

    Ok(ScanResult {
        changed_files,
        added_files,
        deleted_files,
        recovered_files,
        failed_files,
        report_items,
        database_changes_count: db.get_pending_changes_count()?,
    })
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

fn parse_stored_modified_at(stored_modified_at_str: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(stored_modified_at_str, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ScanResult {
    pub changed_files: Vec<String>,
    pub added_files: Vec<String>,
    pub deleted_files: Vec<String>,
    pub recovered_files: Vec<String>,
    pub failed_files: Vec<(String, String)>,
    pub report_items: Vec<String>,
    pub database_changes_count: usize,
}

/// Performs a simple internet connectivity check using a TCP socket.
/// Does not depend on rclone: tries to connect to well-known public DNS servers.
#[tauri::command]
pub async fn has_internet_connection() -> Result<bool, AppError> {
    tauri::async_runtime::spawn_blocking(has_internet_connection_impl)
        .await
        .map_err(|e| AppError::Generic(format!("Internal failure checking internet: {}", e)))
}

fn has_internet_connection_impl() -> bool {
    let timeout = Duration::from_secs(2);
    let probes = ["1.1.1.1:53", "8.8.8.8:53", "9.9.9.9:53"];

    probes.iter().any(|addr| {
        addr.parse::<std::net::SocketAddr>()
            .ok()
            .and_then(|socket| std::net::TcpStream::connect_timeout(&socket, timeout).ok())
            .is_some()
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::tempdir;

    use super::scan_files_for_changes_impl;
    use crate::commands::scan_report::build_report_items;
    use crate::commands::scan_report::describe_score_change;
    use crate::domain::models::{AppSettings, ComputerType, Score, ScoreStatus, Song};
    use crate::infrastructure::database::ChangedFieldRecord;
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;
    use crate::services::indexer::get_file_metadata;

    fn now() -> chrono::NaiveDateTime {
        chrono::Local::now().naive_local()
    }

    #[test]
    fn recovers_deleted_back_to_draft_when_previous_status_was_draft() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let score_dir = dir.path().join("scores");
        fs::create_dir_all(&score_dir).expect("create score dir");
        let score_path = score_dir.join("score-1.musx");
        fs::write(&score_path, b"draft-version").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");
        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("flute".to_string()),
            file_path: score_dir.to_string_lossy().to_string(),
            file_name: "score-1.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        db.update_score_status(
            "score-1",
            ScoreStatus::Draft,
            "server-1",
            Some((file_size, file_modified_at)),
        )
        .expect("set draft");

        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");
        let updated_song = db.get_song_list_item_by_id("song-1").expect("updated song");

        assert_eq!(updated_song.scores[0].status, ScoreStatus::Draft);
        assert!(result.recovered_files.is_empty());
    }

    #[test]
    fn ignores_scores_marked_as_ignored_during_scan() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let score_dir = dir.path().join("scores");
        fs::create_dir_all(&score_dir).expect("create score dir");
        let score_path = score_dir.join("score-ignored.musx");
        fs::write(&score_path, b"ignored-version").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");
        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: Some("flute".to_string()),
            file_path: score_dir.to_string_lossy().to_string(),
            file_name: "score-ignored.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Ignored,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let store = SystemStore::new(dir.path().to_path_buf());
        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");

        assert!(result.changed_files.is_empty());
        assert!(result.added_files.is_empty());
        assert!(result.deleted_files.is_empty());
    }

    #[test]
    fn reports_changed_scores_using_the_stored_score_name() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        let score_path = song_dir.join("126.mus");
        fs::write(&score_path, b"score-v1").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");
        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Blessed is the believer".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Score".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "126.mus".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        fs::write(&score_path, b"score-v2-modified").expect("modify score");

        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");

        assert_eq!(result.changed_files.len(), 1);
        assert_eq!(
            result.changed_files[0],
            "Score.mus in the song Blessed is the believer"
        );
    }

    #[test]
    fn indexes_valid_files_for_not_found_songs_during_scan() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        fs::write(song_dir.join("Canon.pdf"), b"pdf-data").expect("write score");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::NotFound,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");
        let scores = db.get_scores_for_song("song-1").expect("scores");
        let updated_song = db.get_song_list_item_by_id("song-1").expect("song");

        assert_eq!(result.added_files.len(), 1);
        assert!(result.added_files[0].contains("Canon.pdf"));
        assert!(result.added_files[0].contains("CANON"));
        assert_eq!(scores.len(), 1);
        assert_eq!(updated_song.status, ScoreStatus::Main);
    }

    #[test]
    fn deletes_missing_scores_when_apply_missing_deletions_is_enabled() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let score_path = song_dir.join("Canon - Trumpet.musx");
        fs::write(&score_path, b"score").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Trumpet".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "Canon - Trumpet.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        fs::remove_file(&score_path).expect("remove score file");

        let result = scan_files_for_changes_impl(&db, &store, true).expect("scan");
        let scores = db.get_scores_for_song("song-1").expect("scores");

        assert_eq!(result.deleted_files.len(), 1);
        assert!(result.database_changes_count >= 1);
        assert_eq!(scores.len(), 0);
    }

    #[test]
    fn detects_removed_and_new_files_in_the_indexed_directory() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let main_score_path = song_dir.join("Canon - Flute.musx");
        let removed_score_path = song_dir.join("Canon - Trumpet.musx");
        let new_score_path = song_dir.join("Canon - Clarinet.musx");

        fs::write(&main_score_path, b"main-score").expect("write main score");
        fs::write(&removed_score_path, b"removed-score").expect("write removed score");

        let (main_file_size, main_file_modified_at) =
            get_file_metadata(&main_score_path).expect("main metadata");
        let (removed_file_size, removed_file_modified_at) =
            get_file_metadata(&removed_score_path).expect("removed metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "Canon - Flute.musx".to_string(),
            file_size: main_file_size,
            file_modified_at: main_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert main score");

        db.insert_score(&Score {
            id: "score-2".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Trumpet".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "Canon - Trumpet.musx".to_string(),
            file_size: removed_file_size,
            file_modified_at: removed_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert removed score");

        fs::remove_file(&removed_score_path).expect("remove score file");
        fs::write(&new_score_path, b"new-score").expect("write new score");

        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");
        let scores = db.get_scores_for_song("song-1").expect("scores");

        assert_eq!(result.deleted_files.len(), 1);
        assert_eq!(result.added_files.len(), 1);
        assert!(result.deleted_files[0].contains("Trumpet.musx"));
        assert!(result.deleted_files[0].contains("CANON"));
        assert!(result.added_files[0].contains("Clarinet.musx"));
        assert!(result.added_files[0].contains("CANON"));
        assert!(scores
            .iter()
            .any(|score| score.file_path.ends_with("Canon - Clarinet.musx")));
        assert!(scores
            .iter()
            .any(|score| score.file_path.ends_with("Canon - Trumpet.musx")
                && score.status == ScoreStatus::Main));
    }

    #[test]
    fn preview_scan_uses_song_directory_to_detect_new_and_removed_files() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("indexed").join("song-1");
        let legacy_score_dir = dir.path().join("legacy").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        fs::create_dir_all(&legacy_score_dir).expect("create legacy dir");

        let existing_score_path = legacy_score_dir.join("Canon - Flute.musx");
        fs::write(&existing_score_path, b"score").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&existing_score_path).expect("metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute".to_string()),
            file_path: legacy_score_dir.to_string_lossy().to_string(),
            file_name: "Canon - Flute.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        fs::remove_file(&existing_score_path).expect("remove old score file");
        fs::write(song_dir.join("Canon - Clarinet.musx"), b"new-score").expect("write new score");

        let result = super::preview_scan_files_for_changes_impl(&db, &store).expect("preview scan");

        assert_eq!(result.deleted_files.len(), 1);
        assert!(result.deleted_files[0].contains("Flute.musx"));
        assert!(result.deleted_files[0].contains("CANON"));
    }

    #[test]
    fn preview_scan_ignores_ignored_scores_when_listing_added_files() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let main_score_path = song_dir.join("08 H.C. CRISTO, O FIEL AMIGO - Flute.musx");
        let ignored_score_path = song_dir.join("08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx");

        fs::write(&main_score_path, b"main-score").expect("write main score");
        fs::write(&ignored_score_path, b"ignored-score").expect("write ignored score");

        let (main_file_size, main_file_modified_at) =
            get_file_metadata(&main_score_path).expect("main metadata");
        let (ignored_file_size, ignored_file_modified_at) =
            get_file_metadata(&ignored_score_path).expect("ignored metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-main".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute.musx".to_string(),
            file_size: main_file_size,
            file_modified_at: main_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert main score");

        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx".to_string(),
            file_size: ignored_file_size,
            file_modified_at: ignored_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Ignored,
            updated_by: "server-1".to_string(),
        })
        .expect("insert ignored score");

        let result = super::preview_scan_files_for_changes_impl(&db, &store).expect("preview scan");

        assert!(result.added_files.is_empty());
        assert!(result
            .report_items
            .iter()
            .all(|item| !item.contains("Flute2.musx")));
    }

    #[test]
    fn preview_scan_marks_changed_scores_as_draft() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Server".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        let score_path = song_dir.join("A BANDA - Flute.musx");
        fs::write(&score_path, b"updated-score").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "A BANDA".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "A BANDA - Flute.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        fs::write(&score_path, b"changed-version").expect("rewrite score");

        let result = super::preview_scan_files_for_changes_impl(&db, &store).expect("preview scan");
        let updated_song = db.get_song_list_item_by_id("song-1").expect("updated song");

        assert_eq!(updated_song.scores[0].status, ScoreStatus::Draft);
        assert!(result
            .changed_files
            .iter()
            .any(|item| item.contains("Flute") && item.contains("A BANDA")));
        assert!(result
            .report_items
            .iter()
            .any(|item| item.contains("went to draft")));

        fs::write(&score_path, b"changed-version-again").expect("rewrite score again");

        let second_result = super::preview_scan_files_for_changes_impl(&db, &store)
            .expect("second preview scan");

        assert!(second_result.changed_files.is_empty());
        assert!(second_result
            .report_items
            .iter()
            .all(|item| !item.contains("A BANDA - Flute.musx")));
    }

    #[test]
    fn build_report_items_includes_score_additions_for_new_songs_and_keeps_later_score_updates() {
        let db = Database::new_in_memory().expect("db");
        let song_dir = Path::new("/music/song-1").to_path_buf();

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "NEW HYMN".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "NEW HYMN - Flute.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        db.update_score_status(&"score-1".to_string(), ScoreStatus::Draft, "server-1", None)
            .expect("update score status");

        let added_files = vec![song_dir
            .join("NEW HYMN - Flute.musx")
            .to_string_lossy()
            .to_string()];
        let changed_fields = db.get_changed_fields_ordered().expect("changed fields");

        let report_items =
            build_report_items(&db, &[], &added_files, &[], &[], &[], &changed_fields);

        assert!(report_items
            .iter()
            .any(|item| item.contains("Song created: NEW HYMN")));
        assert!(report_items
            .iter()
            .any(|item| item.contains("went to draft")));
        assert!(report_items
            .iter()
            .any(|item| item.contains("Score added:")
                && item.contains("NEW HYMN - Flute.musx")));
    }

    #[test]
    fn describe_score_added_uses_no_instrument_when_file_matches_song_name() {
        let db = Database::new_in_memory().expect("db");
        let song_dir = Path::new("/music/song-1").to_path_buf();

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "03 HOLY TIMES".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "HOLY TIMES.MUS".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("name".to_string()),
            value: None,
            timestamp: 0,
        };

        let description = describe_score_change(&db, &change).expect("description");

        assert_eq!(
            description,
            "Score added: No Instrument.MUS in the song 03 HOLY TIMES."
        );
    }
}
