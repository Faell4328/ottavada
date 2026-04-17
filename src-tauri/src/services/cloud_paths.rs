use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::errors::AppError;

pub const CLOUD_DIR_NAME: &str = "cloud";
pub const CLOUD_SYNC_DIR_NAME: &str = "sync";
pub const CLOUD_BACKUP_DIR_NAME: &str = "backup";

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

pub fn ensure_backup_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = ensure_cloud_root_dir(app_data_dir)?;
    let backup_dir = cloud_dir.join(CLOUD_BACKUP_DIR_NAME);

    fs::create_dir_all(&backup_dir).map_err(|e| {
        AppError::Generic(format!("Erro ao preparar pasta local de backup da nuvem: {}", e))
    })?;

    Ok(backup_dir)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{ensure_backup_cloud_dir, ensure_sync_cloud_dir};

    #[test]
    fn creates_sync_dir() {
        let dir = tempdir().expect("temp dir");

        let sync_dir = ensure_sync_cloud_dir(dir.path()).expect("ensure sync dir");

        assert_eq!(sync_dir, dir.path().join("cloud").join("sync"));
        assert!(sync_dir.exists());
    }

    #[test]
    fn creates_backup_dir_without_touching_sync_dir() {
        let dir = tempdir().expect("temp dir");

        let backup_dir = ensure_backup_cloud_dir(dir.path()).expect("ensure backup dir");

        assert_eq!(backup_dir, dir.path().join("cloud").join("backup"));
        assert!(backup_dir.exists());
    }
}