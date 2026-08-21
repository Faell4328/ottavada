use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::errors::AppError;

pub const CLOUD_DIR_NAME: &str = "cloud";
pub const CLOUD_ACTIONS_DIR_NAME: &str = "actions";
pub const CLOUD_BACKUP_DIR_NAME: &str = "backup";
pub const CLOUD_BACKUP_DRAFT_IGNORED_DIR_NAME: &str = "backup_scores_draft_ignored";
const SERVER_APPLY_IN_PROGRESS_FILE_NAME: &str = "server-apply-in-progress.lock";

pub fn ensure_cloud_root_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = app_data_dir.join(CLOUD_DIR_NAME);
    fs::create_dir_all(&cloud_dir)
        .map_err(|e| AppError::Generic(format!("Error preparing local cloud folder: {}", e)))?;
    Ok(cloud_dir)
}

pub fn ensure_actions_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let actions_dir = cloud_dir.join(CLOUD_ACTIONS_DIR_NAME);

    fs::create_dir_all(&actions_dir).map_err(|e| {
        AppError::Generic(format!("Error preparing local cloud actions folder: {}", e))
    })?;

    Ok(actions_dir)
}

pub fn ensure_backup_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let backup_dir = cloud_dir.join(CLOUD_BACKUP_DIR_NAME);

    fs::create_dir_all(&backup_dir).map_err(|e| {
        AppError::Generic(format!("Error preparing local cloud backup folder: {}", e))
    })?;

    Ok(backup_dir)
}

pub fn ensure_draft_ignored_backup_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let backup_dir = cloud_dir.join(CLOUD_BACKUP_DRAFT_IGNORED_DIR_NAME);

    fs::create_dir_all(&backup_dir).map_err(|e| {
        AppError::Generic(format!(
            "Error preparing local draft/ignored score backup folder: {}",
            e
        ))
    })?;

    Ok(backup_dir)
}

pub fn server_apply_in_progress_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SERVER_APPLY_IN_PROGRESS_FILE_NAME)
}

pub fn mark_server_apply_in_progress(app_data_dir: &Path) -> Result<(), AppError> {
    let marker_path = server_apply_in_progress_path(app_data_dir);
    fs::write(&marker_path, b"1")
        .map_err(|e| AppError::Generic(format!("Error marking apply in progress: {}", e)))
}

pub fn clear_server_apply_in_progress(app_data_dir: &Path) -> Result<(), AppError> {
    let marker_path = server_apply_in_progress_path(app_data_dir);
    if marker_path.exists() {
        fs::remove_file(&marker_path)
            .map_err(|e| AppError::Generic(format!("Error clearing apply in progress: {}", e)))?;
    }

    Ok(())
}

pub fn has_server_apply_in_progress(app_data_dir: &Path) -> bool {
    server_apply_in_progress_path(app_data_dir).exists()
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{
        clear_server_apply_in_progress, ensure_actions_cloud_dir, ensure_backup_cloud_dir,
        ensure_draft_ignored_backup_dir, has_server_apply_in_progress,
        mark_server_apply_in_progress,
    };

    #[test]
    fn creates_actions_dir() {
        let dir = tempdir().expect("temp dir");

        let actions_dir = ensure_actions_cloud_dir(dir.path()).expect("ensure actions dir");

        assert_eq!(actions_dir, dir.path().join("cloud").join("actions"));
        assert!(actions_dir.exists());
    }

    #[test]
    fn creates_backup_dir_without_touching_sync_dir() {
        let dir = tempdir().expect("temp dir");

        let backup_dir = ensure_backup_cloud_dir(dir.path()).expect("ensure backup dir");

        assert_eq!(backup_dir, dir.path().join("cloud").join("backup"));
        assert!(backup_dir.exists());
    }

    #[test]
    fn creates_draft_ignored_backup_dir() {
        let dir = tempdir().expect("temp dir");

        let backup_dir =
            ensure_draft_ignored_backup_dir(dir.path()).expect("ensure draft/ignored backup dir");

        assert_eq!(
            backup_dir,
            dir.path().join("cloud").join("backup_scores_draft_ignored")
        );
        assert!(backup_dir.exists());
    }

    #[test]
    fn marks_and_clears_server_apply_in_progress() {
        let dir = tempdir().expect("temp dir");

        assert!(!has_server_apply_in_progress(dir.path()));

        mark_server_apply_in_progress(dir.path()).expect("mark in progress");
        assert!(has_server_apply_in_progress(dir.path()));

        clear_server_apply_in_progress(dir.path()).expect("clear in progress");
        assert!(!has_server_apply_in_progress(dir.path()));
    }
}
