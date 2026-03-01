use std::path::Path;
use tauri::{State, Manager};
use chrono::Local;

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::services::indexer;
use crate::services::versioning;

#[tauri::command]
pub fn get_all_scores(db: State<'_, Database>) -> Result<Vec<ScoreListItem>, AppError> {
    db.get_all_scores()
}

#[tauri::command]
pub fn get_favorited_scores(db: State<'_, Database>) -> Result<Vec<ScoreListItem>, AppError> {
    db.get_favorited_scores()
}

#[tauri::command]
pub fn get_scores_with_drafts(db: State<'_, Database>) -> Result<Vec<ScoreListItem>, AppError> {
    db.get_scores_with_drafts()
}

#[tauri::command]
pub fn search_scores(db: State<'_, Database>, query: String) -> Result<Vec<ScoreListItem>, AppError> {
    if query.trim().is_empty() {
        return db.get_all_scores();
    }
    db.search_scores(&query)
}

#[tauri::command]
pub fn toggle_favorite(db: State<'_, Database>, score_id: String) -> Result<bool, AppError> {
    db.toggle_favorite(&score_id)
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
pub fn import_indexed_files(
    db: State<'_, Database>,
    app_handle: tauri::AppHandle,
    files: Vec<IndexedFile>,
    category_id: Option<String>,
) -> Result<Vec<ScoreListItem>, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| AppError::Generic("Não foi possível obter diretório de dados".into()))?;

    let settings = db.get_app_settings()?;

    // Agrupar arquivos por nome (uma mesma música pode ter vários instrumentos)
    let mut groups: std::collections::HashMap<String, Vec<&IndexedFile>> = std::collections::HashMap::new();
    for file in &files {
        groups.entry(file.name.clone()).or_default().push(file);
    }

    let now = Local::now().naive_local();

    for (title, group_files) in &groups {
        let score_id = uuid::Uuid::new_v4().to_string();

        let score = Score {
            id: score_id.clone(),
            title: title.clone(),
            composer: None,
            arranger: None,
            category_id: category_id.clone(),
            tags: Vec::new(),
            favorited: false,
            created_at: now,
            updated_at: now,
        };

        db.insert_score(&score)?;

        for indexed_file in group_files {
            let file_id = uuid::Uuid::new_v4().to_string();
            let hash = if settings.hash_enabled {
                crate::services::hasher::hash_file(Path::new(&indexed_file.path)).ok()
            } else {
                None
            };

            let score_file = ScoreFile {
                id: file_id.clone(),
                score_id: score_id.clone(),
                instrument: indexed_file.instrument.clone(),
                original_path: indexed_file.path.clone(),
                file_extension: indexed_file.extension.clone(),
                file_size: indexed_file.size,
                hash,
                created_at: now,
                updated_at: now,
            };

            db.insert_score_file(&score_file)?;

            // Armazenar versão inicial
            versioning::store_initial_version(&db, &app_data_dir, &score_file, settings.hash_enabled)?;
        }
    }

    db.get_all_scores()
}

#[tauri::command]
pub fn get_scores_by_category(
    db: State<'_, Database>,
    category_id: String,
) -> Result<Vec<ScoreListItem>, AppError> {
    db.get_scores_by_category(&category_id)
}
