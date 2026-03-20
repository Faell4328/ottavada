use std::path::Path;
use tracing::info;

use crate::domain::models::ScoreStatus;
use crate::infrastructure::database::Database;
use crate::services::indexer::{get_file_metadata, FileChangeDetector};

/// Executa a verificação inicial de alterações nos arquivos de partituras
pub fn run_initial_scan(db: &Database, host_id: &str) {
    info!("Executando verificação inicial de alterações");

    let scores = match db.get_all_scores_with_metadata_by_host(host_id) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Erro ao buscar scores para verificação inicial: {:?}", e);
            return;
        }
    };

    let mut changed_count = 0;
    let mut not_found_count = 0;

    info!("Total de arquivos para verificar: {}", scores.len());

    for (score_id, file_path, stored_size, stored_modified_at_str) in scores {
        let path = Path::new(&file_path);

        if !path.exists() || !path.is_file() {
            if db.update_score_status(&score_id, ScoreStatus::NotFound, host_id, None).is_ok() {
                not_found_count += 1;
                info!("✓ Status atualizado para not_found: {}", file_path);
            }
            continue;
        }

        if let Ok((current_size, current_modified_at)) = get_file_metadata(path) {
            let stored_modified_at = chrono::NaiveDateTime::parse_from_str(
                &stored_modified_at_str,
                "%Y-%m-%d %H:%M:%S",
            ).unwrap_or_else(|_| chrono::Local::now().naive_local());

            let detector = FileChangeDetector::new(
                current_size,
                current_modified_at,
                stored_size,
                stored_modified_at,
            );

            if detector.has_changed() {
                if db.update_score_status(&score_id, ScoreStatus::Draft, host_id, Some((current_size, current_modified_at))).is_ok() {
                    changed_count += 1;
                    info!("✓ Status atualizado para draft: {}", file_path);
                }
            }
        }
    }

    info!("Verificação inicial concluída: {} alterações, {} não encontrados", changed_count, not_found_count);
}
