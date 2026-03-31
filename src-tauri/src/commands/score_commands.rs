use chrono::Local;
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{get_file_metadata, split_file_path};

const VALID_SCORE_EXTENSIONS: [&str; 3] = ["pdf", "mus", "musx"];

fn score_exists_for_indexed_file(
    scores: &[ScoreListItem],
    file: &IndexedFile,
    treat_empty_instrument_as_duplicate: bool,
) -> bool {
    scores
        .iter()
        .any(|sc| match (&sc.name, &file.instrument) {
            (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
            (None, None) => {
                treat_empty_instrument_as_duplicate || sc.file_path == file.path
            }
            _ => false,
        })
}

fn build_score_from_indexed_file(
    song_id: &str,
    host_id: &str,
    file: &IndexedFile,
) -> Result<Score, AppError> {
    let (file_size, file_modified_at) = read_score_file_metadata(Path::new(&file.path))?;
    let (score_file_path, file_name) = split_file_path(&file.path);

    Ok(Score::new_from_file(
        song_id.to_string(),
        host_id.to_string(),
        file,
        score_file_path,
        file_name,
        (file_size, file_modified_at),
    ))
}

fn ensure_supported_score_file(path: &Path) -> Result<(), AppError> {
    if !path.exists() || !path.is_file() {
        warn!("Arquivo não encontrado: {}", path.display());
        return Err(AppError::Generic("Arquivo não encontrado".into()));
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or_else(|| AppError::Generic("Extensão de arquivo inválida".into()))?
        .to_lowercase();

    if !VALID_SCORE_EXTENSIONS.contains(&extension.as_str()) {
        warn!("Extensão de arquivo não suportada: {}", extension);
        return Err(AppError::Generic("Tipo de arquivo não suportado".into()));
    }

    Ok(())
}

fn read_score_file_metadata(path: &Path) -> Result<(u64, chrono::NaiveDateTime), AppError> {
    get_file_metadata(path).map_err(|e| {
        error!("Erro ao obter metadados do arquivo: {:?}", e);
        AppError::Generic(format!("Erro ao ler arquivo: {}", e))
    })
}

#[tauri::command]
pub fn update_score(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
    instrument_name: Option<String>,
    file_path: String,
) -> Result<(), AppError> {
    info!(
        "Atualizando partitura: {} com arquivo: {}",
        score_id, file_path
    );

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let path = Path::new(&file_path);
    ensure_supported_score_file(path)?;

    let now = Local::now().naive_local();

    let (file_size, file_modified_at) = read_score_file_metadata(path)?;

    let (score_file_path, file_name) = split_file_path(&file_path);

    db.update_score(
        &score_id,
        instrument_name.clone(),
        &score_file_path,
        &file_name,
        file_size,
        file_modified_at,
        now,
        &settings.computer_id,
    )
    .map(|_| {
        info!("Partitura atualizada com sucesso: {}", score_id);
    })
    .map_err(|e| {
        error!("Erro ao atualizar partitura {}: {:?}", score_id, e);
        e
    })
}

#[tauri::command]
pub fn add_score_to_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    file: IndexedFile,
) -> Result<SongListItem, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let song = db.get_song_list_item_by_id(&song_id)?;

    // Verificar se o instrumento já existe (case-insensitive)
    let score_exists = score_exists_for_indexed_file(&song.scores, &file, true);

    if score_exists {
        return Err(AppError::Generic(format!(
            "Uma partitura com o instrumento '{}' já existe para essa música",
            file.instrument.as_deref().unwrap_or("Sem instrumento")
        )));
    }

    let score = build_score_from_indexed_file(&song_id, &settings.computer_id, &file)?;

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
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let song = db.get_song_list_item_by_id(&song_id)?;
    let existing_scores = song.scores.clone();
    let mut added_count = 0;

    for file in files {
        let score_exists = score_exists_for_indexed_file(&existing_scores, &file, false);

        if score_exists {
            continue;
        }

        let score = build_score_from_indexed_file(&song_id, &settings.computer_id, &file)?;

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
pub async fn open_file(db: State<'_, Database>, score_id: String) -> Result<(), AppError> {
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
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    info!(
        "Atualizando status da partitura: {} para: {}",
        score_id, status
    );
    let song_id = db.get_song_id_for_score(&score_id)?;
    let song = db.get_song_list_item_by_id(&song_id)?;
    let current_score = song
        .scores
        .iter()
        .find(|sc| sc.id == score_id)
        .ok_or_else(|| AppError::ScoreNotFound(score_id.clone()))?;

    if status.to_lowercase() != "main" {
        warn!("Fluxo inválido de status manual solicitado: {}", status);
        return Err(AppError::Generic(
            "Apenas a mudança para 'main' é permitida manualmente".into(),
        ));
    }

    if current_score.status != ScoreStatus::Draft {
        warn!(
            "Tentativa de definir score {} como main fora do fluxo draft -> main",
            score_id
        );
        return Err(AppError::Generic(
            "A partitura precisa estar como 'draft' para ser definida como 'main'".into(),
        ));
    }

    db.update_score_status(&score_id, ScoreStatus::Main, &settings.computer_id, None)?;

    info!(
        "Status da partitura {} atualizado com sucesso para {}",
        score_id, status
    );
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn delete_score(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    info!("Deletando partitura: {}", score_id);
    db.delete_score(&score_id)
        .map(|_| {
            info!("Partitura deletada com sucesso: {}", score_id);
        })
        .map_err(|e| {
            error!("Erro ao deletar partitura: {:?}", e);
            e
        })
}
