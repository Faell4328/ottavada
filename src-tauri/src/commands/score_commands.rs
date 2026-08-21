use std::fs::{self, File};
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

#[cfg(target_os = "windows")]
use crate::commands::common::configure_no_window_command;
use crate::commands::common::{
    regenerate_song_archives_for_song_ids, remove_path_if_exists, require_server_settings,
};
use crate::domain::errors::AppError;
use crate::domain::models::ComputerType;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_draft_ignored_service::remove_backup_file_for_draft_ignored_score;
use crate::services::indexer::{get_file_metadata, split_file_path};
use crate::services::name_formatter::normalize_optional_score_name;
use crate::services::path_normalizer::from_storage_path;

const VALID_SCORE_EXTENSIONS: [&str; 12] = [
    "pdf", "mus", "musx", "mscx", "mscz", "xml", "musicxml", "sib", "enc", "dorico", "mid", "midi",
];

fn ensure_supported_score_file(path: &Path) -> Result<(), AppError> {
    if !path.exists() || !path.is_file() {
        warn!("File not found: {}", path.display());
        return Err(AppError::Generic("File not found".into()));
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or_else(|| AppError::Generic("Invalid file extension".into()))?
        .to_lowercase();

    if !VALID_SCORE_EXTENSIONS.contains(&extension.as_str()) {
        warn!("Unsupported file extension: {}", extension);
        return Err(AppError::Generic("Unsupported file type".into()));
    }

    Ok(())
}

fn resolve_manual_score_status(
    current_status: ScoreStatus,
    requested_status: &str,
) -> Result<ScoreStatus, AppError> {
    match requested_status.to_lowercase().as_str() {
        "draft" => Ok(ScoreStatus::Draft),
        "ignored" => Ok(ScoreStatus::Ignored),
        "main" => {
            if current_status != ScoreStatus::Draft && current_status != ScoreStatus::Ignored {
                warn!("Attempt to set score as main outside the draft/ignored -> main flow");
                return Err(AppError::Generic(
                    "The score must be 'draft' or 'ignored' to be set as 'main'".into(),
                ));
            }

            Ok(ScoreStatus::Main)
        }
        _ => {
            warn!("Invalid manual status flow requested: {}", requested_status);
            Err(AppError::Generic(
                "Only changes to 'draft', 'main' or 'ignored' are allowed manually".into(),
            ))
        }
    }
}

fn score_names_match(left: Option<&str>, right: Option<&str>) -> bool {
    match (
        normalize_optional_score_name(left),
        normalize_optional_score_name(right),
    ) {
        (Some(left), Some(right)) => left.eq_ignore_ascii_case(&right),
        _ => false,
    }
}

fn score_has_duplicate_instrument(song: &SongListItem, score_id: &str, name: Option<&str>) -> bool {
    song.scores.iter().any(|other| {
        other.id != score_id
            && other.status != ScoreStatus::Ignored
            && score_names_match(name, other.name.as_deref())
    })
}

fn delete_score_core(db: &Database, score_id: &str) -> Result<(), AppError> {
    let score_path = db.get_score_file_path(score_id)?;
    db.delete_score(score_id)?;
    remove_path_if_exists(Path::new(&score_path))
}

fn read_score_file_metadata(path: &Path) -> Result<(u64, chrono::NaiveDateTime), AppError> {
    get_file_metadata(path).map_err(|e| {
        error!("Error getting file metadata: {:?}", e);
        AppError::Generic(format!("Error reading file: {}", e))
    })
}

fn open_path_on_system(file_path: &str) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        let normalized_path = file_path.replace('/', "\\");
        let mut cmd = configure_no_window_command(std::process::Command::new("cmd"));
        cmd.args(["/C", "start", "", &normalized_path])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Error opening file: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Error opening file: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        open_with_default_handler(file_path)
            .map_err(|e| AppError::Generic(format!("Error opening file: {}", e)))?;
    }

    Ok(())
}

/// Opens a path using the system default handler on Linux.
///
/// Tries `xdg-open` first, then common desktop-environment alternatives.
/// Returns a clear error if no handler is available (e.g. minimal systems
/// without `xdg-utils` installed).
#[cfg(target_os = "linux")]
fn open_with_default_handler(target: &str) -> Result<(), String> {
    let handlers = ["xdg-open", "gio", "kde-open", "gnome-open"];
    let mut last_error = String::from("no file handler available");

    for handler in handlers {
        let arg = if handler == "gio" { "open" } else { target };
        match std::process::Command::new(handler).arg(arg).spawn() {
            Ok(_) => return Ok(()),
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    last_error = format!("'{}' not found", handler);
                    continue;
                }
                last_error = format!("'{}' failed: {}", handler, e);
            }
        }
    }

    Err(format!(
        "Could not open '{}': no system file handler available. Install xdg-utils (or a desktop environment providing gio/kde-open/gnome-open). Last error: {}",
        target, last_error
    ))
}

fn open_file_location_on_system(file_path: &str) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        let normalized_path = file_path.replace('/', "\\");
        let path = Path::new(&normalized_path);

        if !path.exists() {
            return Err(AppError::Generic("File not found".into()));
        }

        let mut cmd = configure_no_window_command(std::process::Command::new("explorer"));
        if path.is_dir() {
            cmd.arg(&normalized_path).spawn().map_err(|e| {
                AppError::Generic(format!("Error opening directory location: {}", e))
            })?;
        } else {
            cmd.args(["/select,", &normalized_path])
                .spawn()
                .map_err(|e| AppError::Generic(format!("Error opening file location: {}", e)))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        let path = Path::new(file_path);

        if !path.exists() {
            return Err(AppError::Generic("File not found".into()));
        }

        let mut command = std::process::Command::new("open");
        if path.is_dir() {
            command.arg(path);
        } else {
            command.arg("-R").arg(path);
        }

        command
            .spawn()
            .map_err(|e| AppError::Generic(format!("Error opening file location: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        let path = Path::new(file_path);

        if !path.exists() {
            return Err(AppError::Generic("File not found".into()));
        }

        let parent = path
            .parent()
            .ok_or_else(|| AppError::Generic("Could not identify the file's directory".into()))?;

        let parent_str = parent.to_string_lossy().to_string();
        open_with_default_handler(&parent_str)
            .map_err(|e| AppError::Generic(format!("Error opening file location: {}", e)))?;
    }

    Ok(())
}

fn extract_score_file_from_archive(
    archive_path: &Path,
    score_id: &str,
    output_file_stem: &str,
    destination_dir: &Path,
) -> Result<std::path::PathBuf, AppError> {
    if !archive_path.is_file() {
        return Err(AppError::Generic(format!(
            "Compressed song file not found: {}",
            archive_path.display()
        )));
    }

    fs::create_dir_all(destination_dir).map_err(|e| {
        AppError::Generic(format!(
            "Error creating temporary directory to open score: {}",
            e
        ))
    })?;

    let archive_file = File::open(archive_path).map_err(|e| {
        AppError::Generic(format!(
            "Error opening compressed file {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    let decoder = zstd::stream::read::Decoder::new(archive_file).map_err(|e| {
        AppError::Generic(format!(
            "Error decompressing file {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    let mut archive = tar::Archive::new(decoder);
    let mut entries = archive.entries().map_err(|e| {
        AppError::Generic(format!(
            "Error listing package files {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    while let Some(entry_result) = entries.next() {
        let mut entry = entry_result.map_err(|e| {
            AppError::Generic(format!(
                "Error reading package entry {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        if !entry.header().entry_type().is_file() {
            continue;
        }

        let entry_path = entry.path().map_err(|e| {
            AppError::Generic(format!(
                "Error reading path inside package {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        let file_name = match entry_path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name,
            None => continue,
        };

        let path_for_name = Path::new(file_name);
        let file_stem = path_for_name.file_stem().and_then(|stem| stem.to_str());
        let is_target = file_stem == Some(score_id) || file_name == score_id;

        if !is_target {
            continue;
        }

        let extension = path_for_name
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");

        let output_name = if extension.is_empty() {
            output_file_stem.to_string()
        } else {
            format!("{}.{}", output_file_stem, extension)
        };

        let output_path = destination_dir.join(output_name);
        if output_path.exists() {
            fs::remove_file(&output_path).map_err(|e| {
                AppError::Generic(format!(
                    "Error cleaning temporary file {}: {}",
                    output_path.display(),
                    e
                ))
            })?;
        }

        entry.unpack(&output_path).map_err(|e| {
            AppError::Generic(format!(
                "Error extracting score to {}: {}",
                output_path.display(),
                e
            ))
        })?;

        return Ok(output_path);
    }

    Err(AppError::Generic(format!(
        "Score '{}' not found inside package {}",
        score_id,
        archive_path.display()
    )))
}

fn resolve_openable_score_path(
    db: &Database,
    score_id: &str,
) -> Result<std::path::PathBuf, AppError> {
    let file_path = db.get_score_file_path(score_id)?;
    let direct_path = Path::new(&file_path);

    if direct_path.exists() && direct_path.is_file() {
        ensure_supported_score_file(direct_path)?;
        return Ok(direct_path.to_path_buf());
    }

    Err(AppError::Generic(format!(
        "Score file not found: {}",
        file_path
    )))
}

fn sanitize_file_name_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                '_'
            } else {
                ch
            }
        })
        .collect();

    let trimmed = sanitized.trim().trim_matches('.').trim_matches(' ');
    if trimmed.is_empty() {
        "no_name".to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_client_extracted_score_name(song_name: &str, score_name: Option<&str>) -> String {
    let song = sanitize_file_name_component(song_name);
    let score = sanitize_file_name_component(score_name.unwrap_or("No instrument"));
    format!("{} - {}", song, score)
}

fn refresh_library_summary_cache(_db: &Database, _store: &SystemStore) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
pub fn update_score(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
    instrument_name: Option<String>,
) -> Result<(), AppError> {
    info!("Updating score name: {}", score_id);

    let _settings = require_server_settings(&store)?;

    let normalized_instrument_name = normalize_optional_score_name(instrument_name.as_deref());

    db.update_score_name(&score_id, normalized_instrument_name)
        .map(|_| {
            info!("Score name updated successfully: {}", score_id);
            let _ = refresh_library_summary_cache(&db, &store);
        })
        .map_err(|e| {
            error!("Error updating score name {}: {:?}", score_id, e);
            e
        })
}

#[tauri::command]
pub async fn open_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;

    if settings.computer_type == ComputerType::Client {
        let song_id = db.get_song_id_for_score(&score_id)?;
        let song = db.get_song_list_item_by_id(&song_id)?;
        let score = song
            .scores
            .iter()
            .find(|item| item.id == score_id)
            .ok_or_else(|| AppError::ScoreNotFound(score_id.clone()))?;

        let output_file_stem = build_client_extracted_score_name(&song.name, score.name.as_deref());
        let app_data_dir = store.app_data_dir().clone();
        let archive_path = app_data_dir
            .join("cloud")
            .join("songs")
            .join(format!("{}.tar.zst", song_id));
        let temp_dir = app_data_dir.join("tmp").join("scores");

        let extracted_path = extract_score_file_from_archive(
            &archive_path,
            &score_id,
            &output_file_stem,
            &temp_dir,
        )?;
        let extracted_path_str = extracted_path.to_string_lossy().to_string();
        return open_path_on_system(&extracted_path_str);
    }

    let resolved_path = resolve_openable_score_path(&db, &score_id)?;
    open_path_on_system(&resolved_path.to_string_lossy())
}

#[tauri::command]
pub fn open_file_path(file_path: String) -> Result<(), AppError> {
    let expanded = from_storage_path(&file_path);
    let path = Path::new(&expanded);
    ensure_supported_score_file(path)?;
    open_path_on_system(&expanded)
}

#[tauri::command]
pub fn open_file_location(file_path: String) -> Result<(), AppError> {
    let expanded = from_storage_path(&file_path);
    let path = Path::new(&expanded);
    if path.exists() && path.is_dir() {
        return open_file_location_on_system(&expanded);
    }

    if path.exists() && path.is_file() {
        ensure_supported_score_file(path)?;
        return open_file_location_on_system(&expanded);
    }

    Err(AppError::Generic(format!(
        "File location not found for path '{}'",
        file_path
    )))
}

#[tauri::command]
pub fn get_scores_for_song(
    db: State<'_, Database>,
    song_id: String,
) -> Result<Vec<ScoreListItem>, AppError> {
    db.get_scores_for_song(&song_id)
}

#[tauri::command]
pub fn update_score_status(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
    status: String,
) -> Result<SongListItem, AppError> {
    let settings = require_server_settings(&store)?;

    info!("Updating score status: {} to: {}", score_id, status);
    let song_id = db.get_song_id_for_score(&score_id)?;
    let song = db.get_song_list_item_by_id(&song_id)?;
    let current_score = song
        .scores
        .iter()
        .find(|sc| sc.id == score_id)
        .ok_or_else(|| AppError::ScoreNotFound(score_id.clone()))?;

    let next_status = resolve_manual_score_status(current_score.status.clone(), &status)?;

    if matches!(current_score.status, ScoreStatus::Ignored)
        && !matches!(next_status, ScoreStatus::Ignored)
        && score_has_duplicate_instrument(&song, &score_id, current_score.name.as_deref())
    {
        return Err(AppError::ScoreDuplicateInstrument);
    }

    db.update_score_status(&score_id, next_status.clone(), &settings.computer_id, None)?;

    if matches!(
        current_score.status,
        ScoreStatus::Draft | ScoreStatus::Ignored
    ) && !matches!(next_status, ScoreStatus::Draft | ScoreStatus::Ignored)
    {
        let _ = remove_backup_file_for_draft_ignored_score(
            &store,
            &score_id,
            &current_score.file_extension,
        );
    }

    let _ = refresh_library_summary_cache(&db, &store);

    info!(
        "Score status {} updated successfully to {}",
        score_id, status
    );
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn delete_score(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deleting score: {}", score_id);

    let song_id = db.get_song_id_for_score(&score_id)?;
    let song = db.get_song_list_item_by_id(&song_id)?;
    if let Some(score) = song.scores.iter().find(|sc| sc.id == score_id) {
        if matches!(score.status, ScoreStatus::Draft | ScoreStatus::Ignored) {
            let _ = remove_backup_file_for_draft_ignored_score(
                &store,
                &score_id,
                &score.file_extension,
            );
        }
    }

    delete_score_core(&db, &score_id)
        .map(|_| {
            info!("Score deleted successfully: {}", score_id);
            let _ = refresh_library_summary_cache(&db, &store);
        })
        .map_err(|e| {
            error!("Error deleting score: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn use_score_as_base(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    source_score_id: String,
    new_score_name: String,
) -> Result<SongListItem, AppError> {
    info!(
        "Using score as base: source_score_id={}, new_score_name={}",
        source_score_id, new_score_name
    );

    // Find the source score and its song
    let all_songs = db.get_all_songs()?;
    let (song, _source_score) = all_songs
        .iter()
        .find_map(|song| {
            song.scores
                .iter()
                .find(|score| score.id == source_score_id)
                .map(|score| (song, score))
        })
        .ok_or_else(|| AppError::Generic(format!("Score not found: {}", source_score_id)))?;

    let song_id = &song.id;

    let source_full_path = Path::new(&db.get_score_file_path(&source_score_id)?).to_path_buf();

    if !source_full_path.exists() || !source_full_path.is_file() {
        return Err(AppError::Generic("Source file not found".into()));
    }

    let source_file_name = source_full_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Generic("Invalid source file name".into()))?;

    let (song_prefix, extension) = source_file_name
        .rsplit_once('.')
        .ok_or_else(|| AppError::Generic("Invalid file extension".into()))?;

    let file_name_prefix = song_prefix
        .rsplit_once(" - ")
        .map(|(prefix, _)| prefix)
        .unwrap_or(song_prefix);

    let compacted_score_name = new_score_name.replace(' ', "");

    // Create new filename with the new name and extension
    let new_filename = format!(
        "{} - {}.{}",
        file_name_prefix, compacted_score_name, extension
    );
    let source_parent = source_full_path.parent().ok_or_else(|| {
        AppError::Generic("Could not identify the source score's directory".into())
    })?;
    let new_file_path = source_parent.join(&new_filename);

    // Copy the file
    fs::copy(&source_full_path, &new_file_path).map_err(|e| {
        error!(
            "Error copying file: {} -> {}: {}",
            source_full_path.display(),
            new_file_path.display(),
            e
        );
        AppError::Generic(format!("Error copying file: {}", e))
    })?;

    // Create new score entry
    let (file_size, file_modified_at) = read_score_file_metadata(&new_file_path)?;
    let (score_file_path, file_name) =
        split_file_path(&new_file_path.to_string_lossy().to_string());

    let new_score = Score {
        id: uuid::Uuid::new_v4().to_string(),
        song_id: song_id.clone(),
        name: Some(new_score_name.clone()),
        file_path: score_file_path,
        file_name,
        file_size,
        file_modified_at,
        status: ScoreStatus::Main,
    };

    db.insert_score(&new_score).map_err(|e| {
        error!("Error inserting new score in song_id={}: {:?}", song_id, e);
        // Rollback: delete the copied file if database insertion fails
        let _ = fs::remove_file(&new_file_path);
        e
    })?;

    info!(
        "Score created successfully from base: song_id={}, new_score_id={}",
        song_id, new_score.id
    );

    let _ = regenerate_song_archives_for_song_ids(&db, &store, &[song_id.clone()]);
    let _ = refresh_library_summary_cache(&db, &store);

    db.get_song_list_item_by_id(song_id)
}

#[tauri::command]
pub fn open_song_temp_dir(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;

    if settings.computer_type != ComputerType::Client {
        return Err(AppError::Generic(
            "Operation available only on the client".into(),
        ));
    }

    let app_data_dir = store.app_data_dir().clone();
    let archive_path = app_data_dir
        .join("cloud")
        .join("songs")
        .join(format!("{}.tar.zst", song_id));
    let temp_dir = app_data_dir.join("tmp").join("scores");

    let song = db.get_song_list_item_by_id(&song_id)?;
    let song_dir_name = sanitize_file_name_component(&song.name);
    let song_temp_dir = temp_dir.join(&song_dir_name);

    if archive_path.is_file() {
        for score in &song.scores {
            let output_file_stem =
                build_client_extracted_score_name(&song.name, score.name.as_deref());
            extract_score_file_from_archive(
                &archive_path,
                &score.id,
                &output_file_stem,
                &song_temp_dir,
            )?;
        }
    }

    open_file_location_on_system(&song_temp_dir.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::tempdir;

    use crate::commands::common::remove_path_if_exists;
    use crate::domain::models::{Score, ScoreStatus};
    use crate::infrastructure::database::Database;

    use super::{
        build_client_extracted_score_name, delete_score_core, extract_score_file_from_archive,
        resolve_manual_score_status, resolve_openable_score_path, sanitize_file_name_component,
        score_has_duplicate_instrument,
    };

    fn write_test_tar_zst(archive_path: &Path, files: &[(&str, &[u8])]) {
        let archive_file = fs::File::create(archive_path).expect("create archive file");
        let mut encoder = zstd::stream::Encoder::new(archive_file, 3).expect("create zstd encoder");

        {
            let mut builder = tar::Builder::new(&mut encoder);
            for (name, bytes) in files {
                let mut header = tar::Header::new_gnu();
                header.set_size(bytes.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder
                    .append_data(&mut header, *name, &bytes[..])
                    .expect("append tar entry");
            }
            builder.finish().expect("finish tar");
        }

        encoder.finish().expect("finish zstd");
    }

    #[test]
    fn blocks_unignore_when_duplicate_instrument_exists() {
        let now = chrono::Local::now().naive_local();

        let song = crate::domain::models::SongListItem {
            id: "song-1".to_string(),
            name: "CANON".to_string(),
            composer: None,
            arranger: None,
            path: "/music/song-1".to_string(),
            is_favorite: false,
            status: ScoreStatus::Main,
            category_ids: vec![],
            scores: vec![
                crate::domain::models::ScoreListItem {
                    id: "score-1".to_string(),
                    name: Some("Flute".to_string()),
                    file_path: "/music/song-1/Canon - Flute.musx".to_string(),
                    file_extension: "musx".to_string(),
                    updated_at: now,
                    status: ScoreStatus::Main,
                },
                crate::domain::models::ScoreListItem {
                    id: "score-2".to_string(),
                    name: Some("flute".to_string()),
                    file_path: "/music/song-1/Canon - Flute.mscz".to_string(),
                    file_extension: "mscz".to_string(),
                    updated_at: now,
                    status: ScoreStatus::Ignored,
                },
            ],
        };

        assert!(score_has_duplicate_instrument(
            &song,
            "score-2",
            Some("Flute")
        ));
        assert!(!score_has_duplicate_instrument(
            &song,
            "score-2",
            Some("Violino")
        ));
    }

    #[test]
    fn extracts_target_score_from_song_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-1.tar.zst");
        write_test_tar_zst(
            &archive_path,
            &[("score-a.musx", b"A"), ("score-b.pdf", b"B")],
        );

        let output_dir = dir.path().join("out");
        let extracted = extract_score_file_from_archive(
            &archive_path,
            "score-b",
            "TEST MUSIC - flute 1",
            &output_dir,
        )
        .expect("extract");

        assert_eq!(
            extracted.file_name().and_then(|name| name.to_str()),
            Some("TEST MUSIC - flute 1.pdf")
        );
        assert_eq!(fs::read_to_string(extracted).expect("read file"), "B");
    }

    #[test]
    fn returns_error_when_score_is_missing_in_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-2.tar.zst");
        write_test_tar_zst(&archive_path, &[("score-a.musx", b"A")]);

        let output_dir = dir.path().join("out");
        let result = extract_score_file_from_archive(
            &archive_path,
            "score-z",
            "TEST MUSIC - flute",
            &output_dir,
        );

        assert!(result.is_err());
    }

    #[test]
    fn extracts_multiple_scores_from_same_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-3.tar.zst");
        write_test_tar_zst(
            &archive_path,
            &[
                ("score-a.musx", b"content A"),
                ("score-b.pdf", b"content B"),
                ("score-c.mid", b"content C"),
            ],
        );

        let output_dir = dir.path().join("out");

        let extracted_a = extract_score_file_from_archive(
            &archive_path,
            "score-a",
            "NATIONAL ANTHEM - Flauta",
            &output_dir,
        )
        .expect("extract score-a");
        assert_eq!(
            extracted_a.file_name().and_then(|n| n.to_str()),
            Some("NATIONAL ANTHEM - Flauta.musx")
        );
        assert_eq!(fs::read_to_string(&extracted_a).expect("read"), "content A");

        let extracted_b = extract_score_file_from_archive(
            &archive_path,
            "score-b",
            "NATIONAL ANTHEM - Trompete",
            &output_dir,
        )
        .expect("extract score-b");
        assert_eq!(
            extracted_b.file_name().and_then(|n| n.to_str()),
            Some("NATIONAL ANTHEM - Trompete.pdf")
        );
        assert_eq!(fs::read_to_string(&extracted_b).expect("read"), "content B");

        let extracted_c = extract_score_file_from_archive(
            &archive_path,
            "score-c",
            "NATIONAL ANTHEM - Violino",
            &output_dir,
        )
        .expect("extract score-c");
        assert_eq!(
            extracted_c.file_name().and_then(|n| n.to_str()),
            Some("NATIONAL ANTHEM - Violino.mid")
        );
        assert_eq!(fs::read_to_string(&extracted_c).expect("read"), "content C");

        let dir_entries: Vec<_> = fs::read_dir(&output_dir)
            .expect("read output dir")
            .map(|e| e.expect("entry").file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(dir_entries.len(), 3);
    }

    #[test]
    fn sanitizes_file_name_component_for_cross_platform_open() {
        assert_eq!(
            sanitize_file_name_component(" NATIONAL: ANTHEM/TEST?* "),
            "NATIONAL_ ANTHEM_TEST__"
        );
        assert_eq!(sanitize_file_name_component("..."), "no_name");
    }

    #[test]
    fn builds_friendly_name_with_default_score_when_missing() {
        let name = build_client_extracted_score_name("NATIONAL ANTHEM", None);
        assert_eq!(name, "NATIONAL ANTHEM - No instrument");
    }

    #[test]
    fn copies_file_and_updates_extension_correctly() {
        let dir = tempdir().expect("create temp dir");
        let source_file = dir.path().join("original.musx");
        fs::write(&source_file, b"test content").expect("write source file");

        let new_name = "copy";
        let extension = source_file
            .extension()
            .and_then(|e| e.to_str())
            .expect("get extension")
            .to_lowercase();
        let new_filename = format!("{}.{}", new_name, extension);
        let new_file_path = dir.path().join(&new_filename);

        fs::copy(&source_file, &new_file_path).expect("copy file");

        assert!(new_file_path.exists());
        assert_eq!(
            fs::read(&new_file_path).expect("read new file"),
            b"test content"
        );
        assert_eq!(
            new_file_path.file_name().and_then(|n| n.to_str()),
            Some("copy.musx")
        );
    }

    #[test]
    fn removes_score_file_from_disk_before_deleting_record() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scores.db")).expect("db");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        let score_path = song_dir.join("score-1.musx");
        fs::write(&score_path, b"score content").expect("write score file");

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

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flauta".to_string()),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "score-1.musx".to_string(),
            file_size: 13,
            file_modified_at: chrono::Utc::now().naive_utc(),
            status: ScoreStatus::Main,
        })
        .expect("insert score");

        delete_score_core(&db, "score-1").expect("delete score");

        assert!(!score_path.exists());
        assert!(db.get_score_file_path("score-1").is_err());
    }

    #[test]
    fn remove_path_if_exists_ignores_missing_paths() {
        let dir = tempdir().expect("temp dir");
        let missing_path = dir.path().join("missing.txt");

        remove_path_if_exists(&missing_path).expect("ignore missing");
    }

    #[test]
    fn resolves_direct_file_path_when_available() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "NATIONAL ANTHEM".to_string(),
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
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flauta".to_string()),
            file_path: dir.path().join("scores").to_string_lossy().to_string(),
            file_name: "flauta.musx".to_string(),
            file_size: 10,
            file_modified_at: chrono::Utc::now().naive_utc(),
            status: ScoreStatus::Main,
        })
        .expect("insert score");

        let direct_path = dir.path().join("scores").join("flauta.musx");
        fs::create_dir_all(direct_path.parent().expect("direct parent")).expect("create dirs");
        fs::write(&direct_path, b"X").expect("write direct file");

        let resolved = resolve_openable_score_path(&db, "score-1").expect("resolve");

        assert_eq!(resolved, direct_path);
    }

    #[test]
    fn resolves_manual_score_status_for_ignored_to_draft() {
        assert_eq!(
            resolve_manual_score_status(ScoreStatus::Ignored, "draft").expect("status"),
            ScoreStatus::Draft
        );
    }

    #[test]
    fn resolves_manual_score_status_for_ignored_to_main() {
        assert_eq!(
            resolve_manual_score_status(ScoreStatus::Ignored, "main").expect("status"),
            ScoreStatus::Main
        );
    }

    #[test]
    fn returns_error_when_direct_file_is_missing() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "NATIONAL ANTHEM".to_string(),
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
            },
            &[],
        )
        .expect("insert song");

        let err = resolve_openable_score_path(&db, "score-1").expect_err("missing file");

        assert!(err.to_string().contains("Score file not found"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn open_with_default_handler_reports_clear_error_when_no_handler() {
        // On a minimal Linux system with no xdg-utils/gio/kde-open/gnome-open,
        // the error must clearly tell the user what is missing.
        let err = open_with_default_handler("/tmp/does-not-matter.pdf")
            .expect_err("no handler available");
        assert!(err.contains("no system file handler available"));
        assert!(err.contains("xdg-utils"));
    }
}
