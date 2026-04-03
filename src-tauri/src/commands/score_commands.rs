use chrono::Local;
use std::fs::{self, File};
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

#[cfg(target_os = "windows")]
use crate::commands::common::configure_no_window_command;
use crate::commands::common::require_server_settings;
use crate::domain::errors::AppError;
use crate::domain::models::ComputerType;
use crate::domain::models::*;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{get_file_metadata, split_file_path};
use crate::services::name_formatter::normalize_optional_score_name;

const VALID_SCORE_EXTENSIONS: [&str; 3] = ["pdf", "mus", "musx"];

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
                treat_empty_instrument_as_duplicate || sc.file_path == file.path
            }
            _ => false,
        })
}

fn find_existing_score_by_file_path<'a>(
    scores: &'a [ScoreListItem],
    indexed_file: &IndexedFile,
) -> Option<&'a ScoreListItem> {
    scores.iter().find(|score| score.file_path == indexed_file.path)
}

fn build_score_from_indexed_file(
    song_id: &str,
    host_id: &str,
    file: &IndexedFile,
) -> Result<Score, AppError> {
    let normalized_file = IndexedFile {
        instrument: normalize_optional_score_name(file.instrument.as_deref()),
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

fn open_path_on_system(file_path: &str) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = configure_no_window_command(std::process::Command::new("explorer"));
        cmd.arg(file_path)
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
            .arg(file_path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir arquivo: {}", e)))?;
    }

    Ok(())
}

fn open_file_location_on_system(file_path: &str) -> Result<(), AppError> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(AppError::Generic("Arquivo não encontrado".into()));
    }

    let parent = path.parent().ok_or_else(|| {
        AppError::Generic("Não foi possível identificar o diretório do arquivo".into())
    })?;

    #[cfg(target_os = "windows")]
    {
        let mut cmd = configure_no_window_command(std::process::Command::new("explorer"));
        cmd.arg(parent)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir local do arquivo: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(parent)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir local do arquivo: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir local do arquivo: {}", e)))?;
    }

    Ok(())
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

fn sanitize_file_name_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
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

    let settings = require_server_settings(&store)?;
    let path = Path::new(&file_path);
    ensure_supported_score_file(path)?;

    let now = Local::now().naive_local();

    let (file_size, file_modified_at) = read_score_file_metadata(path)?;

    let (score_file_path, file_name) = split_file_path(&file_path);

    let normalized_instrument_name = normalize_optional_score_name(instrument_name.as_deref());

    db.update_score(
        &score_id,
        normalized_instrument_name,
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
    let settings = require_server_settings(&store)?;

    info!(
        "Adicionando partitura em música existente: song_id={}, file_path={}",
        song_id, file.path
    );

    let song = db.get_song_list_item_by_id(&song_id)?;

    if let Some(existing_score) = find_existing_score_by_file_path(&song.scores, &file) {
        let existing_name = existing_score
            .name
            .clone()
            .unwrap_or_else(|| "Sem instrumento".to_string());

        warn!(
            "Arquivo já indexado para song_id={}: file_path={}, instrumento={}",
            song_id, file.path, existing_name
        );

        return Err(AppError::Generic(format!(
            "Este arquivo já está indexado nesta música como '{}'",
            existing_name
        )));
    }

    // Verificar se o instrumento já existe (case-insensitive)
    let score_exists = score_exists_for_indexed_file(&song.scores, &file, true);

    if score_exists {
        let normalized_instrument = normalize_optional_score_name(file.instrument.as_deref());
        warn!(
            "Partitura duplicada ignorada para song_id={}: instrumento={}",
            song_id,
            normalized_instrument
                .as_deref()
                .unwrap_or("Sem instrumento")
        );
        return Err(AppError::Generic(format!(
            "Uma partitura com o instrumento '{}' já existe para essa música",
            normalized_instrument.as_deref().unwrap_or("Sem instrumento")
        )));
    }

    let score = build_score_from_indexed_file(&song_id, &settings.computer_id, &file)?;

    db.insert_score(&score).map_err(|e| {
        error!(
            "Erro ao inserir partitura em song_id={} (score_id={}): {:?}",
            song_id, score.id, e
        );
        e
    })?;

    db.get_song_list_item_by_id(&song_id).map(|updated_song| {
        info!(
            "Partitura adicionada com sucesso: song_id={}, score_id={}",
            song_id, score.id
        );
        updated_song
    })
}

#[tauri::command]
pub fn add_scores_to_song(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    song_id: String,
    files: Vec<IndexedFile>,
) -> Result<SongListItem, AppError> {
    let settings = require_server_settings(&store)?;

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

        let extracted_path =
            extract_score_file_from_archive(&archive_path, &score_id, &output_file_stem, &temp_dir)?;
        let extracted_path_str = extracted_path.to_string_lossy().to_string();
        return open_path_on_system(&extracted_path_str);
    }

    let file_path = db.get_score_file_path(&score_id)?;
    open_path_on_system(&file_path)
}

#[tauri::command]
pub fn open_file_path(file_path: String) -> Result<(), AppError> {
    let path = Path::new(&file_path);
    ensure_supported_score_file(path)?;
    open_path_on_system(&file_path)
}

#[tauri::command]
pub fn open_file_location(file_path: String) -> Result<(), AppError> {
    let path = Path::new(&file_path);
    ensure_supported_score_file(path)?;
    open_file_location_on_system(&file_path)
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
    require_server_settings(&store)?;

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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::tempdir;

    use super::{
        build_client_extracted_score_name, extract_score_file_from_archive,
        sanitize_file_name_component,
    };

    fn write_test_tar_zst(archive_path: &Path, files: &[(&str, &[u8])]) {
        let archive_file = fs::File::create(archive_path).expect("create archive file");
        let mut encoder =
            zstd::stream::Encoder::new(archive_file, 3).expect("create zstd encoder");

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
        let result =
            extract_score_file_from_archive(&archive_path, "score-z", "MUSICA TESTE - flute", &output_dir);

        assert!(result.is_err());
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
}
