use std::path::{Path, PathBuf};
use std::process::Command;

use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, OperationGuard};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::backup_songs_service::generate_song_archives_for_song_ids as generate_song_archives_for_song_ids_service;
use crate::services::cloud_paths::ensure_cloud_root_dir;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub fn get_settings(store: &SystemStore) -> Result<AppSettings, AppError> {
    store.get_app_settings()
}

pub fn require_server_settings(store: &SystemStore) -> Result<AppSettings, AppError> {
    let settings = get_settings(store)?;
    settings.require_server_only()?;
    Ok(settings)
}

pub async fn run_blocking_with_store<T, F>(
    app_data_dir: PathBuf,
    error_context: &'static str,
    task: F,
) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(SystemStore) -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir);
        task(store)
    })
    .await
    .map_err(|e| AppError::Generic(format!("{}: {}", error_context, e)))?
}

pub fn regenerate_song_archives_for_song_ids(
    db: &Database,
    store: &SystemStore,
    song_ids: &[String],
) -> Result<(), AppError> {
    if song_ids.is_empty() {
        return Ok(());
    }

    let cloud_root = ensure_cloud_root_dir(store.app_data_dir())?;
    generate_song_archives_for_song_ids_service(db, store.app_data_dir(), &cloud_root, song_ids)
        .map(|_| ())
}

pub fn remove_path_if_exists(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Ok(());
    }
    trash::delete(path).map_err(|e| {
        AppError::Generic(format!("Error moving '{}' to trash: {}", path.display(), e))
    })
}

#[cfg(target_os = "windows")]
pub fn configure_windows_command(cmd: Command, creation_flags: u32) -> Command {
    let mut cmd = cmd;
    cmd.creation_flags(creation_flags);
    cmd
}

pub fn configure_no_window_command(cmd: Command) -> Command {
    #[cfg(target_os = "windows")]
    {
        // CREATE_NO_WINDOW = 0x08000000
        return configure_windows_command(cmd, 0x08000000);
    }

    #[cfg(not(target_os = "windows"))]
    {
        cmd
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{regenerate_song_archives_for_song_ids, remove_path_if_exists};
    use crate::domain::models::{AppSettings, ComputerType, Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;
    use crate::services::indexer::get_file_metadata;

    #[test]
    fn regenerates_song_archive_immediately_after_score_insert() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("common.db")).expect("db");
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

        let source_dir = dir.path().join("source");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-1.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");
        let song_id = "song-1".to_string();

        db.insert_song(
            &Song {
                id: song_id.clone(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: source_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: song_id.clone(),
            name: Some("flute".to_string()),
            file_path: source_dir.to_string_lossy().to_string(),
            file_name: "score-1.musx".to_string(),
            file_size,
            file_modified_at,
            status: ScoreStatus::Main,
        })
        .expect("insert score");

        regenerate_song_archives_for_song_ids(&db, &store, &[song_id.clone()]).expect("regen");

        assert!(dir
            .path()
            .join("cloud")
            .join("songs")
            .join("song-1.tar.zst")
            .is_file());
    }

    #[test]
    fn remove_path_if_exists_deletes_files() {
        let dir = tempdir().expect("temp dir");
        let file_path = dir.path().join("score.musx");
        fs::write(&file_path, b"score").expect("write file");

        remove_path_if_exists(&file_path).expect("delete file");

        assert!(!file_path.exists());
    }
}
