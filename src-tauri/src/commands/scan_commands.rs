use std::path::Path;
use std::time::Duration;
use tauri::State;
use tracing::{info, warn};

use crate::commands::common::run_blocking_with_store;
use crate::domain::errors::AppError;
use crate::domain::models::{OperationGuard, ScoreStatus};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{get_file_metadata, FileChangeDetector};

/// Verifica se há alterações nos arquivos de partituras
/// Se um arquivo foi alterado, o status é mudado para draft
/// Se um arquivo não foi encontrado, o status é mudado para not_found
/// Se um arquivo not_found é encontrado novamente, o status volta para draft/main
/// com base no último estado conhecido e nos metadados atuais.
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

fn scan_files_for_changes_impl(db: &Database, store: &SystemStore) -> Result<ScanResult, AppError> {
    info!("Iniciando verificação de alterações nos arquivos de partituras");

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let updated_by = settings.computer_id.clone();
    let host_id = &settings.computer_id; // O filtro é por quem criou o score

    let scores = db.get_all_scores_with_metadata_by_host(host_id)?;
    let mut changed_files = Vec::new();
    let mut not_found_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

    // Verificar scores normais (procurar por alterações ou deletados)
    for (score_id, file_path, stored_size, stored_modified_at_str) in scores {
        let path = Path::new(&file_path);

        if !path.exists() || !path.is_file() {
            warn!("Arquivo não encontrado: {}", file_path);

            // Marcar score como not_found (se não estiver já)
            if let Err(e) =
                db.update_score_status(&score_id, ScoreStatus::NotFound, &updated_by, None)
            {
                warn!("Erro ao atualizar status para not_found: {:?}", e);
                failed_files.push((
                    file_path.clone(),
                    format!("Erro ao marcar como não encontrado: {:?}", e),
                ));
            } else {
                not_found_files.push(file_path);
            }
            continue;
        }

        match get_file_metadata(path) {
            Ok((current_size, current_modified_at)) => {
                let stored_modified_at = parse_stored_modified_at(&stored_modified_at_str);

                let detector = FileChangeDetector::new(
                    current_size,
                    current_modified_at,
                    stored_size,
                    stored_modified_at,
                );

                if detector.has_changed() {
                    info!("Alteração detectada em: {}", file_path);

                    // Atualizar status para draft com os novos metadados
                    if let Err(e) = db.update_score_status(
                        &score_id,
                        ScoreStatus::Draft,
                        &updated_by,
                        Some((current_size, current_modified_at)),
                    ) {
                        warn!("Erro ao atualizar status para draft: {:?}", e);
                        failed_files
                            .push((file_path.clone(), format!("Erro ao atualizar: {:?}", e)));
                    } else {
                        changed_files.push(file_path);
                    }
                }
            }
            Err(e) => {
                warn!("Erro ao obter metadados do arquivo {}: {:?}", file_path, e);
                failed_files.push((file_path, format!("Erro ao ler: {}", e)));
            }
        }
    }

    // Verificar scores com status "not_found" (verificar se voltaram)
    if let Ok(not_found_scores) = db.get_not_found_scores_by_host(host_id) {
        info!(
            "Verificando {} arquivo(s) marcado(s) como not_found",
            not_found_scores.len()
        );

        for (score_id, file_path, stored_size, stored_modified_at_str) in not_found_scores {
            let path = Path::new(&file_path);

            // Se o arquivo agora existe, recuperar para o último estado coerente.
            if path.exists() && path.is_file() {
                info!("✓ Arquivo encontrado novamente: {}", file_path);

                match get_file_metadata(path) {
                    Ok((current_size, current_modified_at)) => {
                        let recovered_status = resolve_recovered_score_status(
                            db,
                            &score_id,
                            current_size,
                            current_modified_at,
                            stored_size,
                            &stored_modified_at_str,
                        )?;

                        if let Err(e) = db.update_score_status(
                            &score_id,
                            recovered_status,
                            &updated_by,
                            Some((current_size, current_modified_at)),
                        ) {
                            warn!("Erro ao recuperar arquivo: {:?}", e);
                            failed_files
                                .push((file_path.clone(), format!("Erro ao recuperar: {:?}", e)));
                        } else {
                            recovered_files.push(file_path);
                        }
                    }
                    Err(e) => {
                        warn!(
                            "Erro ao obter metadados do arquivo recuperado {}: {:?}",
                            file_path, e
                        );
                        failed_files.push((file_path, format!("Erro ao ler metadados: {}", e)));
                    }
                }
            }
        }
    }

    info!(
        "Verificação concluída. {} alterados, {} não encontrados, {} recuperados, {} erros",
        changed_files.len(),
        not_found_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    // TODO: Exportar apenas as mudanças (tabela "changed") como {computerId}.msgpack.zst
    // Não exportar todo o banco de dados

    Ok(ScanResult {
        changed_files,
        not_found_files,
        recovered_files,
        failed_files,
    })
}

fn parse_stored_modified_at(stored_modified_at_str: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(stored_modified_at_str, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local())
}

fn resolve_recovered_score_status(
    db: &Database,
    score_id: &str,
    current_size: u64,
    current_modified_at: chrono::NaiveDateTime,
    stored_size: u64,
    stored_modified_at_str: &str,
) -> Result<ScoreStatus, AppError> {
    let stored_modified_at = parse_stored_modified_at(stored_modified_at_str);
    let detector = FileChangeDetector::new(
        current_size,
        current_modified_at,
        stored_size,
        stored_modified_at,
    );

    let previous_status = db.get_previous_status_before_latest_not_found(score_id)?;
    if previous_status == Some(ScoreStatus::Draft) || detector.has_changed() {
        return Ok(ScoreStatus::Draft);
    }

    Ok(match previous_status {
        Some(ScoreStatus::Pending) => ScoreStatus::Pending,
        Some(ScoreStatus::Main) => ScoreStatus::Main,
        _ => ScoreStatus::Main,
    })
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ScanResult {
    pub changed_files: Vec<String>,
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
        db.update_score_status("score-1", ScoreStatus::NotFound, "server-1", None)
            .expect("set not found");

        let result = scan_files_for_changes_impl(&db, &store).expect("scan");
        let updated_song = db.get_song_list_item_by_id("song-1").expect("updated song");

        assert_eq!(updated_song.scores[0].status, ScoreStatus::Draft);
        assert_eq!(result.recovered_files.len(), 1);
    }
}
