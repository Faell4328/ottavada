use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;
use tauri::State;
use tracing::{info, warn};

use crate::commands::common::run_blocking_with_store;
use crate::domain::errors::AppError;
use crate::domain::models::{OperationGuard, Score, ScoreStatus};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{
    get_file_metadata, paths_match, scan_directory, split_file_path, FileChangeDetector,
};

#[derive(Debug, Clone)]
struct ScoreMetadataEntry {
    score_id: String,
    file_path: String,
    file_name: String,
    stored_size: u64,
    stored_modified_at_str: String,
}

/// Verifica se há alterações nos arquivos de partituras.
/// Arquivos alterados passam para draft e arquivos ausentes aparecem apenas no relatório.
#[tauri::command]
pub async fn scan_files_for_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<ScanResult, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao verificar alterações",
        move |store| scan_files_for_changes_impl(&db, &store),
    )
    .await
}

#[tauri::command]
pub async fn preview_scan_files_for_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<ScanResult, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao verificar alterações",
        move |store| preview_scan_files_for_changes_impl(&db, &store),
    )
    .await
}

fn scan_files_for_changes_impl(db: &Database, store: &SystemStore) -> Result<ScanResult, AppError> {
    info!("Iniciando verificação de alterações nos arquivos de partituras");

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let updated_by = settings.computer_id.clone();
    let host_id = &settings.computer_id; // O filtro é por quem criou o score

    let scores = db.get_all_scores_with_metadata_by_host(host_id)?;
    let mut changed_files = Vec::new();
    let mut added_files = Vec::new();
    let mut not_found_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

    let mut scores_by_song: HashMap<String, Vec<ScoreMetadataEntry>> = HashMap::new();
    for (song_id, score_id, file_path, file_name, stored_size, stored_modified_at_str) in scores {
        scores_by_song.entry(song_id).or_default().push(ScoreMetadataEntry {
            score_id,
            file_path,
            file_name,
            stored_size,
            stored_modified_at_str,
        });
    }

    for (song_id, song_scores) in scores_by_song {
        if song_scores.is_empty() {
            continue;
        }

        let song_directory = match score_directory(&song_scores[0].file_path, &song_scores[0].file_name) {
            Some(directory) => directory,
            None => continue,
        };

        let current_files = scan_directory(Path::new(&song_directory));

        for score in &song_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                warn!("Arquivo não encontrado: {}", full_path);
                not_found_files.push(full_path);
                continue;
            }

            match get_file_metadata(path) {
                Ok((current_size, current_modified_at)) => {
                    let stored_modified_at = parse_stored_modified_at(&score.stored_modified_at_str);

                    let detector = FileChangeDetector::new(
                        current_size,
                        current_modified_at,
                        score.stored_size,
                        stored_modified_at,
                    );

                    if detector.has_changed() {
                        info!("Alteração detectada em: {}", full_path);

                        if let Err(e) = db.update_score_status(
                            &score.score_id,
                            ScoreStatus::Draft,
                            &updated_by,
                            Some((current_size, current_modified_at)),
                        ) {
                            warn!("Erro ao atualizar status para draft: {:?}", e);
                            failed_files.push((
                                full_path.clone(),
                                format!("Erro ao atualizar: {:?}", e),
                            ));
                        } else {
                            changed_files.push(full_path);
                        }
                    }
                }
                Err(e) => {
                    warn!("Erro ao obter metadados do arquivo {}: {:?}", full_path, e);
                    failed_files.push((full_path, format!("Erro ao ler: {}", e)));
                }
            }
        }

        for current_file in current_files {
            let current_path = &current_file.path;

            if song_scores.iter().any(|score| {
                let score_full_path = build_score_full_path(&score.file_path, &score.file_name);
                paths_match(&score_full_path, current_path)
            }) {
                continue;
            }

            match get_file_metadata(Path::new(current_path)) {
                Ok((file_size, file_modified_at)) => {
                    let (file_path, file_name) = split_file_path(current_path);
                    let score = Score::new_from_file(
                        song_id.clone(),
                        updated_by.clone(),
                        &current_file,
                        file_path,
                        file_name,
                        (file_size, file_modified_at),
                    );

                    match db.insert_score(&score) {
                        Ok(()) => {
                            info!("Novo arquivo indexado: {}", current_path);
                            added_files.push(current_path.clone());
                        }
                        Err(e) => {
                            warn!("Erro ao inserir novo arquivo {}: {:?}", current_path, e);
                            failed_files.push((
                                current_path.clone(),
                                format!("Erro ao indexar novo arquivo: {:?}", e),
                            ));
                        }
                    }
                }
                Err(e) => {
                    warn!("Erro ao obter metadados do novo arquivo {}: {:?}", current_path, e);
                    failed_files.push((current_path.clone(), format!("Erro ao ler: {}", e)));
                }
            }
        }
    }

    info!(
        "Verificação concluída. {} alterados, {} adicionados, {} não encontrados, {} recuperados, {} erros",
        changed_files.len(),
        added_files.len(),
        not_found_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    Ok(ScanResult {
        changed_files,
        added_files,
        not_found_files,
        recovered_files,
        failed_files,
    })
}

fn preview_scan_files_for_changes_impl(
    db: &Database,
    store: &SystemStore,
) -> Result<ScanResult, AppError> {
    info!("Iniciando prévia de alterações nos arquivos de partituras");

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let host_id = &settings.computer_id;

    let scores = db.get_all_scores_with_metadata_by_host(host_id)?;
    let mut changed_files = Vec::new();
    let mut added_files = Vec::new();
    let mut not_found_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

    let mut scores_by_song: HashMap<String, Vec<ScoreMetadataEntry>> = HashMap::new();
    for (song_id, score_id, file_path, file_name, stored_size, stored_modified_at_str) in scores {
        scores_by_song.entry(song_id).or_default().push(ScoreMetadataEntry {
            score_id,
            file_path,
            file_name,
            stored_size,
            stored_modified_at_str,
        });
    }

    for (_song_id, song_scores) in scores_by_song {
        if song_scores.is_empty() {
            continue;
        }

        let song_directory = match score_directory(&song_scores[0].file_path, &song_scores[0].file_name) {
            Some(directory) => directory,
            None => continue,
        };

        let current_files = scan_directory(Path::new(&song_directory));

        for score in &song_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                not_found_files.push(full_path);
                continue;
            }

            match get_file_metadata(path) {
                Ok((current_size, current_modified_at)) => {
                    let stored_modified_at = parse_stored_modified_at(&score.stored_modified_at_str);
                    let detector = FileChangeDetector::new(
                        current_size,
                        current_modified_at,
                        score.stored_size,
                        stored_modified_at,
                    );

                    if detector.has_changed() {
                        changed_files.push(full_path);
                    }
                }
                Err(e) => {
                    warn!("Erro ao obter metadados do arquivo {}: {:?}", full_path, e);
                    failed_files.push((full_path, format!("Erro ao ler: {}", e)));
                }
            }
        }

        for current_file in current_files {
            let current_path = &current_file.path;
            if song_scores.iter().any(|score| {
                let score_full_path = build_score_full_path(&score.file_path, &score.file_name);
                paths_match(&score_full_path, current_path)
            }) {
                continue;
            }

            added_files.push(current_path.clone());
        }
    }

    info!(
        "Prévia concluída. {} alterados, {} adicionados, {} não encontrados, {} recuperados, {} erros",
        changed_files.len(),
        added_files.len(),
        not_found_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    Ok(ScanResult {
        changed_files,
        added_files,
        not_found_files,
        recovered_files,
        failed_files,
    })
}

fn build_score_full_path(file_path: &str, file_name: &str) -> String {
    let base_path = Path::new(file_path);
    let legacy_full_path = base_path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case(file_name))
        .unwrap_or(false);

    if legacy_full_path {
        file_path.to_string()
    } else {
        base_path.join(file_name).to_string_lossy().to_string()
    }
}

fn score_directory(file_path: &str, file_name: &str) -> Option<String> {
    let full_path = build_score_full_path(file_path, file_name);
    Path::new(&full_path)
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
}

fn parse_stored_modified_at(stored_modified_at_str: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(stored_modified_at_str, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ScanResult {
    pub changed_files: Vec<String>,
    pub added_files: Vec<String>,
    pub not_found_files: Vec<String>,
    pub recovered_files: Vec<String>,
    pub failed_files: Vec<(String, String)>,
}

/// Faz uma verificação simples de conectividade com a internet usando socket TCP.
/// Não depende de rclone: tenta conectar em servidores DNS públicos bem conhecidos.
#[tauri::command]
pub async fn has_internet_connection() -> Result<bool, AppError> {
    tauri::async_runtime::spawn_blocking(has_internet_connection_impl)
        .await
        .map_err(|e| AppError::Generic(format!("Falha interna ao verificar internet: {}", e)))
}

fn has_internet_connection_impl() -> bool {
    let timeout = Duration::from_secs(2);
    let probes = ["1.1.1.1:53", "8.8.8.8:53", "9.9.9.9:53"];

    probes.iter().any(|addr| {
        addr.parse::<std::net::SocketAddr>()
            .ok()
            .and_then(|socket| std::net::TcpStream::connect_timeout(&socket, timeout).ok())
            .is_some()
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::scan_files_for_changes_impl;
    use crate::domain::models::{AppSettings, ComputerType, Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;
    use crate::services::indexer::get_file_metadata;

    fn now() -> chrono::NaiveDateTime {
        chrono::Local::now().naive_local()
    }

    #[test]
    fn recovers_not_found_back_to_draft_when_previous_status_was_draft() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
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

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let score_dir = dir.path().join("scores");
        fs::create_dir_all(&score_dir).expect("create score dir");
        let score_path = score_dir.join("score-1.musx");
        fs::write(&score_path, b"draft-version").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");
        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("flauta".to_string()),
            host_id: "server-1".to_string(),
            file_path: score_dir.to_string_lossy().to_string(),
            file_name: "score-1.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        db.update_score_status(
            "score-1",
            ScoreStatus::Draft,
            "server-1",
            Some((file_size, file_modified_at)),
        )
        .expect("set draft");

        let result = scan_files_for_changes_impl(&db, &store).expect("scan");
        let updated_song = db.get_song_list_item_by_id("song-1").expect("updated song");

        assert_eq!(updated_song.scores[0].status, ScoreStatus::Draft);
        assert!(result.recovered_files.is_empty());
    }

    #[test]
    fn detects_removed_and_new_files_in_the_indexed_directory() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");
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

        let song_dir = dir.path().join("songs").join("song-1");
        fs::create_dir_all(&song_dir).expect("create song dir");

        let main_score_path = song_dir.join("Canon - Flauta.musx");
        let removed_score_path = song_dir.join("Canon - Trompete.musx");
        let new_score_path = song_dir.join("Canon - Clarinete.musx");

        fs::write(&main_score_path, b"main-score").expect("write main score");
        fs::write(&removed_score_path, b"removed-score").expect("write removed score");

        let (main_file_size, main_file_modified_at) =
            get_file_metadata(&main_score_path).expect("main metadata");
        let (removed_file_size, removed_file_modified_at) =
            get_file_metadata(&removed_score_path).expect("removed metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
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
            file_name: "Canon - Flauta.musx".to_string(),
            file_size: main_file_size,
            file_modified_at: main_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert main score");

        db.insert_score(&Score {
            id: "score-2".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Trompete".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "Canon - Trompete.musx".to_string(),
            file_size: removed_file_size,
            file_modified_at: removed_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert removed score");

        fs::remove_file(&removed_score_path).expect("remove score file");
        fs::write(&new_score_path, b"new-score").expect("write new score");

        let result = scan_files_for_changes_impl(&db, &store).expect("scan");
        let scores = db.get_scores_for_song("song-1").expect("scores");

        assert_eq!(result.not_found_files.len(), 1);
        assert_eq!(result.added_files.len(), 1);
        assert!(result.not_found_files[0].ends_with("Canon - Trompete.musx"));
        assert!(result.added_files[0].ends_with("Canon - Clarinete.musx"));
        assert!(scores.iter().any(|score| score.file_path.ends_with("Canon - Clarinete.musx")));
        assert!(
            scores
                .iter()
                .any(|score| score.file_path.ends_with("Canon - Trompete.musx") && score.status == ScoreStatus::Main)
        );
    }
}
