use chrono::Local;
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};
use serde::Serialize;

use crate::commands::common::regenerate_song_archives_for_song_ids;
use crate::commands::common::remove_path_if_exists;
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

fn normalized_required_song_path(path: &str) -> Result<String, AppError> {
    let normalized = path.trim().to_string();
    if normalized.is_empty() {
        return Err(AppError::Generic(
            "Caminho da música não pode estar vazio".into(),
        ));
    }
    Ok(normalized)
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

fn refresh_library_summary_cache(
    _db: &Database,
    _store: &SystemStore,
) -> Result<(), AppError> {
    Ok(())
}

fn delete_song_core(db: &Database, store: &SystemStore, song_id: &str) -> Result<(), AppError> {
    db.delete_song(song_id)?;
    let _ = refresh_library_summary_cache(db, store);

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

    Ok(())
}

fn delete_song_with_files_core(
    db: &Database,
    store: &SystemStore,
    song_id: &str,
) -> Result<(), AppError> {
    let song = db.get_song_list_item_by_id(song_id)?;
    remove_path_if_exists(std::path::Path::new(&song.path))?;
    delete_song_core(db, store, song_id)
}

#[tauri::command]
pub fn get_all_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    info!("Buscando todas as músicas");
    run_song_query_with_logging("Busca de todas as músicas concluída", || {
        db.get_all_songs()
    })
}

#[tauri::command]
pub fn get_all_song_summaries(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    info!("Buscando resumos de todas as músicas");
    run_song_query_with_logging("Busca de resumos de músicas concluída", || {
        db.get_all_song_summaries()
    })
}

#[tauri::command]
pub fn get_favorited_songs(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_favorited_songs()
}

#[tauri::command]
pub fn get_favorited_song_summaries(
    db: State<'_, Database>,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_favorited_song_summaries()
}

#[tauri::command]
pub fn get_song_list_item_by_id(
    db: State<'_, Database>,
    song_id: String,
) -> Result<SongListItem, AppError> {
    db.get_song_list_item_by_id(&song_id)
}

#[tauri::command]
pub fn get_songs_with_drafts(db: State<'_, Database>) -> Result<Vec<SongListItem>, AppError> {
    db.get_songs_with_drafts()
}

#[tauri::command]
pub fn get_song_summaries_with_drafts(
    db: State<'_, Database>,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_song_summaries_with_drafts()
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
    require_server_settings(&store)?;
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
    store: &SystemStore,
    host_id: &str,
    files: &[IndexedFile],
    category_ids: &[String],
    composer: Option<&str>,
    arranger: Option<&str>,
    new_song_status: ScoreStatus,
) -> Result<ImportIndexedFilesResult, AppError> {
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
    let all_score_paths: Vec<String> = all_songs
        .iter()
        .flat_map(|song| song.scores.iter().map(|score| score.file_path.clone()))
        .collect();
    let mut added_count = 0;

    for (song_name, group_files) in &groups {
        let existing_song = all_songs
            .iter()
            .find(|s| s.name.eq_ignore_ascii_case(song_name));

        let existing_scores = existing_song
            .map(|s| s.scores.clone())
            .unwrap_or_default();

        let mut known_named_instruments: Vec<String> = existing_scores
            .iter()
            .filter_map(|score| score.name.as_ref().map(|name| name.to_lowercase()))
            .collect();
        let mut known_paths: Vec<String> = existing_scores
            .iter()
            .map(|score| score.file_path.clone())
            .collect();
        let mut files_to_add = Vec::new();

        for indexed_file in group_files {
            let normalized_instrument =
                normalize_optional_score_name(indexed_file.instrument.as_deref());

            let score_exists_in_library = all_score_paths
                .iter()
                .any(|existing_path| paths_match(existing_path, &indexed_file.path));

            let score_exists_in_group = known_paths
                .iter()
                .any(|existing_path| paths_match(existing_path, &indexed_file.path))
                || match &normalized_instrument {
                    Some(instrument) => known_named_instruments
                        .iter()
                        .any(|existing| existing.eq_ignore_ascii_case(instrument)),
                    None => false,
                };

            if score_exists_in_library || score_exists_in_group {
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
                status: indexed_file.status.clone(),
                ..(*indexed_file).clone()
            };

            files_to_add.push((
                normalized_file,
                score_file_path,
                file_name,
                file_size,
                file_modified_at,
            ));

            known_paths.push(indexed_file.path.clone());

            if let Some(instrument) = normalized_instrument {
                known_named_instruments.push(instrument);
            }
        }

        if files_to_add.is_empty() {
            continue;
        }

        let song_id = if let Some(existing) = existing_song {
            existing.id.clone()
        } else {
            let new_song_id = uuid::Uuid::new_v4().to_string();
            let song_path = crate::services::indexer::split_file_path(&group_files[0].path).0;
            let song = Song {
                id: new_song_id.clone(),
                name: song_name.clone(),
                composer: normalized_optional_text_ref(composer),
                arranger: normalized_optional_text_ref(arranger),
                path: song_path,
                is_favorite: false,
                status: new_song_status.clone(),
                updated_at: now,
                updated_by: host_id.to_string(),
            };
            db.insert_song(&song, category_ids)?;
            new_song_id
        };

        for (normalized_file, score_file_path, file_name, file_size, file_modified_at) in files_to_add {
            let score_status = normalized_file
                .status
                .clone()
                .unwrap_or_else(|| new_song_status.clone());
            let score = Score::new_from_file(
                song_id.clone(),
                host_id.to_string(),
                &normalized_file,
                score_file_path,
                file_name,
                (file_size, file_modified_at),
            );

            let mut score = score;
            score.status = score_status;

            db.insert_score(&score)?;
            added_count += 1;
        }

        let _ = regenerate_song_archives_for_song_ids(db, store, &[song_id.clone()]);

    }

    Ok(ImportIndexedFilesResult {
        songs: db.get_all_songs()?,
        added_count,
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportIndexedFilesResult {
    pub songs: Vec<SongListItem>,
    pub added_count: usize,
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
        &store,
        &settings.computer_id,
        &files,
        &category_ids,
        None,
        None,
        ScoreStatus::Main,
    )
    .map(|result| {
        let _ = refresh_library_summary_cache(&db, &store);
        result.songs
    })
}

#[tauri::command]
pub fn import_indexed_files_with_metadata(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    files: Vec<IndexedFile>,
    category_ids: Vec<String>,
    composer: Option<String>,
    arranger: Option<String>,
) -> Result<ImportIndexedFilesResult, AppError> {
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
        &store,
        &settings.computer_id,
        &files,
        &category_ids,
        composer.as_deref(),
        arranger.as_deref(),
        ScoreStatus::Main,
    )
    .map(|result| {
        let _ = refresh_library_summary_cache(&db, &store);
        info!(
            "Importação de arquivos concluída com sucesso: músicas retornadas={}, partituras adicionadas={}",
            result.songs.len(),
            result.added_count
        );
        result
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

#[tauri::command]
pub fn get_song_summaries_by_category(
    db: State<'_, Database>,
    category_id: String,
) -> Result<Vec<SongListItem>, AppError> {
    db.get_song_summaries_by_category(&category_id)
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
    path: String,
) -> Result<SongListItem, AppError> {
    create_song_with_metadata(db, store, name, path, None, None, Vec::new())
}

#[tauri::command]
pub fn create_song_with_categories(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    path: String,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    create_song_with_metadata(db, store, name, path, None, None, category_ids)
}

pub fn create_song_with_metadata(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
    path: String,
    composer: Option<String>,
    arranger: Option<String>,
    category_ids: Vec<String>,
) -> Result<SongListItem, AppError> {
    let normalized_name = normalized_required_song_name(&name)?;
    let normalized_path = normalized_required_song_path(&path)?;
    let updated_by = validate_server_create_song(&db, &store, &normalized_name)?;
    let now = Local::now().naive_local();
    let song_id = uuid::Uuid::new_v4().to_string();

    info!("Criando nova música: {}", normalized_name);
    let song = Song {
        id: song_id.clone(),
        name: normalized_name,
        composer: normalized_optional_text(composer),
        arranger: normalized_optional_text(arranger),
        path: normalized_path,
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

    let _ = refresh_library_summary_cache(&db, &store);

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
        path: original_song.path,
        is_favorite: original_song.is_favorite,
        status: original_song.status,
        updated_at: now,
        updated_by,
    };

    db.update_song(&updated_song, &category_ids)?;
    let _ = refresh_library_summary_cache(&db, &store);
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

    delete_song_core(&db, &store, &song_id)?;

    info!("Música deletada com sucesso: {}", song_id);
    Ok(())
}

#[tauri::command]
pub fn delete_song_with_files(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deletando diretório da música: {}", song_id);

    delete_song_with_files_core(&db, &store, &song_id)?;

    info!("Diretório da música deletado com sucesso: {}", song_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{delete_song_core, delete_song_with_files_core, import_files_core};
    use crate::domain::models::{AppSettings, ComputerType, IndexedFile, ScoreStatus};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    #[test]
    fn importing_indexed_files_generates_the_song_archive() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Servidor".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let source_dir = dir.path().join("import");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-1.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let files = vec![IndexedFile {
            path: score_path.to_string_lossy().to_string(),
            name: "CANON".to_string(),
            instrument: Some("flauta".to_string()),
            extension: "musx".to_string(),
            status: None,
        }];

        let result = import_files_core(
            &db,
            &store,
            "server-1",
            &files,
            &[],
            None,
            None,
            ScoreStatus::Main,
        )
        .expect("import files");

        let song_id = &result.songs[0].id;
        assert!(
            dir.path()
                .join("cloud")
                .join("songs")
                .join(format!("{}.tar.zst", song_id))
                .is_file()
        );
    }

    #[test]
    fn importing_indexed_files_with_metadata_creates_new_song_as_main() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Servidor".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let source_dir = dir.path().join("import");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-1.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let files = vec![IndexedFile {
            path: score_path.to_string_lossy().to_string(),
            name: "CANON".to_string(),
            instrument: Some("flauta".to_string()),
            extension: "musx".to_string(),
            status: None,
        }];

        let result = import_files_core(
            &db,
            &store,
            "server-1",
            &files,
            &[],
            Some("Neusom"),
            Some("Maria"),
            ScoreStatus::Main,
        )
        .expect("import files");

        assert_eq!(db.get_song_by_id(&result.songs[0].id).expect("song").status, ScoreStatus::Main);
    }

    #[test]
    fn importing_indexed_files_with_metadata_keeps_ignored_scores() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Servidor".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let source_dir = dir.path().join("import");
        fs::create_dir_all(&source_dir).expect("create source dir");
        let score_path = source_dir.join("score-ignored.musx");
        fs::write(&score_path, b"score-contents").expect("write score");

        let files = vec![IndexedFile {
            path: score_path.to_string_lossy().to_string(),
            name: "CANON".to_string(),
            instrument: Some("flauta".to_string()),
            extension: "musx".to_string(),
            status: Some(ScoreStatus::Ignored),
        }];

        let result = import_files_core(
            &db,
            &store,
            "server-1",
            &files,
            &[],
            Some("Neusom"),
            Some("Maria"),
            ScoreStatus::Main,
        )
        .expect("import files");

        let song = db.get_song_by_id(&result.songs[0].id).expect("song");
        let score = db.get_scores_for_song(&song.id).expect("scores")[0].clone();

        assert_eq!(score.status, ScoreStatus::Ignored);
        assert_eq!(song.status, ScoreStatus::Main);
    }

    #[test]
    fn deleting_song_with_files_removes_the_indexed_directory() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Servidor".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("repertoire").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        fs::write(song_dir.join("score.musx"), b"score").expect("write score file");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        delete_song_with_files_core(&db, &store, "song-1").expect("delete song with files");

        assert!(!song_dir.exists());
        assert!(db.get_song_by_id("song-1").is_err());
    }

    #[test]
    fn delete_song_core_keeps_files_when_only_unindexing() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("songs.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Servidor".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        let song_dir = dir.path().join("repertoire").join("song-2");
        fs::create_dir_all(&song_dir).expect("create song dir");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-2".to_string(),
                name: "CANON 2".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        delete_song_core(&db, &store, "song-2").expect("delete song core");

        assert!(song_dir.exists());
        assert!(db.get_song_by_id("song-2").is_err());
    }
}
