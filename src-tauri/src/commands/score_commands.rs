use chrono::Local;
use std::fs::{self, File};
use std::path::Path;
use tauri::State;
use tracing::{error, info, warn};

use crate::domain::errors::AppError;
use crate::domain::models::{ComputerType, OperationGuard};
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

fn open_path_on_system(file_path: &str) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", file_path])
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

fn extract_score_file_from_archive(
    archive_path: &Path,
    score_id: &str,
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
            score_id.to_string()
        } else {
            format!("{}.{}", score_id, extension)
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
pub async fn open_file(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    score_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;

    if settings.computer_type == ComputerType::Client {
        let song_id = db.get_song_id_for_score(&score_id)?;
        let app_data_dir = store.app_data_dir().clone();
        let archive_path = app_data_dir
            .join("cloud")
            .join("songs")
            .join(format!("{}.tar.zst", song_id));
        let temp_dir = app_data_dir.join("temp").join("scores");

        let extracted_path = extract_score_file_from_archive(&archive_path, &score_id, &temp_dir)?;
        let extracted_path_str = extracted_path.to_string_lossy().to_string();
        return open_path_on_system(&extracted_path_str);
    }

    let file_path = db.get_score_file_path(&score_id)?;
    open_path_on_system(&file_path)
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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::tempdir;

    use super::extract_score_file_from_archive;

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
        let extracted =
            extract_score_file_from_archive(&archive_path, "score-b", &output_dir).expect("extract");

        assert_eq!(
            extracted.file_name().and_then(|name| name.to_str()),
            Some("score-b.pdf")
        );
        assert_eq!(fs::read_to_string(extracted).expect("read file"), "B");
    }

    #[test]
    fn returns_error_when_score_is_missing_in_archive() {
        let dir = tempdir().expect("temp dir");
        let archive_path = dir.path().join("song-2.tar.zst");
        write_test_tar_zst(&archive_path, &[("score-a.musx", b"A")]);

        let output_dir = dir.path().join("out");
        let result = extract_score_file_from_archive(&archive_path, "score-z", &output_dir);

        assert!(result.is_err());
    }
}
