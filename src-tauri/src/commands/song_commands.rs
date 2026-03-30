use std::path::Path;
use tauri::State;
use chrono::Local;
use tracing::{info, warn, error};

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{self, get_file_metadata};

fn run_song_query_with_logging<F>(operation: &str, query: F) -> Result<Vec<SongListItem>, AppError>
where
    F: FnOnce() -> Result<Vec<SongListItem>, AppError>,
{
    match query() {
        Ok(songs) => {
            info!("{}: {} músicas", operation, songs.len());
            Ok(songs)
        }
        Err(e) => {
            error!("{}: {:?}", operation, e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn get_all_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    info!("Buscando todas as músicas");
    run_song_query_with_logging("Busca de todas as músicas concluída", || db.get_all_songs())
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
#[allow(dead_code)]
pub fn get_songs_with_not_found(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_with_not_found()
}

#[tauri::command]
pub fn search_songs(db: State<'_, Database>, query: String) -> Result<Vec<SongListItem>, AppError> {
    if query.trim().is_empty() {
        info!("Busca vazia, retornando todas as músicas");
        return run_song_query_with_logging("Busca vazia", || db.get_all_songs());
    }
    info!("Buscando músicas com query: '{}'", query);
    run_song_query_with_logging("Busca por músicas concluída", || db.search_songs(&query))
}

#[tauri::command]
pub fn toggle_favorite(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<bool, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    info!("Alternando favorito para música: {}", song_id);
    match db.toggle_favorite(&song_id) {
        Ok(is_now_favorite) => {
            info!("Música {} agora é favorita: {}", song_id, is_now_favorite);
            Ok(is_now_favorite)
        }
        Err(e) => {
            error!("Erro ao alternar favorito para {}: {:?}", song_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn scan_directory(directory: String) -> Result<Vec<IndexedFile>, AppError> {
    let path = Path::new(&directory);
    if !path.is_dir() {
        return Err(AppError::InvalidDirectory(directory));
    }
    Ok(indexer::scan_directory(path))
}

/// Importa arquivos indexados, agrupando por nome da música.
/// Músicas existentes (case-insensitive) não são duplicadas.
fn import_files_core(
    db: &Database,
    host_id: &str,
    files: &[IndexedFile],
    category_ids: &[String],
    composer: Option<&str>,
    arranger: Option<&str>,
) -> Result<Vec<SongListItem>, AppError> {
    let now = Local::now().naive_local();

    // Agrupar arquivos por nome da música
    let mut groups: std::collections::HashMap<String, Vec<&IndexedFile>> =
        std::collections::HashMap::new();
    for file in files {
        groups.entry(file.name.clone()).or_default().push(file);
    }

    let all_songs = db.get_all_songs()?;

    for (song_name, group_files) in &groups {
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
                composer: composer.map(|s| s.to_string()),
                arranger: arranger.map(|s| s.to_string()),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now,
                updated_by: host_id.to_string(),
            };
            db.insert_song(&song, category_ids)?;
            new_song_id
        };

        let existing_scores = all_songs
            .iter()
            .find(|s| s.id == song_id)
            .map(|s| s.scores.clone())
            .unwrap_or_default();

        for indexed_file in group_files {
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

            let (file_size, file_modified_at) = match get_file_metadata(Path::new(&indexed_file.path)) {
                Ok(metadata) => metadata,
                Err(e) => {
                    warn!("Erro ao obter metadados do arquivo {}: {:?}", indexed_file.path, e);
                    (0, now)
                }
            };

            let (score_file_path, file_name) = crate::services::indexer::split_file_path(&indexed_file.path);

            let score = Score::new_from_file(
                song_id.clone(),
                host_id.to_string(),
                &indexed_file,
                score_file_path,
                file_name,
                (file_size, file_modified_at),
            );

            db.insert_score(&score)?
        }
    }

    db.get_all_songs()
}

#[tauri::command]
pub fn import_indexed_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
) -> Result<Vec<SongListItem>, AppError> {
    let settings = store.get_app_settings()?;
    
    // Bloquear clientes de importar arquivos
    if settings.computer_type == ComputerType::Client {
        warn!("Cliente tentou importar arquivos: operação não permitida");
        return Err(AppError::ClientOperationNotAllowed);
    }

    import_files_core(&db, &settings.computer_id, &files, &category_ids, None, None)
}

#[tauri::command]
pub fn import_indexed_files_with_metadata(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
    composer: Option<String>,
    arranger: Option<String>,
) -> Result<Vec<SongListItem>, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    import_files_core(
        &db,
        &settings.computer_id,
        &files,
        &category_ids,
        composer.as_deref(),
        arranger.as_deref(),
    )
}

#[tauri::command]
pub fn get_songs_by_category(
    db: State<'_, Database>,
    category_id: String,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_by_category(&category_id)
}

/// Verifica se é servidor e valida nome único, retornando o computer_id
fn validate_server_create_song(
    db: &Database,
    store: &SystemStore,
    name: &str,
) -> Result<String, AppError> {
    let settings = store.get_app_settings()?;

    if settings.computer_type == ComputerType::Client {
        warn!("Cliente tentou criar música: operação não permitida");
        return Err(AppError::ClientOperationNotAllowed);
    }

    if name.trim().is_empty() {
        warn!("Tentativa de criar música com nome vazio");
        return Err(AppError::Generic("Nome da música não pode estar vazio".into()));
    }

    let all_songs = db.get_all_songs()?;
    if all_songs.iter().any(|s| s.name.eq_ignore_ascii_case(name)) {
        warn!("Tentativa de criar música que já existe: {}", name);
        return Err(AppError::Generic("Uma música com esse nome já existe".into()));
    }

    Ok(settings.computer_id)
}

#[tauri::command]
pub fn create_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
) -> Result<SongListItem, AppError> {
    create_song_with_metadata(db, store, name, None, None, Vec::new())
}

#[tauri::command]
pub fn create_song_with_categories(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    create_song_with_metadata(db, store, name, None, None, category_ids)
}

#[tauri::command]
pub fn create_song_with_metadata(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    composer: Option<String>,
    arranger: Option<String>,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    let updated_by = validate_server_create_song(&db, &store, &name)?;
    let now = Local::now().naive_local();
    let song_id = uuid::Uuid::new_v4().to_string();

    info!("Criando nova música: {}", name);
    let song = Song {
        id: song_id.clone(),
        name: name.trim().to_string(),
        composer,
        arranger,
        is_favorite: false,
        status: ScoreStatus::Main,
        updated_at: now,
        updated_by,
    };

    db.insert_song(&song, &category_ids)?;
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn update_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    name: String,
    composer: Option<String>,
    arranger: Option<String>,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    if name.trim().is_empty() {
        warn!("Tentativa de atualizar música {} com nome vazio", song_id);
        return Err(AppError::Generic(
            "Nome da música não pode estar vazio".into(),
        ));
    }

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let updated_by = settings.computer_id.clone();

    let all_songs = db.get_all_songs()?;
    if all_songs
        .iter()
        .any(|s| s.id != song_id && s.name.eq_ignore_ascii_case(&name))
    {
        warn!("Tentativa de alterar música {} para nome que já existe: {}", song_id, name);
        return Err(AppError::Generic(
            "Uma música com esse nome já existe".into(),
        ));
    }

    info!("Atualizando música: {} -> {}", song_id, name);
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
        status: original_song.status,
        updated_at: now,
        updated_by,
    };

    db.update_song(&updated_song, &category_ids)?;
    db.get_song_list_item_by_id(&song_id)
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

#[tauri::command]
pub fn delete_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    info!("Deletando música: {}", song_id);
    db.delete_song(&song_id)?;
    info!("Música deletada com sucesso: {}", song_id);
    Ok(())
}
