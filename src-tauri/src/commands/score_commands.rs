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

    // Obter todas as músicas existentes para verificação de duplicatas
    let all_scores = db.get_all_scores()?;

    let now = Local::now().naive_local();

    for (title, group_files) in &groups {
        // Verificar se a música já existe (case-insensitive)
        let existing_score = all_scores.iter().find(|s| s.title.eq_ignore_ascii_case(title));
        
        let score_id = if let Some(existing) = existing_score {
            existing.id.clone()
        } else {
            // Criar nova música apenas se não existir
            let new_score_id = uuid::Uuid::new_v4().to_string();

            let score = Score {
                id: new_score_id.clone(),
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
            new_score_id
        };

        // Obter instrumentos existentes para essa música
        let existing_instruments = all_scores
            .iter()
            .find(|s| s.id == score_id)
            .map(|s| s.instruments.clone())
            .unwrap_or_default();

        for indexed_file in group_files {
            // Verificar se o instrumento já existe para essa música (case-insensitive)
            let instrument_exists = existing_instruments.iter().any(|fi| {
                match (&fi.instrument, &indexed_file.instrument) {
                    (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
                    (None, None) => true,
                    _ => false,
                }
            });

            // Pular se o instrumento já existe
            if instrument_exists {
                continue;
            }

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

#[tauri::command]
pub fn create_score(
    db: State<'_, Database>,
    title: String,
) -> Result<ScoreListItem, AppError> {
    if title.trim().is_empty() {
        return Err(AppError::Generic("Título da música não pode estar vazio".into()));
    }

    // Verificar se a música já existe
    let all_scores = db.get_all_scores()?;
    if all_scores.iter().any(|s| s.title.eq_ignore_ascii_case(&title)) {
        return Err(AppError::Generic("Uma música com esse título já existe".into()));
    }

    let now = Local::now().naive_local();
    let score_id = uuid::Uuid::new_v4().to_string();

    let score = Score {
        id: score_id.clone(),
        title: title.trim().to_string(),
        composer: None,
        arranger: None,
        category_id: None,
        tags: Vec::new(),
        favorited: false,
        created_at: now,
        updated_at: now,
    };

    db.insert_score(&score)?;

    // Obter e retornar a música recém-criada
    let all_scores = db.get_all_scores()?;
    all_scores
        .into_iter()
        .find(|s| s.id == score_id)
        .ok_or_else(|| AppError::Generic("Erro ao recuperar música criada".into()))
}

#[tauri::command]
pub fn get_search_suggestions(
    db: State<'_, Database>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<ScoreListItem>, AppError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let max_results = limit.unwrap_or(10);
    let mut scores = db.search_scores(&query)?;
    scores.truncate(max_results as usize);
    Ok(scores)
}

#[tauri::command]
pub async fn open_file(
    db: State<'_, Database>,
    score_file_id: String,
) -> Result<(), AppError> {
    // Obter as versões do arquivo
    let versions = db.get_versions_for_file(&score_file_id)?;
    
    // Buscar a versão atual (Current), ou a primeira disponível
    let version = versions
        .iter()
        .find(|v| v.status == crate::domain::models::VersionStatus::Current)
        .or_else(|| versions.first())
        .ok_or_else(|| AppError::Generic("Arquivo não encontrado".into()))?;

    // Abrir arquivo com o programa padrão do sistema
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &version.file_path])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&version.file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&version.file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }
    
    Ok(())
}
