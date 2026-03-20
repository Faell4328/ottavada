use std::path::Path;
use tauri::State;
use chrono::Local;
use tracing::{info, warn, error};

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::get_file_metadata;

#[tauri::command]
pub fn update_score(
    db: State<'_, Database>,
    score_id: String,
    instrument_name: Option<String>,
    file_path: String,
) -> Result<(), AppError> {
    info!("Atualizando partitura: {} com arquivo: {}", score_id, file_path);
    let path = Path::new(&file_path);
    if !path.exists() || !path.is_file() {
        warn!("Arquivo não encontrado: {}", file_path);
        return Err(AppError::Generic("Arquivo não encontrado".into()));
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or_else(|| AppError::Generic("Extensão de arquivo inválida".into()))?
        .to_lowercase();

    let valid_extensions = ["pdf", "mus", "musx"];
    if !valid_extensions.contains(&extension.as_str()) {
        warn!("Extensão de arquivo não suportada: {}", extension);
        return Err(AppError::Generic("Tipo de arquivo não suportado".into()));
    }

    let now = Local::now().naive_local();

    let (file_size, file_modified_at) = get_file_metadata(path)
        .map_err(|e| {
            error!("Erro ao obter metadados do arquivo: {:?}", e);
            AppError::Generic(format!("Erro ao ler arquivo: {}", e))
        })?;

    let (directory_id, file_name) = db.resolve_directory_for_path(&file_path)?;

    match db.update_score(&score_id, instrument_name.clone(), &directory_id, &file_name, file_size, file_modified_at, now) {
        Ok(_) => {
            info!("Partitura atualizada com sucesso: {}", score_id);
            Ok(())
        }
        Err(e) => {
            error!("Erro ao atualizar partitura {}: {:?}", score_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn add_score_to_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    file: IndexedFile,
) -> Result<SongListItem, AppError> {
    let song = db.get_song_list_item_by_id(&song_id)?;

    // Verificar se o instrumento já existe (case-insensitive)
    let score_exists = song.scores.iter().any(|sc| {
        match (&sc.name, &file.instrument) {
            (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
            (None, None) => true,
            _ => false,
        }
    });

    if score_exists {
        return Err(AppError::Generic(format!(
            "Uma partitura com o instrumento '{}' já existe para essa música",
            file.instrument.as_deref().unwrap_or("Sem instrumento")
        )));
    }

    let settings = store.get_app_settings()?;
    let now = Local::now().naive_local();

    let (file_size, file_modified_at) = get_file_metadata(Path::new(&file.path))
        .map_err(|e| {
            error!("Erro ao obter metadados do arquivo: {:?}", e);
            AppError::Generic(format!("Erro ao ler arquivo: {}", e))
        })?;

    let (directory_id, file_name) = db.resolve_directory_for_path(&file.path)?;

    let score = Score {
        id: uuid::Uuid::new_v4().to_string(),
        song_id: song_id.clone(),
        name: file.instrument.clone(),
        host_id: settings.computer_id.clone(),
        directory_id,
        file_name,
        file_size,
        file_modified_at,
        updated_at: now,
        status: ScoreStatus::Main,
        updated_by: settings.computer_id.clone(),
    };

    db.insert_score(&score)?;
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn add_scores_to_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    files: Vec<IndexedFile>,
) -> Result<SongListItem, AppError> {
    let song = db.get_song_list_item_by_id(&song_id)?;

    let settings = store.get_app_settings()?;
    let now = Local::now().naive_local();
    let existing_scores = song.scores.clone();
    let mut added_count = 0;

    for file in files {
        let score_exists = existing_scores.iter().any(|sc| {
            match (&sc.name, &file.instrument) {
                (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
                (None, None) => sc.file_path == file.path,
                _ => false,
            }
        });

        if score_exists {
            continue;
        }

        let (file_size, file_modified_at) = get_file_metadata(Path::new(&file.path))
            .map_err(|e| {
                error!("Erro ao obter metadados do arquivo: {:?}", e);
                AppError::Generic(format!("Erro ao ler arquivo: {}", e))
            })?;

        let (directory_id, file_name) = db.resolve_directory_for_path(&file.path)?;

        let score = Score {
            id: uuid::Uuid::new_v4().to_string(),
            song_id: song_id.clone(),
            name: file.instrument.clone(),
            host_id: settings.computer_id.clone(),
            directory_id,
            file_name,
            file_size,
            file_modified_at,
            updated_at: now,
            status: ScoreStatus::Main,
            updated_by: settings.computer_id.clone(),
        };

        db.insert_score(&score)?;
        added_count += 1;
    }

    if added_count == 0 {
        return Err(AppError::Generic(
            "Todos os arquivos deste diretório já existem para essa música".into(),
        ));
    }

    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub async fn open_file(
    db: State<'_, Database>,
    score_id: String,
) -> Result<(), AppError> {
    let file_path = db.get_score_file_path(&score_id)?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &file_path])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_score_status(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
    status: String,
) -> Result<SongListItem, AppError> {
    info!("Atualizando status da partitura: {} para: {}", score_id, status);

    let settings = store.get_app_settings()?;
    let updated_by = settings.computer_id.clone();

    let score_status = match status.to_lowercase().as_str() {
        "main" => ScoreStatus::Main,
        "draft" => ScoreStatus::Draft,
        "pending" => ScoreStatus::Pending,
        _ => {
            warn!("Status inválido: {}", status);
            return Err(AppError::Generic(format!("Status inválido: {}", status)));
        }
    };

    db.set_score_status(&score_id, score_status, &updated_by)?;

    // Buscar a música que contém este score
    let all_songs = db.get_all_songs()?;
    let song = all_songs
        .iter()
        .find(|s| s.scores.iter().any(|sc| sc.id == score_id))
        .ok_or_else(|| AppError::Generic("Score não encontrado".into()))?;

    info!("Status da partitura {} atualizado com sucesso para {}", score_id, status);
    Ok(song.clone())
}

#[tauri::command]
pub fn delete_score(
    db: State<'_, Database>,
    score_id: String,
) -> Result<(), AppError> {
    info!("Deletando partitura: {}", score_id);
    match db.delete_score(&score_id) {
        Ok(_) => {
            info!("Partitura deletada com sucesso: {}", score_id);
            Ok(())
        }
        Err(e) => {
            error!("Erro ao deletar partitura: {:?}", e);
            Err(e)
        }
    }
}
