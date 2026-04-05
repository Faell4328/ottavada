use chrono::Local;
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

use crate::commands::common::require_server_settings;
use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{self, get_file_metadata, paths_match};
use crate::services::name_formatter::{normalize_optional_score_name, normalize_song_name};

fn normalized_required_song_name(name: &str) -> Result<String, AppError> {
    let normalized = normalize_song_name(name);
    if normalized.is_empty() {
        return Err(AppError::Generic(
            "Nome da música não pode estar vazio".into(),
        ));
    }
    Ok(normalized)
}

fn normalized_optional_text(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn normalized_optional_text_ref(value: Option<&str>) -> Option<String> {
    value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn ensure_unique_song_name(
    songs: &[SongListItem],
    song_name: &str,
    except_song_id: Option<&str>,
) -> Result<(), AppError> {
    let has_conflict = songs.iter().any(|song| {
        let different_song = except_song_id.map(|id| song.id != id).unwrap_or(true);
        different_song && song.name.eq_ignore_ascii_case(song_name)
    });

    if has_conflict {
        return Err(AppError::Generic("Uma música com esse nome já existe".into()));
    }

    Ok(())
}

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
    run_song_query_with_logging("Busca de todas as músicas concluída", || {
        db.get_all_songs()
    })
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
    song_id: String,
) -> Result<bool, AppError> {
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
        let song_name = normalize_song_name(&file.name);
        if song_name.is_empty() {
            continue;
        }

        groups.entry(song_name).or_default().push(file);
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
                composer: normalized_optional_text_ref(composer),
                arranger: normalized_optional_text_ref(arranger),
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

        let mut known_named_instruments: Vec<String> = existing_scores
            .iter()
            .filter_map(|score| score.name.as_ref().map(|name| name.to_lowercase()))
            .collect();
        let mut known_unnamed_paths: Vec<String> = existing_scores
            .iter()
            .filter(|score| score.name.is_none())
            .map(|score| score.file_path.clone())
            .collect();

        for indexed_file in group_files {
            let normalized_instrument =
                normalize_optional_score_name(indexed_file.instrument.as_deref());

            let score_exists = match &normalized_instrument {
                Some(instrument) => known_named_instruments
                    .iter()
                    .any(|existing| existing.eq_ignore_ascii_case(instrument)),
                None => known_unnamed_paths
                    .iter()
                    .any(|existing_path| paths_match(existing_path, &indexed_file.path)),
            };

            if score_exists {
                continue;
            }

            let (file_size, file_modified_at) =
                match get_file_metadata(Path::new(&indexed_file.path)) {
                    Ok(metadata) => metadata,
                    Err(e) => {
                        warn!(
                            "Erro ao obter metadados do arquivo {}: {:?}",
                            indexed_file.path, e
                        );
                        (0, now)
                    }
                };

            let (score_file_path, file_name) =
                crate::services::indexer::split_file_path(&indexed_file.path);

            let normalized_file = IndexedFile {
                instrument: normalized_instrument.clone(),
                ..(*indexed_file).clone()
            };

            let score = Score::new_from_file(
                song_id.clone(),
                host_id.to_string(),
                &normalized_file,
                score_file_path,
                file_name,
                (file_size, file_modified_at),
            );

            db.insert_score(&score)?;

            if let Some(instrument) = normalized_instrument {
                known_named_instruments.push(instrument);
            } else {
                known_unnamed_paths.push(indexed_file.path.clone());
            }
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
    let settings = require_server_settings(&store)?;

    import_files_core(
        &db,
        &settings.computer_id,
        &files,
        &category_ids,
        None,
        None,
    )
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
    let settings = require_server_settings(&store)?;
    info!(
        "Importando arquivos indexados com metadados: files={}, categories={}, composer_set={}, arranger_set={}",
        files.len(),
        category_ids.len(),
        composer.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false),
        arranger.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false)
    );

    import_files_core(
        &db,
        &settings.computer_id,
        &files,
        &category_ids,
        composer.as_deref(),
        arranger.as_deref(),
    )
    .map(|songs| {
        info!(
            "Importação de arquivos concluída com sucesso: músicas retornadas={}",
            songs.len()
        );
        songs
    })
    .map_err(|e| {
        error!("Erro ao importar arquivos indexados: {:?}", e);
        e
    })
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
    let settings = require_server_settings(store)?;

    let normalized_name = normalized_required_song_name(name)?;

    let all_songs = db.get_all_songs()?;
    ensure_unique_song_name(&all_songs, &normalized_name, None)?;

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
    let normalized_name = normalized_required_song_name(&name)?;
    let updated_by = validate_server_create_song(&db, &store, &normalized_name)?;
    let now = Local::now().naive_local();
    let song_id = uuid::Uuid::new_v4().to_string();

    info!("Criando nova música: {}", normalized_name);
    let song = Song {
        id: song_id.clone(),
        name: normalized_name,
        composer: normalized_optional_text(composer),
        arranger: normalized_optional_text(arranger),
        is_favorite: false,
        status: ScoreStatus::Main,
        updated_at: now,
        updated_by,
    };

    db.insert_song(&song, &category_ids)
        .map_err(|e| {
            error!(
                "Erro ao criar música '{}' (id={}): {:?}",
                song.name, song_id, e
            );
            e
        })?;

    db.get_song_list_item_by_id(&song_id).map(|created| {
        info!("Música criada com sucesso: {} ({})", created.name, created.id);
        created
    })
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
    let normalized_name = normalized_required_song_name(&name)?;

    let settings = require_server_settings(&store)?;
    let updated_by = settings.computer_id.clone();

    let all_songs = db.get_all_songs()?;
    ensure_unique_song_name(&all_songs, &normalized_name, Some(&song_id))?;

    info!("Atualizando música: {} -> {}", song_id, normalized_name);
    let original_song = db.get_song_by_id(&song_id)?;
    let now = Local::now().naive_local();

    let updated_song = Song {
        id: original_song.id.clone(),
        name: normalized_name,
        composer: normalized_optional_text(composer),
        arranger: normalized_optional_text(arranger),
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
    require_server_settings(&store)?;

    info!("Deletando música: {}", song_id);

    db.delete_song(&song_id)?;

    let archive_path = store
        .app_data_dir()
        .join("cloud")
        .join("songs")
        .join(format!("{}.tar.zst", song_id));
    if archive_path.is_file() {
        std::fs::remove_file(&archive_path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao deletar arquivo compactado da música '{}': {}",
                archive_path.display(),
                e
            ))
        })?;
    }

    info!("Música deletada com sucesso: {}", song_id);
    Ok(())
}
