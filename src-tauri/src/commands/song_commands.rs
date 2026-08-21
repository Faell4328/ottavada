use serde::Serialize;
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

use crate::commands::common::regenerate_song_archives_for_song_ids;
use crate::commands::common::remove_path_if_exists;
use crate::commands::common::require_server_settings;
use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{self, get_file_metadata, paths_match};
use crate::services::name_formatter::{normalize_optional_score_name, normalize_song_name};
use crate::services::path_normalizer::from_storage_path;

fn normalized_required_song_name(name: &str) -> Result<String, AppError> {
    let normalized = normalize_song_name(name);
    if normalized.is_empty() {
        return Err(AppError::Generic("Song name cannot be empty".into()));
    }
    Ok(normalized)
}

fn normalized_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn normalized_optional_text_ref(value: Option<&str>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn normalized_required_song_path(path: &str) -> Result<String, AppError> {
    let normalized = path.trim().to_string();
    if normalized.is_empty() {
        return Err(AppError::Generic("Song path cannot be empty".into()));
    }
    Ok(normalized)
}

fn authors_match(existing: &Option<String>, incoming: Option<&str>) -> bool {
    let a = existing.as_deref().unwrap_or("").trim();
    let b = incoming.unwrap_or("").trim();
    a.eq_ignore_ascii_case(b)
}

fn ensure_unique_song_name(
    songs: &[SongListItem],
    song_name: &str,
    composer: Option<&str>,
    arranger: Option<&str>,
    except_song_id: Option<&str>,
) -> Result<(), AppError> {
    let composer_norm = composer.unwrap_or("").trim();
    let arranger_norm = arranger.unwrap_or("").trim();

    let has_conflict = songs.iter().any(|song| {
        let different_song = except_song_id.map(|id| song.id != id).unwrap_or(false);
        different_song
            && song.name.eq_ignore_ascii_case(song_name)
            && authors_match(&song.composer, Some(composer_norm))
            && authors_match(&song.arranger, Some(arranger_norm))
    });

    if has_conflict {
        return Err(AppError::Generic(
            "A song with this name, composer and arranger already exists".into(),
        ));
    }

    Ok(())
}

fn run_song_query_with_logging<F>(operation: &str, query: F) -> Result<Vec<SongListItem>, AppError>
where
    F: FnOnce() -> Result<Vec<SongListItem>, AppError>,
{
    match query() {
        Ok(songs) => {
            info!("{}: {} songs", operation, songs.len());
            Ok(songs)
        }
        Err(e) => {
            error!("{}: {:?}", operation, e);
            Err(e)
        }
    }
}

fn refresh_library_summary_cache(_db: &Database, _store: &SystemStore) -> Result<(), AppError> {
    Ok(())
}

fn delete_song_core(db: &Database, store: &SystemStore, song_id: &str) -> Result<(), AppError> {
    db.delete_song(song_id)?;
    let _ = refresh_library_summary_cache(db, store);

    let archive_path = store
        .app_data_dir()
        .join("cloud")
        .join("songs")
        .join(format!("{}.tar.zst", song_id));
    if archive_path.is_file() {
        trash::delete(&archive_path).map_err(|e| {
            AppError::Generic(format!(
                "Error moving song '{}' compressed file to trash: {}",
                archive_path.display(),
                e
            ))
        })?;
    }

    Ok(())
}

fn delete_song_with_files_core(
    db: &Database,
    store: &SystemStore,
    song_id: &str,
) -> Result<(), AppError> {
    let song = db.get_song_list_item_by_id(song_id)?;
    let expanded_path = from_storage_path(&song.path);
    remove_path_if_exists(std::path::Path::new(&expanded_path))?;
    delete_song_core(db, store, song_id)
}

fn normalize_author_change_name(name: &str, fallback_message: &str) -> Result<String, AppError> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err(AppError::Generic(fallback_message.to_string()));
    }

    Ok(trimmed_name.to_string())
}

#[tauri::command]
pub fn delete_file_path(store: State<'_, SystemStore>, file_path: String) -> Result<(), AppError> {
    require_server_settings(&store)?;

    let expanded = from_storage_path(&file_path);
    let path = std::path::Path::new(&expanded);
    info!("Deleting file from review screen: {}", path.display());
    remove_path_if_exists(path)
}

#[tauri::command]
pub fn get_all_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    info!("Fetching all songs");
    run_song_query_with_logging("Fetching all songs completed", || db.get_all_songs())
}

#[tauri::command]
pub fn get_all_song_summaries(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    info!("Fetching summaries of all songs");
    run_song_query_with_logging("Fetching song summaries completed", || {
        db.get_all_song_summaries()
    })
}

#[tauri::command]
pub fn get_favorited_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_favorited_songs()
}

#[tauri::command]
pub fn get_favorited_song_summaries(
    db: State<'_, Database>,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_favorited_song_summaries()
}

#[tauri::command]
pub fn get_song_list_item_by_id(
    db: State<'_, Database>,
    song_id: String,
) -> Result<SongListItem, AppError> {
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn get_songs_with_drafts(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_with_drafts()
}

#[tauri::command]
pub fn get_song_summaries_with_drafts(
    db: State<'_, Database>,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_song_summaries_with_drafts()
}

#[tauri::command]
pub fn get_songs_with_not_found(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_with_not_found()
}

#[tauri::command]
pub fn get_song_summaries_with_not_found(
    db: State<'_, Database>,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_song_summaries_with_not_found()
}

#[tauri::command]
pub fn search_songs(db: State<'_, Database>, query: String) -> Result<Vec<SongListItem>, AppError> {
    if query.trim().is_empty() {
        info!("Empty search, returning all songs");
        return run_song_query_with_logging("Busca vazia", || db.get_all_songs());
    }
    info!("Searching songs with query: '{}'", query);
    run_song_query_with_logging("Song search completed", || db.search_songs(&query))
}

#[tauri::command]
pub fn toggle_favorite(db: State<'_, Database>, song_id: String) -> Result<bool, AppError> {
    info!("Toggling favorite for song: {}", song_id);
    match db.toggle_favorite(&song_id) {
        Ok(is_now_favorite) => {
            info!("Song {} is now favorite: {}", song_id, is_now_favorite);
            Ok(is_now_favorite)
        }
        Err(e) => {
            error!("Error toggling favorite for {}: {:?}", song_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn update_composer(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    old_name: String,
    new_name: String,
) -> Result<usize, AppError> {
    require_server_settings(&store)?;

    let normalized_new_name =
        normalize_author_change_name(&new_name, "Composer name cannot be empty")?;

    db.update_composer(&old_name, &normalized_new_name)
}

#[tauri::command]
pub fn delete_composer(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    old_name: String,
) -> Result<usize, AppError> {
    require_server_settings(&store)?;

    db.delete_composer(&old_name)
}

#[tauri::command]
pub fn update_arranger(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    old_name: String,
    new_name: String,
) -> Result<usize, AppError> {
    require_server_settings(&store)?;

    let normalized_new_name =
        normalize_author_change_name(&new_name, "Arranger name cannot be empty")?;

    db.update_arranger(&old_name, &normalized_new_name)
}

#[tauri::command]
pub fn delete_arranger(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    old_name: String,
) -> Result<usize, AppError> {
    require_server_settings(&store)?;

    db.delete_arranger(&old_name)
}

#[tauri::command]
pub fn scan_directory(directory: String) -> Result<Vec<IndexedFile>, AppError> {
    let path = Path::new(&directory);
    if !path.is_dir() {
        return Err(AppError::InvalidDirectory(directory));
    }
    Ok(indexer::scan_directory(path))
}

#[tauri::command]
pub fn reindex_song_directory(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    directory: String,
) -> Result<SongListItem, AppError> {
    let normalized_directory = normalized_required_song_path(&directory)?;
    let path = Path::new(&normalized_directory);
    if !path.is_dir() {
        return Err(AppError::InvalidDirectory(normalized_directory));
    }

    let song_item = db.get_song_list_item_by_id(&song_id)?;
    let mut song = db.get_song_by_id(&song_id)?;
    let indexed_files = indexer::scan_directory(path);

    if indexed_files.is_empty() {
        return Err(AppError::Generic(
            "No valid score found in this directory".into(),
        ));
    }

    song.path = normalized_directory.clone();
    db.update_song(&song, &song_item.category_ids)?;

    let existing_score_paths: Vec<String> = db
        .get_scores_for_song(&song_id)?
        .into_iter()
        .map(|score| score.file_path)
        .collect();

    let mut added_count = 0;
    for indexed_file in indexed_files {
        if existing_score_paths
            .iter()
            .any(|existing_path| paths_match(existing_path, &indexed_file.path))
        {
            continue;
        }

        let (file_size, file_modified_at) = match get_file_metadata(Path::new(&indexed_file.path)) {
            Ok(metadata) => metadata,
            Err(e) => {
                warn!(
                    "Error getting metadata of reindexed file {}: {:?}",
                    indexed_file.path, e
                );
                continue;
            }
        };

        let (file_path, file_name) = indexer::split_file_path(&indexed_file.path);
        let score = Score::new_from_file(
            song_id.clone(),
            &indexed_file,
            file_path,
            file_name,
            (file_size, file_modified_at),
        );

        db.insert_score(&score)?;
        added_count += 1;
    }

    info!(
        "Reindexing completed for song {}: {} files added",
        song_id, added_count
    );

    let _ = refresh_library_summary_cache(&db, &store);
    db.get_song_list_item_by_id(&song_id)
}

/// Imports indexed files, grouping by song name.
/// Existing songs (case-insensitive) are not duplicated.
fn import_files_core(
    db: &Database,
    store: &SystemStore,
    files: &[IndexedFile],
    category_ids: &[String],
    composer: Option<&str>,
    arranger: Option<&str>,
    new_song_status: ScoreStatus,
) -> Result<ImportIndexedFilesResult, AppError> {
    let now = chrono::Utc::now().naive_utc();

    // Group files by song name
    let mut groups: std::collections::HashMap<String, Vec<&IndexedFile>> =
        std::collections::HashMap::new();
    for file in files {
        let song_name = normalize_song_name(&file.name);
        if song_name.is_empty() {
            continue;
        }

        groups.entry(song_name).or_default().push(file);
    }

    let all_songs = db.get_all_songs()?;
    let mut added_count = 0;
    let mut touched_song_ids: Vec<String> = Vec::new();

    db.with_transaction(|tx| {
    for (song_name, group_files) in &groups {
        let existing_song = all_songs.iter().find(|s| {
            s.name.eq_ignore_ascii_case(song_name)
                && authors_match(&s.composer, composer)
                && authors_match(&s.arranger, arranger)
        });

        let existing_scores = existing_song.map(|s| s.scores.clone()).unwrap_or_default();

        let mut known_named_instruments: Vec<String> = existing_scores
            .iter()
            .filter_map(|score| score.name.as_ref().map(|name| name.to_lowercase()))
            .collect();
        let mut known_paths: Vec<String> = existing_scores
            .iter()
            .map(|score| score.file_path.clone())
            .collect();
        let mut files_to_add = Vec::new();

        for indexed_file in group_files {
            let normalized_instrument =
                normalize_optional_score_name(indexed_file.instrument.as_deref());

            let score_exists_in_group = known_paths
                .iter()
                .any(|existing_path| paths_match(existing_path, &indexed_file.path))
                || match &normalized_instrument {
                    Some(instrument) => known_named_instruments
                        .iter()
                        .any(|existing| existing.eq_ignore_ascii_case(instrument)),
                    None => false,
                };

            if score_exists_in_group {
                continue;
            }

            let (file_size, file_modified_at) =
                match get_file_metadata(Path::new(&indexed_file.path)) {
                    Ok(metadata) => metadata,
                    Err(e) => {
                        warn!("Error getting file metadata {}: {:?}", indexed_file.path, e);
                        (0, now)
                    }
                };

            let (score_file_path, file_name) =
                crate::services::indexer::split_file_path(&indexed_file.path);

            let normalized_file = IndexedFile {
                instrument: normalized_instrument.clone(),
                status: indexed_file.status.clone(),
                ..(*indexed_file).clone()
            };

            files_to_add.push((
                normalized_file,
                score_file_path,
                file_name,
                file_size,
                file_modified_at,
            ));

            known_paths.push(indexed_file.path.clone());

            if let Some(instrument) = normalized_instrument {
                known_named_instruments.push(instrument);
            }
        }

        if files_to_add.is_empty() {
            continue;
        }

        let song_id = if let Some(existing) = existing_song {
            existing.id.clone()
        } else {
            let new_song_id = uuid::Uuid::new_v4().to_string();
            let song_path = crate::services::indexer::split_file_path(&group_files[0].path).0;
            let song = Song {
                id: new_song_id.clone(),
                name: song_name.clone(),
                composer: normalized_optional_text_ref(composer),
                arranger: normalized_optional_text_ref(arranger),
                path: song_path,
                is_favorite: false,
                status: new_song_status.clone(),
            };
            Database::insert_song_with_conn(tx, &song, category_ids)?;
            new_song_id
        };

        for (normalized_file, score_file_path, file_name, file_size, file_modified_at) in
            files_to_add
        {
            let score_status = normalized_file
                .status
                .clone()
                .unwrap_or_else(|| new_song_status.clone());
            let score = Score::new_from_file(
                song_id.clone(),
                &normalized_file,
                score_file_path,
                file_name,
                (file_size, file_modified_at),
            );

            let mut score = score;
            score.status = score_status;

            Database::insert_score_with_conn(tx, &score)?;
            added_count += 1;
        }

        touched_song_ids.push(song_id.clone());
    }
    Ok(())
    })?;

    for song_id in touched_song_ids {
        let _ = regenerate_song_archives_for_song_ids(db, store, &[song_id]);
    }

    Ok(ImportIndexedFilesResult {
        songs: db.get_all_songs()?,
        added_count,
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportIndexedFilesResult {
    pub songs: Vec<SongListItem>,
    pub added_count: usize,
}

#[tauri::command]
pub fn import_indexed_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
) -> Result<Vec<SongListItem>, AppError> {
    import_files_core(
        &db,
        &store,
        &files,
        &category_ids,
        None,
        None,
        ScoreStatus::Main,
    )
    .map(|result| {
        let _ = refresh_library_summary_cache(&db, &store);
        result.songs
    })
}

#[tauri::command]
pub fn import_indexed_files_with_metadata(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
    composer: Option<String>,
    arranger: Option<String>,
) -> Result<ImportIndexedFilesResult, AppError> {
    info!(
        "Importing indexed files with metadata: files={}, categories={}, composer_set={}, arranger_set={}",
        files.len(),
        category_ids.len(),
        composer.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false),
        arranger.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false)
    );

    import_files_core(
        &db,
        &store,
        &files,
        &category_ids,
        composer.as_deref(),
        arranger.as_deref(),
        ScoreStatus::Main,
    )
    .map(|result| {
        let _ = refresh_library_summary_cache(&db, &store);
        info!(
            "File import completed successfully: songs returned={}, scores added={}",
            result.songs.len(),
            result.added_count
        );
        result
    })
    .map_err(|e| {
        error!("Error importing indexed files: {:?}", e);
        e
    })
}

#[tauri::command]
pub fn get_songs_by_category(
    db: State<'_, Database>,
    category_id: String,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_by_category(&category_id)
}

#[tauri::command]
pub fn get_song_summaries_by_category(
    db: State<'_, Database>,
    category_id: String,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_song_summaries_by_category(&category_id)
}

fn resolve_manual_song_status(requested_status: &str) -> Result<ScoreStatus, AppError> {
    match requested_status.to_lowercase().as_str() {
        "draft" => Ok(ScoreStatus::Draft),
        "main" => Ok(ScoreStatus::Main),
        _ => Err(AppError::Generic(
            "Only changes to 'draft' or 'main' are allowed manually".into(),
        )),
    }
}

#[tauri::command]
pub fn create_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    path: String,
) -> Result<SongListItem, AppError> {
    create_song_with_metadata(db, store, name, path, None, None, Vec::new())
}

#[tauri::command]
pub fn create_song_with_categories(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    path: String,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    create_song_with_metadata(db, store, name, path, None, None, category_ids)
}

pub fn create_song_with_metadata(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    path: String,
    composer: Option<String>,
    arranger: Option<String>,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    let normalized_name = normalized_required_song_name(&name)?;
    let normalized_path = normalized_required_song_path(&path)?;
    let song_id = uuid::Uuid::new_v4().to_string();

    info!("Creating new song: {}", normalized_name);
    let song = Song {
        id: song_id.clone(),
        name: normalized_name,
        composer: normalized_optional_text(composer),
        arranger: normalized_optional_text(arranger),
        path: normalized_path,
        is_favorite: false,
        status: ScoreStatus::NotFound,
    };

    db.insert_song(&song, &category_ids).map_err(|e| {
        error!(
            "Error creating song '{}' (id={}): {:?}",
            song.name, song_id, e
        );
        e
    })?;

    let _ = refresh_library_summary_cache(&db, &store);

    db.get_song_list_item_by_id(&song_id).map(|created| {
        info!(
            "Song created successfully: {} ({})",
            created.name, created.id
        );
        created
    })
}

#[tauri::command]
pub fn update_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    name: String,
    composer: Option<String>,
    arranger: Option<String>,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    let normalized_name = normalized_required_song_name(&name)?;

    let all_songs = db.get_all_songs()?;
    ensure_unique_song_name(
        &all_songs,
        &normalized_name,
        composer.as_deref(),
        arranger.as_deref(),
        Some(&song_id),
    )?;

    info!("Updating song: {} -> {}", song_id, normalized_name);
    let original_song = db.get_song_by_id(&song_id)?;

    let updated_song = Song {
        id: original_song.id.clone(),
        name: normalized_name,
        composer: normalized_optional_text(composer),
        arranger: normalized_optional_text(arranger),
        path: original_song.path,
        is_favorite: original_song.is_favorite,
        status: original_song.status,
    };

    db.update_song(&updated_song, &category_ids)?;
    let _ = refresh_library_summary_cache(&db, &store);
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn update_song_status(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    status: String,
) -> Result<SongListItem, AppError> {
    let settings = require_server_settings(&store)?;
    let next_status = resolve_manual_song_status(&status)?;

    info!("Updating song status: {} to: {}", song_id, status);
    db.update_song_status_for_song(&song_id, next_status, &settings.computer_id)?;

    let _ = refresh_library_summary_cache(&db, &store);
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn get_search_suggestions(
    db: State<'_, Database>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<SongListItem>, AppError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let max_results = limit.unwrap_or(10);
    let mut songs = db.search_songs(&query)?;
    songs.truncate(max_results as usize);
    Ok(songs)
}

#[tauri::command]
pub fn delete_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deleting song: {}", song_id);

    delete_song_core(&db, &store, &song_id)?;

    info!("Song deleted successfully: {}", song_id);
    Ok(())
}

#[tauri::command]
pub fn delete_song_with_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deleting song directory: {}", song_id);

    delete_song_with_files_core(&db, &store, &song_id)?;

    info!("Song directory deleted successfully: {}", song_id);
    Ok(())
}

fn delete_songs_core(
    db: &Database,
    store: &SystemStore,
    song_ids: &[String],
) -> Result<(), AppError> {
    for song_id in song_ids {
        delete_song_core(db, store, song_id)?;
    }
    Ok(())
}

fn delete_songs_with_files_core(
    db: &Database,
    store: &SystemStore,
    song_ids: &[String],
) -> Result<(), AppError> {
    for song_id in song_ids {
        delete_song_with_files_core(db, store, song_id)?;
    }
    Ok(())
}

fn update_songs_status_core(
    db: &Database,
    store: &SystemStore,
    song_ids: &[String],
    status: ScoreStatus,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;
    for song_id in song_ids {
        db.update_song_status_for_song(song_id, status.clone(), &settings.computer_id)?;
    }
    Ok(())
}

fn toggle_favorites_core(db: &Database, song_ids: &[String]) -> Result<(), AppError> {
    for song_id in song_ids {
        db.toggle_favorite(song_id)?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_songs(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_ids: Vec<String>,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deleting songs: {}", song_ids.len());

    delete_songs_core(&db, &store, &song_ids)?;

    info!("Songs deleted successfully: {}", song_ids.len());
    Ok(())
}

#[tauri::command]
pub fn delete_songs_with_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_ids: Vec<String>,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deleting song directories: {}", song_ids.len());

    delete_songs_with_files_core(&db, &store, &song_ids)?;

    info!("Song directories deleted successfully: {}", song_ids.len());
    Ok(())
}

#[tauri::command]
pub fn update_songs_status(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_ids: Vec<String>,
    status: String,
) -> Result<(), AppError> {
    let next_status = resolve_manual_song_status(&status)?;

    info!("Updating status of {} songs to: {}", song_ids.len(), status);

    update_songs_status_core(&db, &store, &song_ids, next_status)?;
    let _ = refresh_library_summary_cache(&db, &store);
    Ok(())
}

#[tauri::command]
pub fn toggle_favorites(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_ids: Vec<String>,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Toggling favorite for songs: {}", song_ids.len());

    toggle_favorites_core(&db, &song_ids)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct SongDirectoryInfo {
    pub name: String,
}

#[tauri::command]
pub fn find_song_by_directory(
    db: State<'_, Database>,
    directory_path: String,
) -> Result<Option<SongDirectoryInfo>, AppError> {
    let all_songs = db.get_all_songs()?;
    for song in &all_songs {
        let expanded = from_storage_path(&song.path);
        if indexer::paths_match(&expanded, &directory_path) {
            return Ok(Some(SongDirectoryInfo {
                name: song.name.clone(),
            }));
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{
        delete_song_core, delete_song_with_files_core, delete_songs_core,
        delete_songs_with_files_core, import_files_core, toggle_favorites_core,
        update_songs_status_core,
    };
    use crate::domain::models::{AppSettings, ComputerType, IndexedFile, ScoreStatus};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    #[test]
    fn importing_indexed_files_generates_the_song_archive() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        let source_dir = dir.path().join("import");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-1.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let files = vec![IndexedFile {
            path: score_path.to_string_lossy().to_string(),
            name: "CANON".to_string(),
            instrument: Some("flauta".to_string()),
            extension: "musx".to_string(),
            status: None,
        }];

        let result = import_files_core(&db, &store, &files, &[], None, None, ScoreStatus::Main)
            .expect("import files");

        let song_id = &result.songs[0].id;
        assert!(dir
            .path()
            .join("cloud")
            .join("songs")
            .join(format!("{}.tar.zst", song_id))
            .is_file());
    }

    #[test]
    fn importing_indexed_files_with_metadata_creates_new_song_as_main() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        let source_dir = dir.path().join("import");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-1.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let files = vec![IndexedFile {
            path: score_path.to_string_lossy().to_string(),
            name: "CANON".to_string(),
            instrument: Some("flauta".to_string()),
            extension: "musx".to_string(),
            status: None,
        }];

        let result = import_files_core(
            &db,
            &store,
            &files,
            &[],
            Some("Neusom"),
            Some("Maria"),
            ScoreStatus::Main,
        )
        .expect("import files");

        assert_eq!(
            db.get_song_by_id(&result.songs[0].id).expect("song").status,
            ScoreStatus::Main
        );
    }

    #[test]
    fn importing_indexed_files_with_metadata_keeps_ignored_scores() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        let source_dir = dir.path().join("import");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-ignored.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let files = vec![IndexedFile {
            path: score_path.to_string_lossy().to_string(),
            name: "CANON".to_string(),
            instrument: Some("flauta".to_string()),
            extension: "musx".to_string(),
            status: Some(ScoreStatus::Ignored),
        }];

        let result = import_files_core(
            &db,
            &store,
            &files,
            &[],
            Some("Neusom"),
            Some("Maria"),
            ScoreStatus::Main,
        )
        .expect("import files");

        let song = db.get_song_by_id(&result.songs[0].id).expect("song");
        let score = db.get_scores_for_song(&song.id).expect("scores")[0].clone();

        assert_eq!(score.status, ScoreStatus::Ignored);
        assert_eq!(song.status, ScoreStatus::NotFound);
    }

    #[test]
    fn deleting_song_with_files_removes_the_indexed_directory() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        let song_dir = dir.path().join("repertoire").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        fs::write(song_dir.join("score.musx"), b"score").expect("write score file");

        db.insert_song(
            &crate::domain::models::Song {
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

        delete_song_with_files_core(&db, &store, "song-1").expect("delete song with files");

        assert!(!song_dir.exists());
        assert!(db.get_song_by_id("song-1").is_err());
    }

    #[test]
    fn delete_song_core_keeps_files_when_only_unindexing() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        let song_dir = dir.path().join("repertoire").join("song-2");
        fs::create_dir_all(&song_dir).expect("create song dir");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-2".to_string(),
                name: "CANON 2".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
            },
            &[],
        )
        .expect("insert song");

        delete_song_core(&db, &store, "song-2").expect("delete song core");

        assert!(song_dir.exists());
        assert!(db.get_song_by_id("song-2").is_err());
    }

    fn insert_test_song(
        db: &Database,
        id: &str,
        name: &str,
        path: &std::path::Path,
        status: ScoreStatus,
    ) {
        db.insert_song(
            &crate::domain::models::Song {
                id: id.to_string(),
                name: name.to_string(),
                composer: None,
                arranger: None,
                path: path.to_string_lossy().to_string(),
                is_favorite: false,
                status,
            },
            &[],
        )
        .expect("insert song");
    }

    #[test]
    fn deleting_multiple_songs_removes_them_all() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        for i in 1..=3 {
            let song_dir = dir.path().join("repertoire").join(format!("song-{}", i));
            fs::create_dir_all(&song_dir).expect("create song dir");
            insert_test_song(
                &db,
                &format!("song-{}", i),
                &format!("CANON {}", i),
                &song_dir,
                ScoreStatus::Main,
            );
        }

        delete_songs_core(&db, &store, &["song-1".to_string(), "song-2".to_string()])
            .expect("delete songs");

        assert!(db.get_song_by_id("song-1").is_err());
        assert!(db.get_song_by_id("song-2").is_err());
        assert!(db.get_song_by_id("song-3").is_ok());
    }

    #[test]
    fn deleting_multiple_songs_with_files_removes_the_directories() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        for i in 1..=3 {
            let song_dir = dir.path().join("repertoire").join(format!("song-{}", i));
            fs::create_dir_all(&song_dir).expect("create song dir");
            fs::write(song_dir.join("score.musx"), b"score").expect("write score");
            insert_test_song(
                &db,
                &format!("song-{}", i),
                &format!("CANON {}", i),
                &song_dir,
                ScoreStatus::Main,
            );
        }

        delete_songs_with_files_core(&db, &store, &["song-1".to_string(), "song-2".to_string()])
            .expect("delete songs with files");

        assert!(db.get_song_by_id("song-1").is_err());
        assert!(db.get_song_by_id("song-2").is_err());
        assert!(db.get_song_by_id("song-3").is_ok());
    }

    #[test]
    fn updating_status_of_multiple_songs_changes_all_of_them() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        for i in 1..=3 {
            let song_dir = dir.path().join("repertoire").join(format!("song-{}", i));
            fs::create_dir_all(&song_dir).expect("create song dir");
            insert_test_song(
                &db,
                &format!("song-{}", i),
                &format!("CANON {}", i),
                &song_dir,
                ScoreStatus::Main,
            );
        }

        update_songs_status_core(
            &db,
            &store,
            &["song-1".to_string(), "song-3".to_string()],
            ScoreStatus::Draft,
        )
        .expect("update songs status");

        assert_eq!(
            db.get_song_by_id("song-1").expect("song-1").status,
            ScoreStatus::Draft
        );
        assert_eq!(
            db.get_song_by_id("song-2").expect("song-2").status,
            ScoreStatus::Main
        );
        assert_eq!(
            db.get_song_by_id("song-3").expect("song-3").status,
            ScoreStatus::Draft
        );
    }

    #[test]
    fn toggling_favorite_of_multiple_songs_updates_all_of_them() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
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

        for i in 1..=3 {
            let song_dir = dir.path().join("repertoire").join(format!("song-{}", i));
            fs::create_dir_all(&song_dir).expect("create song dir");
            insert_test_song(
                &db,
                &format!("song-{}", i),
                &format!("CANON {}", i),
                &song_dir,
                ScoreStatus::Main,
            );
        }

        toggle_favorites_core(&db, &["song-1".to_string(), "song-3".to_string()])
            .expect("toggle favorites");

        assert!(db.get_song_by_id("song-1").expect("song-1").is_favorite);
        assert!(!db.get_song_by_id("song-2").expect("song-2").is_favorite);
        assert!(db.get_song_by_id("song-3").expect("song-3").is_favorite);
    }
}
