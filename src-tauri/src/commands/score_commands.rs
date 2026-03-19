use std::path::Path;
use tauri::State;
use chrono::Local;
use tracing::{info, warn, error};

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;

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
    match db.update_score(&score_id, instrument_name.clone(), &file_path, now) {
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
    let all_songs = db.get_all_songs()?;
    let song = all_songs
        .iter()
        .find(|s| s.id == song_id)
        .ok_or_else(|| AppError::Generic("Música não encontrada".into()))?;

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

    let score = Score {
        id: uuid::Uuid::new_v4().to_string(),
        song_id: song_id.clone(),
        name: file.instrument.clone(),
        host_id: settings.computer_id.clone(),
        file_path: file.path.clone(),
        updated_at: now,
        status: ScoreStatus::Main,
    };

    db.insert_score(&score)?;

    let all_songs = db.get_all_songs()?;
    all_songs
        .into_iter()
        .find(|s| s.id == song_id)
        .ok_or_else(|| AppError::Generic("Erro ao recuperar música atualizada".into()))
}

#[tauri::command]
pub fn add_scores_to_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    files: Vec<IndexedFile>,
) -> Result<SongListItem, AppError> {
    let all_songs = db.get_all_songs()?;
    let song = all_songs
        .iter()
        .find(|s| s.id == song_id)
        .ok_or_else(|| AppError::Generic("Música não encontrada".into()))?;

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

        let score = Score {
            id: uuid::Uuid::new_v4().to_string(),
            song_id: song_id.clone(),
            name: file.instrument.clone(),
            host_id: settings.computer_id.clone(),
            file_path: file.path.clone(),
            updated_at: now,
            status: ScoreStatus::Main,
        };

        db.insert_score(&score)?;
        added_count += 1;
    }

    if added_count == 0 {
        return Err(AppError::Generic(
            "Todos os arquivos deste diretório já existem para essa música".into(),
        ));
    }

    let all_songs = db.get_all_songs()?;
    all_songs
        .into_iter()
        .find(|s| s.id == song_id)
        .ok_or_else(|| AppError::Generic("Erro ao recuperar música atualizada".into()))
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
