use std::path::Path;
use tauri::State;
use chrono::Local;

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::services::indexer;

#[tauri::command]
pub fn get_all_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_all_songs()
}

#[tauri::command]
pub fn get_favorited_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_favorited_songs()
}

#[tauri::command]
pub fn get_songs_with_drafts(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_with_drafts()
}

#[tauri::command]
pub fn search_songs(db: State<'_, Database>, query: String) -> Result<Vec<SongListItem>, AppError> {
    if query.trim().is_empty() {
        return db.get_all_songs();
    }
    db.search_songs(&query)
}

#[tauri::command]
pub fn toggle_favorite(db: State<'_, Database>, song_id: String) -> Result<bool, AppError> {
    db.toggle_favorite(&song_id)
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
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
) -> Result<Vec<SongListItem>, AppError> {
    let settings = db.get_app_settings()?;
    let now = Local::now().naive_local();

    // Agrupar arquivos por nome (uma mesma música pode ter vários instrumentos)
    let mut groups: std::collections::HashMap<String, Vec<&IndexedFile>> =
        std::collections::HashMap::new();
    for file in &files {
        groups.entry(file.name.clone()).or_default().push(file);
    }

    // Obter todas as músicas existentes para verificação de duplicatas
    let all_songs = db.get_all_songs()?;

    for (song_name, group_files) in &groups {
        // Verificar se a música já existe (case-insensitive)
        let existing_song = all_songs
            .iter()
            .find(|s| s.name.eq_ignore_ascii_case(song_name));

        let song_id = if let Some(existing) = existing_song {
            existing.id.clone()
        } else {
            let new_song_id = uuid::Uuid::new_v4().to_string();
            let song = Song {
                id: new_song_id.clone(),
                name: song_name.clone(),
                composer: None,
                arranger: None,
                is_favorite: false,
                updated_at: now,
            };
            db.insert_song(&song, &category_ids)?;
            new_song_id
        };

        // Obter partituras existentes para essa música
        let existing_scores = all_songs
            .iter()
            .find(|s| s.id == song_id)
            .map(|s| s.scores.clone())
            .unwrap_or_default();

        for indexed_file in group_files {
            // Verificar se o instrumento já existe (case-insensitive)
            let score_exists = existing_scores.iter().any(|sc| {
                match (&sc.name, &indexed_file.instrument) {
                    (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
                    (None, None) => sc.file_path == indexed_file.path,
                    _ => false,
                }
            });

            if score_exists {
                continue;
            }

            let score = Score {
                id: uuid::Uuid::new_v4().to_string(),
                song_id: song_id.clone(),
                name: indexed_file.instrument.clone(),
                host_id: settings.computer_id.clone(),
                file_path: indexed_file.path.clone(),
                updated_at: now,
                status: ScoreStatus::Main,
            };

            db.insert_score(&score)?;
        }
    }

    db.get_all_songs()
}

#[tauri::command]
pub fn import_indexed_files_with_metadata(
    db: State<'_, Database>,
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
    composer: Option<String>,
    arranger: Option<String>,
) -> Result<Vec<SongListItem>, AppError> {
    let settings = db.get_app_settings()?;
    let now = Local::now().naive_local();

    // Agrupar arquivos por nome (uma mesma música pode ter vários instrumentos)
    let mut groups: std::collections::HashMap<String, Vec<&IndexedFile>> =
        std::collections::HashMap::new();
    for file in &files {
        groups.entry(file.name.clone()).or_default().push(file);
    }

    // Obter todas as músicas existentes para verificação de duplicatas
    let all_songs = db.get_all_songs()?;

    for (song_name, group_files) in &groups {
        // Verificar se a música já existe (case-insensitive)
        let existing_song = all_songs
            .iter()
            .find(|s| s.name.eq_ignore_ascii_case(song_name));

        let song_id = if let Some(existing) = existing_song {
            existing.id.clone()
        } else {
            let new_song_id = uuid::Uuid::new_v4().to_string();
            let song = Song {
                id: new_song_id.clone(),
                name: song_name.clone(),
                composer: composer.clone(),
                arranger: arranger.clone(),
                is_favorite: false,
                updated_at: now,
            };
            db.insert_song(&song, &category_ids)?;
            new_song_id
        };

        // Obter partituras existentes para essa música
        let existing_scores = all_songs
            .iter()
            .find(|s| s.id == song_id)
            .map(|s| s.scores.clone())
            .unwrap_or_default();

        for indexed_file in group_files {
            // Verificar se o instrumento já existe (case-insensitive)
            let score_exists = existing_scores.iter().any(|sc| {
                match (&sc.name, &indexed_file.instrument) {
                    (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
                    (None, None) => sc.file_path == indexed_file.path,
                    _ => false,
                }
            });

            if score_exists {
                continue;
            }

            let score = Score {
                id: uuid::Uuid::new_v4().to_string(),
                song_id: song_id.clone(),
                name: indexed_file.instrument.clone(),
                host_id: settings.computer_id.clone(),
                file_path: indexed_file.path.clone(),
                updated_at: now,
                status: ScoreStatus::Main,
            };

            db.insert_score(&score)?;
        }
    }

    db.get_all_songs()
}

#[tauri::command]
pub fn get_songs_by_category(
    db: State<'_, Database>,
    category_id: String,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_by_category(&category_id)
}

#[tauri::command]
pub fn create_song(
    db: State<'_, Database>,
    name: String,
) -> Result<SongListItem, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Generic(
            "Nome da música não pode estar vazio".into(),
        ));
    }

    let all_songs = db.get_all_songs()?;
    if all_songs.iter().any(|s| s.name.eq_ignore_ascii_case(&name)) {
        return Err(AppError::Generic(
            "Uma música com esse nome já existe".into(),
        ));
    }

    let now = Local::now().naive_local();
    let song_id = uuid::Uuid::new_v4().to_string();

    let song = Song {
        id: song_id.clone(),
        name: name.trim().to_string(),
        composer: None,
        arranger: None,
        is_favorite: false,
        updated_at: now,
    };

    db.insert_song(&song, &[])?;

    let all_songs = db.get_all_songs()?;
    all_songs
        .into_iter()
        .find(|s| s.id == song_id)
        .ok_or_else(|| AppError::Generic("Erro ao recuperar música criada".into()))
}

#[tauri::command]
pub fn update_song(
    db: State<'_, Database>,
    song_id: String,
    name: String,
    composer: Option<String>,
    arranger: Option<String>,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Generic(
            "Nome da música não pode estar vazio".into(),
        ));
    }

    let all_songs = db.get_all_songs()?;
    if all_songs
        .iter()
        .any(|s| s.id != song_id && s.name.eq_ignore_ascii_case(&name))
    {
        return Err(AppError::Generic(
            "Uma música com esse nome já existe".into(),
        ));
    }

    let original_song = db.get_song_by_id(&song_id)?;
    let now = Local::now().naive_local();

    let updated_song = Song {
        id: original_song.id.clone(),
        name: name.trim().to_string(),
        composer: composer
            .map(|c| c.trim().to_string())
            .filter(|c| !c.is_empty()),
        arranger: arranger
            .map(|a| a.trim().to_string())
            .filter(|a| !a.is_empty()),
        is_favorite: original_song.is_favorite,
        updated_at: now,
    };

    db.update_song(&updated_song, &category_ids)?;

    let all_songs = db.get_all_songs()?;
    all_songs
        .into_iter()
        .find(|s| s.id == song_id)
        .ok_or_else(|| AppError::Generic("Erro ao recuperar música atualizada".into()))
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
