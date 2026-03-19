use std::path::Path;
use tauri::State;
use tracing::{info, warn};

use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;
use crate::services::indexer::{get_file_metadata, FileChangeDetector};

/// Verifica se há alterações nos arquivos de partituras
/// Se um arquivo foi alterado, o status é mudado para draft
#[tauri::command]
pub fn scan_files_for_changes(db: State<'_, Database>) -> Result<ScanResult, AppError> {
    info!("Iniciando verificação de alterações nos arquivos de partituras");

    let scores = db.get_all_scores_with_metadata()?;
    let mut changed_files = Vec::new();
    let mut failed_files = Vec::new();

    for (score_id, file_path, stored_size, stored_modified_at_str) in scores {
        let path = Path::new(&file_path);

        if !path.exists() || !path.is_file() {
            warn!("Arquivo não encontrado: {}", file_path);
            failed_files.push((file_path.clone(), "Arquivo não encontrado".to_string()));
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
                    
                    // Atualizar status para draft
                    if let Err(e) = db.set_score_status_to_draft(&score_id) {
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

    info!("Verificação concluída. {} arquivos alterados, {} erros", changed_files.len(), failed_files.len());

    Ok(ScanResult {
        changed_files,
        failed_files,
    })
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ScanResult {
    pub changed_files: Vec<String>,
    pub failed_files: Vec<(String, String)>,
}
