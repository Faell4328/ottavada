use std::collections::HashMap;
use std::path::Path;
use tracing::{info, warn};

use crate::domain::models::{Score, ScoreStatus};
use crate::infrastructure::database::Database;
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
    let mut added_count = 0;
    let mut not_found_count = 0;
    let mut recovered_count = 0;

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

    info!("Total de músicas para verificar: {}", scores_by_song.len());

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
                if db
                    .update_score_status(&score.score_id, ScoreStatus::NotFound, host_id, None)
                    .is_ok()
                {
                    not_found_count += 1;
                    info!("✓ Status atualizado para not_found: {}", full_path);
                }
                continue;
            }

            if let Ok((current_size, current_modified_at)) = get_file_metadata(path) {
                let stored_modified_at = parse_stored_modified_at(&score.stored_modified_at_str);

                let detector = FileChangeDetector::new(
                    current_size,
                    current_modified_at,
                    score.stored_size,
                    stored_modified_at,
                );

                if detector.has_changed() {
                    if db
                        .update_score_status(
                            &score.score_id,
                            ScoreStatus::Draft,
                            host_id,
                            Some((current_size, current_modified_at)),
                        )
                        .is_ok()
                    {
                        changed_count += 1;
                        info!("✓ Status atualizado para draft: {}", full_path);
                    }
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
                        host_id.to_string(),
                        &current_file,
                        file_path,
                        file_name,
                        (file_size, file_modified_at),
                    );

                    if db.insert_score(&score).is_ok() {
                        added_count += 1;
                        info!("✓ Novo arquivo indexado: {}", current_path);
                    } else {
                        warn!("Erro ao indexar novo arquivo: {}", current_path);
                    }
                }
                Err(e) => {
                    warn!("Erro ao obter metadados do novo arquivo {}: {:?}", current_path, e);
                }
            }
        }
    }

    if let Ok(not_found_scores) = db.get_not_found_scores_by_host(host_id) {
        info!(
            "Verificando {} arquivo(s) marcado(s) como not_found no boot",
            not_found_scores.len()
        );

        for (_song_id, score_id, file_path, file_name, stored_size, stored_modified_at_str) in not_found_scores {
            let full_path = build_score_full_path(&file_path, &file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                continue;
            }

            match get_file_metadata(path) {
                Ok((current_size, current_modified_at)) => {
                    let recovered_status = resolve_recovered_score_status(
                        db,
                        &score_id,
                        current_size,
                        current_modified_at,
                        stored_size,
                        &stored_modified_at_str,
                    );

                    if db
                        .update_score_status(
                            &score_id,
                            recovered_status,
                            host_id,
                            Some((current_size, current_modified_at)),
                        )
                        .is_ok()
                    {
                        recovered_count += 1;
                        info!("✓ Status recuperado: {}", full_path);
                    } else {
                        warn!("Erro ao recuperar status: {}", full_path);
                    }
                }
                Err(e) => {
                    warn!(
                        "Erro ao obter metadados do arquivo recuperado {}: {:?}",
                        full_path, e
                    );
                }
            }
        }
    }

    info!(
        "Verificação inicial concluída: {} alterações, {} adicionados, {} não encontrados, {} recuperados",
        changed_count, added_count, not_found_count, recovered_count
    );
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

fn resolve_recovered_score_status(
    db: &Database,
    score_id: &str,
    current_size: u64,
    current_modified_at: chrono::NaiveDateTime,
    stored_size: u64,
    stored_modified_at_str: &str,
) -> ScoreStatus {
    let stored_modified_at = parse_stored_modified_at(stored_modified_at_str);
    let detector = FileChangeDetector::new(
        current_size,
        current_modified_at,
        stored_size,
        stored_modified_at,
    );

    let previous_status = db
        .get_previous_status_before_latest_not_found(score_id)
        .ok()
        .flatten();

    if previous_status == Some(ScoreStatus::Draft) || detector.has_changed() {
        return ScoreStatus::Draft;
    }

    match previous_status {
        Some(ScoreStatus::Draft) => ScoreStatus::Draft,
        Some(ScoreStatus::Main) => ScoreStatus::Main,
        _ => ScoreStatus::Main,
    }
}
