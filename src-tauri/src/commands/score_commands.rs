use chrono::Local;
use std::fs::{self, File};
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

#[cfg(target_os = "windows")]
use crate::commands::common::configure_no_window_command;
use crate::commands::common::{
    regenerate_song_archives_for_song_ids, remove_path_if_exists, require_server_settings,
};
use crate::domain::errors::AppError;
use crate::domain::models::ComputerType;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{get_file_metadata, paths_match, split_file_path};
use crate::services::backup_draft_ignored_service::remove_backup_file_for_draft_ignored_score;
use crate::services::name_formatter::normalize_optional_score_name;
use crate::services::path_normalizer::from_storage_path;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const VALID_SCORE_EXTENSIONS: [&str; 12] = [
    "pdf", "mus", "musx", "mscx", "mscz", "xml", "musicxml", "sib", "enc", "dorico", "mid", "midi",
];

fn score_exists_for_indexed_file(
    scores: &[ScoreListItem],
    file: &IndexedFile,
    treat_empty_instrument_as_duplicate: bool,
) -> bool {
    let normalized_instrument = normalize_optional_score_name(file.instrument.as_deref());

    scores
        .iter()
        .any(|sc| match (&sc.name, &normalized_instrument) {
            (Some(existing), Some(indexed)) => existing.eq_ignore_ascii_case(indexed),
            (None, None) => {
                treat_empty_instrument_as_duplicate || paths_match(&sc.file_path, &file.path)
            }
            _ => false,
        })
}

fn find_existing_score_by_file_path<'a>(
    scores: &'a [ScoreListItem],
    indexed_file: &IndexedFile,
) -> Option<&'a ScoreListItem> {
    scores
        .iter()
        .find(|score| paths_match(&score.file_path, &indexed_file.path))
}

fn build_score_from_indexed_file(
    song_id: &str,
    host_id: &str,
    file: &IndexedFile,
) -> Result<Score, AppError> {
    let normalized_file = IndexedFile {
        instrument: normalize_optional_score_name(file.instrument.as_deref()),
        status: file.status.clone(),
        ..file.clone()
    };

    let (file_size, file_modified_at) = read_score_file_metadata(Path::new(&file.path))?;
    let (score_file_path, file_name) = split_file_path(&file.path);

    Ok(Score::new_from_file(
        song_id.to_string(),
        host_id.to_string(),
        &normalized_file,
        score_file_path,
        file_name,
        (file_size, file_modified_at),
    ))
}

fn find_score_usage_in_library<'a>(
    songs: &'a [SongListItem],
    file: &IndexedFile,
) -> Option<(&'a SongListItem, &'a ScoreListItem)> {
    songs.iter().find_map(|song| {
        song.scores
            .iter()
            .find(|score| paths_match(&score.file_path, &file.path))
            .map(|score| (song, score))
    })
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

fn resolve_manual_score_status(
    current_status: ScoreStatus,
    requested_status: &str,
) -> Result<ScoreStatus, AppError> {
    match requested_status.to_lowercase().as_str() {
        "draft" => Ok(ScoreStatus::Draft),
        "ignored" => Ok(ScoreStatus::Ignored),
        "main" => {
            if current_status != ScoreStatus::Draft && current_status != ScoreStatus::Ignored {
                warn!("Tentativa de definir score como main fora do fluxo draft/ignored -> main");
                return Err(AppError::Generic(
                    "A partitura precisa estar como 'draft' ou 'ignored' para ser definida como 'main'".into(),
                ));
            }

            Ok(ScoreStatus::Main)
        }
        _ => {
            warn!(
                "Fluxo inválido de status manual solicitado: {}",
                requested_status
            );
            Err(AppError::Generic(
                "Apenas as mudanças para 'draft', 'main' ou 'ignored' são permitidas manualmente"
                    .into(),
            ))
        }
    }
}

fn delete_score_core(db: &Database, score_id: &str) -> Result<(), AppError> {
    let score_path = db.get_score_file_path(score_id)?;
    remove_path_if_exists(Path::new(&score_path))?;
    db.delete_score(score_id)
}

fn read_score_file_metadata(path: &Path) -> Result<(u64, chrono::NaiveDateTime), AppError> {
    get_file_metadata(path).map_err(|e| {
        error!("Erro ao obter metadados do arquivo: {:?}", e);
        AppError::Generic(format!("Erro ao ler arquivo: {}", e))
    })
}

fn open_path_on_system(file_path: &str) -> Result<(), AppError> {
    let normalized_path = file_path.replace('/', "\\");

    #[cfg(target_os = "windows")]
    {
        let mut cmd = configure_no_window_command(std::process::Command::new("cmd"));
        cmd.args(["/C", "start", "", &normalized_path])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&normalized_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    Ok(())
}

fn open_url_on_system(url: &str) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = configure_no_window_command(std::process::Command::new("cmd"));
        cmd.args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir URL: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir URL: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir URL: {}", e)))?;
    }

    Ok(())
}

fn open_file_location_on_system(file_path: &str) -> Result<(), AppError> {
    let normalized_path = file_path.replace('/', "\\");
    let path = Path::new(&normalized_path);

    if !path.exists() {
        return Err(AppError::Generic("Arquivo não encontrado".into()));
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = configure_no_window_command(std::process::Command::new("explorer"));
        if path.is_dir() {
            cmd.arg(&normalized_path).spawn().map_err(|e| {
                AppError::Generic(format!("Erro ao abrir local do diretório: {}", e))
            })?;
        } else {
            cmd.args(["/select,", &normalized_path])
                .spawn()
                .map_err(|e| AppError::Generic(format!("Erro ao abrir local do arquivo: {}", e)))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        let mut command = std::process::Command::new("open");
        if path.is_dir() {
            command.arg(path);
        } else {
            command.arg("-R").arg(path);
        }

        command
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir local do arquivo: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = path.parent().ok_or_else(|| {
            AppError::Generic("Não foi possível identificar o diretório do arquivo".into())
        })?;

        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir local do arquivo: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_tutorial_url() -> Result<(), AppError> {
    open_url_on_system("https://ottavada.com/#tutorial")
}

fn extract_score_file_from_archive(
    archive_path: &Path,
    score_id: &str,
    output_file_stem: &str,
    destination_dir: &Path,
) -> Result<std::path::PathBuf, AppError> {
    if !archive_path.is_file() {
        return Err(AppError::Generic(format!(
            "Arquivo compactado da música não encontrado: {}",
            archive_path.display()
        )));
    }

    fs::create_dir_all(destination_dir).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao criar diretório temporário para abrir partitura: {}",
            e
        ))
    })?;

    let archive_file = File::open(archive_path).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao abrir arquivo compactado {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    let decoder = zstd::stream::read::Decoder::new(archive_file).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao descompactar arquivo {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    let mut archive = tar::Archive::new(decoder);
    let mut entries = archive.entries().map_err(|e| {
        AppError::Generic(format!(
            "Erro ao listar arquivos do pacote {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    while let Some(entry_result) = entries.next() {
        let mut entry = entry_result.map_err(|e| {
            AppError::Generic(format!(
                "Erro ao ler entrada do pacote {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        if !entry.header().entry_type().is_file() {
            continue;
        }

        let entry_path = entry.path().map_err(|e| {
            AppError::Generic(format!(
                "Erro ao ler caminho dentro do pacote {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        let file_name = match entry_path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name,
            None => continue,
        };

        let path_for_name = Path::new(file_name);
        let file_stem = path_for_name.file_stem().and_then(|stem| stem.to_str());
        let is_target = file_stem == Some(score_id) || file_name == score_id;

        if !is_target {
            continue;
        }

        let extension = path_for_name
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");

        let output_name = if extension.is_empty() {
            output_file_stem.to_string()
        } else {
            format!("{}.{}", output_file_stem, extension)
        };

        let output_path = destination_dir.join(output_name);
        if output_path.exists() {
            fs::remove_file(&output_path).map_err(|e| {
                AppError::Generic(format!(
                    "Erro ao limpar arquivo temporário {}: {}",
                    output_path.display(),
                    e
                ))
            })?;
        }

        entry.unpack(&output_path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao extrair partitura para {}: {}",
                output_path.display(),
                e
            ))
        })?;

        return Ok(output_path);
    }

    Err(AppError::Generic(format!(
        "Partitura '{}' não encontrada dentro do pacote {}",
        score_id,
        archive_path.display()
    )))
}

fn resolve_openable_score_path(
    db: &Database,
    score_id: &str,
) -> Result<std::path::PathBuf, AppError> {
    let file_path = db.get_score_file_path(score_id)?;
    let direct_path = Path::new(&file_path);

    if direct_path.exists() && direct_path.is_file() {
        ensure_supported_score_file(direct_path)?;
        return Ok(direct_path.to_path_buf());
    }

    Err(AppError::Generic(format!(
        "Arquivo da partitura não encontrado: {}",
        file_path
    )))
}

fn sanitize_file_name_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                '_'
            } else {
                ch
            }
        })
        .collect();

    let trimmed = sanitized.trim().trim_matches('.').trim_matches(' ');
    if trimmed.is_empty() {
        "sem_nome".to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_client_extracted_score_name(song_name: &str, score_name: Option<&str>) -> String {
    let song = sanitize_file_name_component(song_name);
    let score = sanitize_file_name_component(score_name.unwrap_or("Sem instrumento"));
    format!("{} - {}", song, score)
}

fn refresh_library_summary_cache(_db: &Database, _store: &SystemStore) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
pub fn update_score(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
    instrument_name: Option<String>,
) -> Result<(), AppError> {
    info!("Atualizando nome da partitura: {}", score_id);

    let _settings = require_server_settings(&store)?;

    let normalized_instrument_name = normalize_optional_score_name(instrument_name.as_deref());

    db.update_score_name(&score_id, normalized_instrument_name)
        .map(|_| {
            info!("Nome da partitura atualizado com sucesso: {}", score_id);
            let _ = refresh_library_summary_cache(&db, &store);
        })
        .map_err(|e| {
            error!("Erro ao atualizar nome da partitura {}: {:?}", score_id, e);
            e
        })
}

#[tauri::command]
pub async fn open_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;

    if settings.computer_type == ComputerType::Client {
        let song_id = db.get_song_id_for_score(&score_id)?;
        let song = db.get_song_list_item_by_id(&song_id)?;
        let score = song
            .scores
            .iter()
            .find(|item| item.id == score_id)
            .ok_or_else(|| AppError::ScoreNotFound(score_id.clone()))?;

        let output_file_stem = build_client_extracted_score_name(&song.name, score.name.as_deref());
        let app_data_dir = store.app_data_dir().clone();
        let archive_path = app_data_dir
            .join("cloud")
            .join("songs")
            .join(format!("{}.tar.zst", song_id));
        let temp_dir = app_data_dir.join("tmp").join("scores");

        let extracted_path = extract_score_file_from_archive(
            &archive_path,
            &score_id,
            &output_file_stem,
            &temp_dir,
        )?;
        let extracted_path_str = extracted_path.to_string_lossy().to_string();
        return open_path_on_system(&extracted_path_str);
    }

    let resolved_path = resolve_openable_score_path(&db, &score_id)?;
    open_path_on_system(&resolved_path.to_string_lossy())
}

#[tauri::command]
pub fn open_file_path(file_path: String) -> Result<(), AppError> {
    let expanded = from_storage_path(&file_path);
    let path = Path::new(&expanded);
    ensure_supported_score_file(path)?;
    open_path_on_system(&expanded)
}

#[tauri::command]
pub fn open_file_location(db: State<'_, Database>, file_path: String) -> Result<(), AppError> {
    let expanded = from_storage_path(&file_path);
    let path = Path::new(&expanded);
    if path.exists() && path.is_dir() {
        return open_file_location_on_system(&expanded);
    }

    if path.exists() && path.is_file() {
        ensure_supported_score_file(path)?;
        return open_file_location_on_system(&expanded);
    }

    let resolved_path = db.get_score_file_path(&file_path)?;
    let expanded_resolved = from_storage_path(&resolved_path);
    let resolved = Path::new(&expanded_resolved);
    ensure_supported_score_file(resolved)?;
    open_file_location_on_system(&expanded_resolved)
}

#[tauri::command]
pub fn get_scores_for_song(
    db: State<'_, Database>,
    song_id: String,
) -> Result<Vec<ScoreListItem>, AppError> {
    db.get_scores_for_song(&song_id)
}

#[tauri::command]
pub fn update_score_status(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
    status: String,
) -> Result<SongListItem, AppError> {
    let settings = require_server_settings(&store)?;

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

    let next_status = resolve_manual_score_status(current_score.status.clone(), &status)?;

    db.update_score_status(&score_id, next_status.clone(), &settings.computer_id, None)?;

    if matches!(current_score.status, ScoreStatus::Draft | ScoreStatus::Ignored)
        && !matches!(next_status, ScoreStatus::Draft | ScoreStatus::Ignored)
    {
        let _ = remove_backup_file_for_draft_ignored_score(
            &store,
            &score_id,
            &current_score.file_extension,
        );
    }

    let _ = refresh_library_summary_cache(&db, &store);

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
    require_server_settings(&store)?;

    info!("Deletando partitura: {}", score_id);

    let song_id = db.get_song_id_for_score(&score_id)?;
    let song = db.get_song_list_item_by_id(&song_id)?;
    if let Some(score) = song.scores.iter().find(|sc| sc.id == score_id) {
        if matches!(score.status, ScoreStatus::Draft | ScoreStatus::Ignored) {
            let _ =
                remove_backup_file_for_draft_ignored_score(&store, &score_id, &score.file_extension);
        }
    }

    delete_score_core(&db, &score_id)
        .map(|_| {
            info!("Partitura deletada com sucesso: {}", score_id);
            let _ = refresh_library_summary_cache(&db, &store);
        })
        .map_err(|e| {
            error!("Erro ao deletar partitura: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn use_score_as_base(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    source_score_id: String,
    new_score_name: String,
) -> Result<SongListItem, AppError> {
    let settings = require_server_settings(&store)?;

    info!(
        "Usando partitura como base: source_score_id={}, new_score_name={}",
        source_score_id, new_score_name
    );

    // Find the source score and its song
    let all_songs = db.get_all_songs()?;
    let (song, _source_score) = all_songs
        .iter()
        .find_map(|song| {
            song.scores
                .iter()
                .find(|score| score.id == source_score_id)
                .map(|score| (song, score))
        })
        .ok_or_else(|| {
            AppError::Generic(format!("Partitura não encontrada: {}", source_score_id))
        })?;

    let song_id = &song.id;

    let source_full_path = Path::new(&db.get_score_file_path(&source_score_id)?).to_path_buf();

    if !source_full_path.exists() || !source_full_path.is_file() {
        return Err(AppError::Generic("Arquivo de origem não encontrado".into()));
    }

    let source_file_name = source_full_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Generic("Nome do arquivo de origem inválido".into()))?;

    let (song_prefix, extension) = source_file_name
        .rsplit_once('.')
        .ok_or_else(|| AppError::Generic("Extensão de arquivo inválida".into()))?;

    let file_name_prefix = song_prefix
        .rsplit_once(" - ")
        .map(|(prefix, _)| prefix)
        .unwrap_or(song_prefix);

    let compacted_score_name = new_score_name.replace(' ', "");

    // Create new filename with the new name and extension
    let new_filename = format!(
        "{} - {}.{}",
        file_name_prefix, compacted_score_name, extension
    );
    let source_parent = source_full_path.parent().ok_or_else(|| {
        AppError::Generic("Não foi possível identificar o diretório da partitura de origem".into())
    })?;
    let new_file_path = source_parent.join(&new_filename);

    // Copy the file
    fs::copy(&source_full_path, &new_file_path).map_err(|e| {
        error!(
            "Erro ao copiar arquivo: {} -> {}: {}",
            source_full_path.display(),
            new_file_path.display(),
            e
        );
        AppError::Generic(format!("Erro ao copiar arquivo: {}", e))
    })?;

    // Create new score entry
    let (file_size, file_modified_at) = read_score_file_metadata(&new_file_path)?;
    let (score_file_path, file_name) =
        split_file_path(&new_file_path.to_string_lossy().to_string());

    let now = Local::now().naive_local();
    let new_score = Score {
        id: uuid::Uuid::new_v4().to_string(),
        song_id: song_id.clone(),
        name: Some(new_score_name.clone()),
        host_id: settings.computer_id.clone(),
        file_path: score_file_path,
        file_name,
        file_size,
        file_modified_at,
        updated_at: now,
        status: ScoreStatus::Main,
        updated_by: settings.computer_id.clone(),
    };

    db.insert_score(&new_score).map_err(|e| {
        error!(
            "Erro ao inserir nova partitura em song_id={}: {:?}",
            song_id, e
        );
        // Rollback: delete the copied file if database insertion fails
        let _ = fs::remove_file(&new_file_path);
        e
    })?;

    info!(
        "Partitura criada com sucesso a partir da base: song_id={}, new_score_id={}",
        song_id, new_score.id
    );

    let _ = regenerate_song_archives_for_song_ids(&db, &store, &[song_id.clone()]);
    let _ = refresh_library_summary_cache(&db, &store);

    db.get_song_list_item_by_id(song_id)
}

#[tauri::command]
pub fn open_song_temp_dir(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;

    if settings.computer_type != ComputerType::Client {
        return Err(AppError::Generic(
            "Operação disponível apenas no cliente".into(),
        ));
    }

    let app_data_dir = store.app_data_dir().clone();
    let archive_path = app_data_dir
        .join("cloud")
        .join("songs")
        .join(format!("{}.tar.zst", song_id));
    let temp_dir = app_data_dir.join("tmp").join("scores");

    let song = db.get_song_list_item_by_id(&song_id)?;
    let song_dir_name = sanitize_file_name_component(&song.name);
    let song_temp_dir = temp_dir.join(&song_dir_name);

    if archive_path.is_file() {
        for score in &song.scores {
            let output_file_stem =
                build_client_extracted_score_name(&song.name, score.name.as_deref());
            extract_score_file_from_archive(
                &archive_path,
                &score.id,
                &output_file_stem,
                &song_temp_dir,
            )?;
        }
    }

    open_file_location_on_system(&song_temp_dir.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::tempdir;

    use crate::commands::common::remove_path_if_exists;
    use crate::domain::models::{Score, ScoreStatus};
    use crate::infrastructure::database::Database;

    use super::{
        build_client_extracted_score_name, delete_score_core, extract_score_file_from_archive,
        resolve_manual_score_status, resolve_openable_score_path, sanitize_file_name_component,
    };

    fn write_test_tar_zst(archive_path: &Path, files: &[(&str, &[u8])]) {
        let archive_file = fs::File::create(archive_path).expect("create archive file");
        let mut encoder = zstd::stream::Encoder::new(archive_file, 3).expect("create zstd encoder");

        {
            let mut builder = tar::Builder::new(&mut encoder);
            for (name, bytes) in files {
                let mut header = tar::Header::new_gnu();
                header.set_size(bytes.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder
                    .append_data(&mut header, *name, &bytes[..])
                    .expect("append tar entry");
            }
            builder.finish().expect("finish tar");
        }

        encoder.finish().expect("finish zstd");
    }

    #[test]
    fn extracts_target_score_from_song_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-1.tar.zst");
        write_test_tar_zst(
            &archive_path,
            &[("score-a.musx", b"A"), ("score-b.pdf", b"B")],
        );

        let output_dir = dir.path().join("out");
        let extracted = extract_score_file_from_archive(
            &archive_path,
            "score-b",
            "MUSICA TESTE - flute 1",
            &output_dir,
        )
        .expect("extract");

        assert_eq!(
            extracted.file_name().and_then(|name| name.to_str()),
            Some("MUSICA TESTE - flute 1.pdf")
        );
        assert_eq!(fs::read_to_string(extracted).expect("read file"), "B");
    }

    #[test]
    fn returns_error_when_score_is_missing_in_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-2.tar.zst");
        write_test_tar_zst(&archive_path, &[("score-a.musx", b"A")]);

        let output_dir = dir.path().join("out");
        let result = extract_score_file_from_archive(
            &archive_path,
            "score-z",
            "MUSICA TESTE - flute",
            &output_dir,
        );

        assert!(result.is_err());
    }

    #[test]
    fn extracts_multiple_scores_from_same_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-3.tar.zst");
        write_test_tar_zst(
            &archive_path,
            &[
                ("score-a.musx", b"content A"),
                ("score-b.pdf", b"content B"),
                ("score-c.mid", b"content C"),
            ],
        );

        let output_dir = dir.path().join("out");

        let extracted_a = extract_score_file_from_archive(
            &archive_path,
            "score-a",
            "HINO NACIONAL - Flauta",
            &output_dir,
        )
        .expect("extract score-a");
        assert_eq!(
            extracted_a.file_name().and_then(|n| n.to_str()),
            Some("HINO NACIONAL - Flauta.musx")
        );
        assert_eq!(fs::read_to_string(&extracted_a).expect("read"), "content A");

        let extracted_b = extract_score_file_from_archive(
            &archive_path,
            "score-b",
            "HINO NACIONAL - Trompete",
            &output_dir,
        )
        .expect("extract score-b");
        assert_eq!(
            extracted_b.file_name().and_then(|n| n.to_str()),
            Some("HINO NACIONAL - Trompete.pdf")
        );
        assert_eq!(fs::read_to_string(&extracted_b).expect("read"), "content B");

        let extracted_c = extract_score_file_from_archive(
            &archive_path,
            "score-c",
            "HINO NACIONAL - Violino",
            &output_dir,
        )
        .expect("extract score-c");
        assert_eq!(
            extracted_c.file_name().and_then(|n| n.to_str()),
            Some("HINO NACIONAL - Violino.mid")
        );
        assert_eq!(fs::read_to_string(&extracted_c).expect("read"), "content C");

        let dir_entries: Vec<_> = fs::read_dir(&output_dir)
            .expect("read output dir")
            .map(|e| e.expect("entry").file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(dir_entries.len(), 3);
    }

    #[test]
    fn sanitizes_file_name_component_for_cross_platform_open() {
        assert_eq!(
            sanitize_file_name_component(" HINO: NACIONAL/TESTE?* "),
            "HINO_ NACIONAL_TESTE__"
        );
        assert_eq!(sanitize_file_name_component("..."), "sem_nome");
    }

    #[test]
    fn builds_friendly_name_with_default_score_when_missing() {
        let name = build_client_extracted_score_name("HINO NACIONAL", None);
        assert_eq!(name, "HINO NACIONAL - Sem instrumento");
    }

    #[test]
    fn copies_file_and_updates_extension_correctly() {
        let dir = tempdir().expect("create temp dir");
        let source_file = dir.path().join("original.musx");
        fs::write(&source_file, b"test content").expect("write source file");

        let new_name = "copy";
        let extension = source_file
            .extension()
            .and_then(|e| e.to_str())
            .expect("get extension")
            .to_lowercase();
        let new_filename = format!("{}.{}", new_name, extension);
        let new_file_path = dir.path().join(&new_filename);

        fs::copy(&source_file, &new_file_path).expect("copy file");

        assert!(new_file_path.exists());
        assert_eq!(
            fs::read(&new_file_path).expect("read new file"),
            b"test content"
        );
        assert_eq!(
            new_file_path.file_name().and_then(|n| n.to_str()),
            Some("copy.musx")
        );
    }

    #[test]
    fn removes_score_file_from_disk_before_deleting_record() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scores.db")).expect("db");

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");
        let score_path = song_dir.join("score-1.musx");
        fs::write(&score_path, b"score content").expect("write score file");

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

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flauta".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "score-1.musx".to_string(),
            file_size: 13,
            file_modified_at: chrono::Local::now().naive_local(),
            updated_at: chrono::Local::now().naive_local(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        delete_score_core(&db, "score-1").expect("delete score");

        assert!(!score_path.exists());
        assert!(db.get_score_file_path("score-1").is_err());
    }

    #[test]
    fn remove_path_if_exists_ignores_missing_paths() {
        let dir = tempdir().expect("temp dir");
        let missing_path = dir.path().join("missing.txt");

        remove_path_if_exists(&missing_path).expect("ignore missing");
    }

    #[test]
    fn resolves_direct_file_path_when_available() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "HINO NACIONAL".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flauta".to_string()),
            host_id: "test".to_string(),
            file_path: dir.path().join("scores").to_string_lossy().to_string(),
            file_name: "flauta.musx".to_string(),
            file_size: 10,
            file_modified_at: chrono::Local::now().naive_local(),
            updated_at: chrono::Local::now().naive_local(),
            status: ScoreStatus::Main,
            updated_by: "test".to_string(),
        })
        .expect("insert score");

        let direct_path = dir.path().join("scores").join("flauta.musx");
        fs::create_dir_all(direct_path.parent().expect("direct parent")).expect("create dirs");
        fs::write(&direct_path, b"X").expect("write direct file");

        let resolved = resolve_openable_score_path(&db, "score-1").expect("resolve");

        assert_eq!(resolved, direct_path);
    }

    #[test]
    fn resolves_manual_score_status_for_ignored_to_draft() {
        assert_eq!(
            resolve_manual_score_status(ScoreStatus::Ignored, "draft").expect("status"),
            ScoreStatus::Draft
        );
    }

    #[test]
    fn resolves_manual_score_status_for_ignored_to_main() {
        assert_eq!(
            resolve_manual_score_status(ScoreStatus::Ignored, "main").expect("status"),
            ScoreStatus::Main
        );
    }

    #[test]
    fn returns_error_when_direct_file_is_missing() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "HINO NACIONAL".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "test".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flauta".to_string()),
            host_id: "test".to_string(),
            file_path: "/missing/path".to_string(),
            file_name: "flauta.musx".to_string(),
            file_size: 10,
            file_modified_at: chrono::Local::now().naive_local(),
            updated_at: chrono::Local::now().naive_local(),
            status: ScoreStatus::Main,
            updated_by: "test".to_string(),
        })
        .expect("insert score");

        let err = resolve_openable_score_path(&db, "score-1").expect_err("missing file");

        assert!(err
            .to_string()
            .contains("Arquivo da partitura não encontrado"));
    }
}
