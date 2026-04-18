use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::errors::AppError;

pub const CLOUD_DIR_NAME: &str = "cloud";
pub const CLOUD_SYNC_DIR_NAME: &str = "sync";
pub const CLOUD_ACTIONS_DIR_NAME: &str = "actions";
pub const CLOUD_BACKUP_DIR_NAME: &str = "backup";
const SERVER_APPLY_IN_PROGRESS_FILE_NAME: &str = "server-apply-in-progress.lock";

pub fn ensure_cloud_root_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = app_data_dir.join(CLOUD_DIR_NAME);
    fs::create_dir_all(&cloud_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao preparar pasta local cloud: {}", e)))?;
    Ok(cloud_dir)
}

pub fn ensure_sync_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let sync_dir = cloud_dir.join(CLOUD_SYNC_DIR_NAME);

    fs::create_dir_all(&sync_dir).map_err(|e| {
        AppError::Generic(format!("Erro ao preparar pasta local de sincronização da nuvem: {}", e))
    })?;

    Ok(sync_dir)
}

pub fn ensure_actions_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let actions_dir = cloud_dir.join(CLOUD_ACTIONS_DIR_NAME);

    fs::create_dir_all(&actions_dir).map_err(|e| {
        AppError::Generic(format!("Erro ao preparar pasta local de ações da nuvem: {}", e))
    })?;

    Ok(actions_dir)
}

pub fn ensure_backup_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let backup_dir = cloud_dir.join(CLOUD_BACKUP_DIR_NAME);

    fs::create_dir_all(&backup_dir).map_err(|e| {
        AppError::Generic(format!("Erro ao preparar pasta local de backup da nuvem: {}", e))
    })?;

    Ok(backup_dir)
}

pub fn server_apply_in_progress_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SERVER_APPLY_IN_PROGRESS_FILE_NAME)
}

pub fn mark_server_apply_in_progress(app_data_dir: &Path) -> Result<(), AppError> {
    let marker_path = server_apply_in_progress_path(app_data_dir);
    fs::write(&marker_path, b"1")
        .map_err(|e| AppError::Generic(format!("Erro ao marcar apply em andamento: {}", e)))
}

pub fn clear_server_apply_in_progress(app_data_dir: &Path) -> Result<(), AppError> {
    let marker_path = server_apply_in_progress_path(app_data_dir);
    if marker_path.exists() {
        fs::remove_file(&marker_path).map_err(|e| {
            AppError::Generic(format!("Erro ao limpar apply em andamento: {}", e))
        })?;
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
        ensure_sync_cloud_dir, has_server_apply_in_progress, mark_server_apply_in_progress,
    };

    #[test]
    fn creates_sync_dir() {
        let dir = tempdir().expect("temp dir");

        let sync_dir = ensure_sync_cloud_dir(dir.path()).expect("ensure sync dir");

        assert_eq!(sync_dir, dir.path().join("cloud").join("sync"));
        assert!(sync_dir.exists());
    }

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
    fn marks_and_clears_server_apply_in_progress() {
        let dir = tempdir().expect("temp dir");

        assert!(!has_server_apply_in_progress(dir.path()));

        mark_server_apply_in_progress(dir.path()).expect("mark in progress");
        assert!(has_server_apply_in_progress(dir.path()));

        clear_server_apply_in_progress(dir.path()).expect("clear in progress");
        assert!(!has_server_apply_in_progress(dir.path()));
    }
}