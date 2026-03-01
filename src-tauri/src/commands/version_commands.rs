use std::path::Path;
use tauri::{State, Manager};

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::services::versioning;

#[tauri::command]
pub fn get_versions(
    db: State<'_, Database>,
    score_file_id: String,
) -> Result<Vec<FileVersion>, AppError> {
    db.get_versions_for_file(&score_file_id)
}

#[tauri::command]
pub fn promote_draft(
    db: State<'_, Database>,
    version_id: String,
) -> Result<(), AppError> {
    versioning::promote_draft(&db, &version_id)
}

#[tauri::command]
pub fn delete_version(
    db: State<'_, Database>,
    version_id: String,
) -> Result<(), AppError> {
    db.delete_version(&version_id)
}

#[tauri::command]
pub fn create_draft(
    db: State<'_, Database>,
    app_handle: tauri::AppHandle,
    score_file_id: String,
    source_path: String,
) -> Result<FileVersion, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| AppError::Generic("Não foi possível obter diretório de dados".into()))?;

    let settings = db.get_app_settings()?;

    versioning::create_draft(
        &db,
        &app_data_dir,
        &score_file_id,
        Path::new(&source_path),
        settings.hash_enabled,
    )
}
