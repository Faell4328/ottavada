use std::path::Path;
use tauri::State;
use tracing::{info, warn};

use crate::domain::errors::AppError;
use crate::domain::models::ScoreStatus;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::indexer::{get_file_metadata, FileChangeDetector};

/// Verifica se há alterações nos arquivos de partituras
/// Se um arquivo foi alterado, o status é mudado para draft
/// Se um arquivo não foi encontrado, o status é mudado para not_found
/// Se um arquivo not_found é encontrado novamente, o status volta para main
#[tauri::command]
pub fn scan_files_for_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<ScanResult, AppError> {
    info!("Iniciando verificação de alterações nos arquivos de partituras");

    let settings = store.get_app_settings()?;
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
            if let Err(e) = db.update_score_status(&score_id, ScoreStatus::NotFound, &updated_by, None) {
                warn!("Erro ao atualizar status para not_found: {:?}", e);
                failed_files.push((file_path.clone(), format!("Erro ao marcar como não encontrado: {:?}", e)));
            } else {
                not_found_files.push(file_path);
            }
            continue;
        }

        match get_file_metadata(path) {
            Ok((current_size, current_modified_at)) => {
                let stored_modified_at =
                    chrono::NaiveDateTime::parse_from_str(&stored_modified_at_str, "%Y-%m-%d %H:%M:%S")
                        .unwrap_or_else(|_| chrono::Local::now().naive_local());

                let detector = FileChangeDetector::new(
                    current_size,
                    current_modified_at,
                    stored_size,
                    stored_modified_at,
                );

                if detector.has_changed() {
                    info!("Alteração detectada em: {}", file_path);
                    
                    // Atualizar status para draft com os novos metadados
                    if let Err(e) = db.update_score_status(&score_id, ScoreStatus::Draft, &updated_by, Some((current_size, current_modified_at))) {
                        warn!("Erro ao atualizar status para draft: {:?}", e);
                        failed_files.push((file_path.clone(), format!("Erro ao atualizar: {:?}", e)));
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
        info!("Verificando {} arquivo(s) marcado(s) como not_found", not_found_scores.len());
        
        for (score_id, file_path, _stored_size, _stored_modified_at_str) in not_found_scores {
            let path = Path::new(&file_path);

            // Se o arquivo agora existe, recuperar para main
            if path.exists() && path.is_file() {
                info!("✓ Arquivo encontrado novamente: {}", file_path);
                
                match get_file_metadata(path) {
                    Ok((current_size, current_modified_at)) => {
                        if let Err(e) = db.update_score_status(&score_id, ScoreStatus::Main, &updated_by, Some((current_size, current_modified_at))) {
                            warn!("Erro ao recuperar arquivo para main: {:?}", e);
                            failed_files.push((file_path.clone(), format!("Erro ao recuperar: {:?}", e)));
                        } else {
                            recovered_files.push(file_path);
                        }
                    }
                    Err(e) => {
                        warn!("Erro ao obter metadados do arquivo recuperado {}: {:?}", file_path, e);
                        failed_files.push((file_path, format!("Erro ao ler metadados: {}", e)));
                    }
                }
            }
        }
    }

    info!("Verificação concluída. {} alterados, {} não encontrados, {} recuperados, {} erros", 
        changed_files.len(), not_found_files.len(), recovered_files.len(), failed_files.len());

    Ok(ScanResult {
        changed_files,
        not_found_files,
        recovered_files,
        failed_files,
    })
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ScanResult {
    pub changed_files: Vec<String>,
    pub not_found_files: Vec<String>,
    pub recovered_files: Vec<String>,
    pub failed_files: Vec<(String, String)>,
}
