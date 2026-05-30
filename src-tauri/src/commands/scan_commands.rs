use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;
use rusqlite::params;
use tauri::State;
use tracing::{info, warn};

use crate::commands::common::run_blocking_with_store;
use crate::domain::errors::AppError;
use crate::domain::models::{OperationGuard, Score, ScoreStatus};
use crate::infrastructure::database::{ChangedFieldRecord, Database};
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
    status: ScoreStatus,
}

/// Verifica se há alterações nos arquivos de partituras.
/// Arquivos alterados passam para draft e arquivos ausentes aparecem apenas no relatório.
#[tauri::command]
pub async fn scan_files_for_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    apply_missing_deletions: Option<bool>,
) -> Result<ScanResult, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();
    let apply_missing_deletions = apply_missing_deletions.unwrap_or(false);

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao verificar alterações",
        move |store| scan_files_for_changes_impl(&db, &store, apply_missing_deletions),
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

fn scan_files_for_changes_impl(
    db: &Database,
    store: &SystemStore,
    apply_missing_deletions: bool,
) -> Result<ScanResult, AppError> {
    info!("Iniciando verificação de alterações nos arquivos de partituras");

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;
    let updated_by = settings.computer_id.clone();
    let host_id = &settings.computer_id; // O filtro é por quem criou o score

    let scores = db.get_all_scores_with_metadata_by_host(host_id)?;
    let mut changed_files = Vec::new();
    let mut added_files = Vec::new();
    let mut deleted_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

    let mut scores_by_song: HashMap<String, Vec<ScoreMetadataEntry>> = HashMap::new();
    for (song_id, score_id, file_path, file_name, stored_size, stored_modified_at_str, status) in scores {
        scores_by_song.entry(song_id).or_default().push(ScoreMetadataEntry {
            score_id,
            file_path,
            file_name,
            stored_size,
            stored_modified_at_str,
            status: ScoreStatus::from_str(&status),
        });
    }

    for (song_id, song_scores) in scores_by_song {
        if song_scores.is_empty() {
            continue;
        }

        let scanable_scores: Vec<&ScoreMetadataEntry> = song_scores
            .iter()
            .filter(|score| score.status != ScoreStatus::Ignored)
            .collect();

        if scanable_scores.is_empty() {
            continue;
        }

        let song_directory = match score_directory(&scanable_scores[0].file_path, &scanable_scores[0].file_name) {
            Some(directory) => directory,
            None => continue,
        };

        let current_files = scan_directory(Path::new(&song_directory));

        for score in &scanable_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                warn!("Arquivo não encontrado: {}", full_path);
                if apply_missing_deletions {
                    if let Err(e) = db.delete_score(&score.score_id) {
                        warn!("Erro ao remover score ausente do banco: {:?}", e);
                        failed_files.push((
                            full_path.clone(),
                            format!("Erro ao remover do banco: {:?}", e),
                        ));
                    }
                }
                deleted_files.push(full_path);
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
        deleted_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    let changed_fields = db.get_changed_fields_ordered()?;
    let report_items = build_report_items(
        &db,
        &changed_files,
        &added_files,
        &deleted_files,
        &recovered_files,
        &failed_files,
        &changed_fields,
    );

    Ok(ScanResult {
        changed_files,
        added_files,
        deleted_files,
        recovered_files,
        failed_files,
        report_items,
        database_changes_count: db.get_pending_changes_count()?,
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
    let mut deleted_files = Vec::new();
    let mut recovered_files = Vec::new();
    let mut failed_files = Vec::new();

    let mut scores_by_song: HashMap<String, Vec<ScoreMetadataEntry>> = HashMap::new();
    for (song_id, score_id, file_path, file_name, stored_size, stored_modified_at_str, status) in scores {
        scores_by_song.entry(song_id).or_default().push(ScoreMetadataEntry {
            score_id,
            file_path,
            file_name,
            stored_size,
            stored_modified_at_str,
            status: ScoreStatus::from_str(&status),
        });
    }

    for (song_id, song_scores) in scores_by_song {
        if song_scores.is_empty() {
            continue;
        }

        let scanable_scores: Vec<&ScoreMetadataEntry> = song_scores
            .iter()
            .filter(|score| score.status != ScoreStatus::Ignored)
            .collect();

        if scanable_scores.is_empty() {
            continue;
        }

        let song_directory = match score_directory(&scanable_scores[0].file_path, &scanable_scores[0].file_name) {
            Some(directory) => directory,
            None => continue,
        };

        let current_files = scan_directory(Path::new(&song_directory));

        for score in &scanable_scores {
            let full_path = build_score_full_path(&score.file_path, &score.file_name);
            let path = Path::new(&full_path);

            if !path.exists() || !path.is_file() {
                deleted_files.push(full_path);
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
        "Prévia concluída. {} alterados, {} adicionados, {} deletados, {} recuperados, {} erros",
        changed_files.len(),
        added_files.len(),
        deleted_files.len(),
        recovered_files.len(),
        failed_files.len()
    );

    let changed_fields = db.get_changed_fields_ordered()?;
    let report_items = build_report_items(
        &db,
        &changed_files,
        &added_files,
        &deleted_files,
        &recovered_files,
        &failed_files,
        &changed_fields,
    );

    Ok(ScanResult {
        changed_files,
        added_files,
        deleted_files,
        recovered_files,
        failed_files,
        report_items,
        database_changes_count: db.get_pending_changes_count()?,
    })
}

fn build_report_items(
    db: &Database,
    changed_files: &[String],
    added_files: &[String],
    deleted_files: &[String],
    recovered_files: &[String],
    failed_files: &[(String, String)],
    changed_fields: &[ChangedFieldRecord],
) -> Vec<String> {
    let mut items = Vec::new();
    let mut category_names_by_id: HashMap<String, String> = HashMap::new();
    let mut status_changes_by_score_id: HashMap<String, Vec<&ChangedFieldRecord>> = HashMap::new();
    let mut status_change_order: Vec<String> = Vec::new();

    for change in changed_fields {
        if change.entity == "categories" && change.change_type == "insert" {
            if let (Some(field), Some(value)) = (change.field.as_deref(), change.value.as_ref()) {
                if field == "name" {
                    category_names_by_id.insert(change.entity_id.clone(), value.clone());
                }
            }
        }

        if change.entity == "scores" && change.change_type == "update" && change.field.as_deref() == Some("status") {
            if !status_changes_by_score_id.contains_key(&change.entity_id) {
                status_change_order.push(change.entity_id.clone());
            }

            status_changes_by_score_id.entry(change.entity_id.clone()).or_default().push(change);
        }
    }

    for item in added_files {
        items.push(format!("Partitura adicionada: {}", item));
    }

    for item in changed_files {
        items.push(format!("Partitura alterada: {}", item));
    }

    for item in deleted_files {
        items.push(format!("A partitura {} foi deletada.", item));
    }

    for item in recovered_files {
        items.push(format!("Partitura recuperada: {}", item));
    }

    for (path, error) in failed_files {
        items.push(format!("Falha ao processar {}: {}", path, error));
    }

    for change in changed_fields {
        if change.entity == "scores" && change.change_type == "update" && change.field.as_deref() == Some("status") {
            continue;
        }

        if let Some(item) = describe_database_change(db, &category_names_by_id, change) {
            items.push(item);
        }
    }

    for score_id in status_change_order {
        if let Some(changes) = status_changes_by_score_id.get(&score_id) {
            if let Some(item) = describe_score_status_change_summary(db, changes) {
                items.push(item);
            }
        }
    }

    items
}

fn describe_database_change(
    db: &Database,
    category_names_by_id: &HashMap<String, String>,
    change: &ChangedFieldRecord,
) -> Option<String> {
    match change.entity.as_str() {
        "songs" => describe_song_change(db, change),
        "categoriesSongs" => describe_song_category_change(db, category_names_by_id, change),
        "categories" => describe_category_change(change),
        "scores" => describe_score_change(db, change),
        _ => None,
    }
}

fn describe_song_category_change(
    db: &Database,
    category_names_by_id: &HashMap<String, String>,
    change: &ChangedFieldRecord,
) -> Option<String> {
    if change.field.as_deref() != Some("categoryId") {
        return None;
    }

    let conn = db.conn.lock().ok()?;
    let category_id = change.value.clone()?;

    let category_name = conn
        .query_row(
            "SELECT name FROM categories WHERE id = ?1",
            params![category_id],
            |row| row.get::<_, String>(0),
        )
        .or_else(|_| category_names_by_id.get(&category_id).cloned().ok_or(rusqlite::Error::QueryReturnedNoRows))
        .unwrap_or_else(|_| category_id.clone());

    let song_name = match change.change_type.as_str() {
        "insert" => conn
            .query_row(
                "SELECT s.name
                 FROM categoriesSongs cs
                 JOIN songs s ON s.id = cs.songId
                 WHERE cs.id = ?1",
                params![change.entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| change.entity_id.clone()),
        "delete" => conn
            .query_row(
                "SELECT name FROM songs WHERE id = ?1",
                params![change.entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| change.entity_id.clone()),
        _ => change.entity_id.clone(),
    };

    match change.change_type.as_str() {
        "insert" => Some(format!("A categoria {} foi adicionada à música {}.", category_name, song_name)),
        "delete" => Some(format!("A categoria {} foi removida da música {}.", category_name, song_name)),
        _ => None,
    }
}

fn describe_song_change(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let song = db.get_song_by_id(&change.entity_id).ok();
    let song_name = song.as_ref().map(|song| song.name.clone()).unwrap_or_else(|| change.entity_id.clone());

    match (change.change_type.as_str(), change.field.as_deref()) {
        ("insert", Some("name")) => Some(format!("Música criada: {}", change.value.clone().unwrap_or(song_name))),
        ("delete", Some("name")) => Some(format!("A música {} foi deletada.", change.value.clone().unwrap_or(song_name))),
        ("update", Some("name")) => Some(format!("A música {} teve o nome alterado.", change.value.clone().unwrap_or(song_name))),
        ("insert", Some("composer")) => change.value.as_ref().map(|value| format!("O compositor {} foi adicionado à música {}.", value, song_name)),
        (_, Some("composer")) => match (change.value.clone(), song.as_ref().and_then(|song| song.composer.clone())) {
            (Some(value), Some(current_value)) if current_value == value => Some(format!("O compositor {} foi modificado na música {}.", value, song_name)),
            (Some(value), None) => Some(format!("O compositor {} foi deletado da música {}.", value, song_name)),
            (Some(value), Some(current_value)) if current_value != value => Some(format!("O compositor {} foi modificado na música {}.", current_value, song_name)),
            _ => None,
        },
        ("insert", Some("arranger")) => change.value.as_ref().map(|value| format!("O arranjador {} foi adicionado à música {}.", value, song_name)),
        (_, Some("arranger")) => match (change.value.clone(), song.as_ref().and_then(|song| song.arranger.clone())) {
            (Some(value), Some(current_value)) if current_value == value => Some(format!("O arranjador {} foi modificado na música {}.", value, song_name)),
            (Some(value), None) => Some(format!("O arranjador {} foi deletado da música {}.", value, song_name)),
            (Some(value), Some(current_value)) if current_value != value => Some(format!("O arranjador {} foi modificado na música {}.", current_value, song_name)),
            _ => None,
        },
        _ => None,
    }
}

fn describe_category_change(change: &ChangedFieldRecord) -> Option<String> {
    match (change.change_type.as_str(), change.field.as_deref()) {
        ("insert", Some("name")) => Some(format!("Categoria criada: {}", change.value.clone().unwrap_or_else(|| change.entity_id.clone()))),
        ("delete", Some("name")) => Some(format!("A categoria {} foi deletada.", change.value.clone().unwrap_or_else(|| change.entity_id.clone()))),
        _ => None,
    }
}

fn describe_score_change(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    match (change.change_type.as_str(), change.field.as_deref()) {
        ("insert", Some("name")) => describe_score_added(db, change),
        ("delete", Some("file_name")) => Some(format!("A partitura {} foi deletada.", change.value.clone().unwrap_or_else(|| change.entity_id.clone()))),
        ("update", Some("name")) => Some(format!("A partitura {} teve o nome alterado.", change.value.clone().unwrap_or_else(|| change.entity_id.clone()))),
        ("update", Some("status")) => describe_score_status_change(db, change),
        _ => None,
    }
}

fn describe_score_status_change(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let conn = db.conn.lock().ok()?;

    let result = conn
        .query_row(
            "SELECT s.file_path, s.file_name, s.name, songs.name, s.status
             FROM scores s
             JOIN songs ON songs.id = s.song_id
             WHERE s.id = ?1",
            params![change.entity_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .ok()?;

    let full_path = build_score_full_path(&result.0, &result.1);
    let file_name = Path::new(&full_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&result.1);
    let file_stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name)
        .to_string();
    let file_extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value))
        .unwrap_or_default();
    let song_name = result.3;
    let previous_status_label = match change.value.as_deref() {
        Some("ignored") => "ignorada",
        Some("draft") => "rascunho",
        Some("main") => "principal",
        Some(other) => other,
        None => "rascunho",
    };

    let current_status = result.4.as_str();
    let current_status_label = match current_status {
        "ignored" => "ignorada",
        "draft" => "rascunho",
        "main" => "main",
        other => other,
    };

    let score_name = if let Some(score_name) = result.2
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        score_name.to_string()
    } else if file_stem.eq_ignore_ascii_case(&song_name) {
        "Sem instrumento".to_string()
    } else if file_stem.to_ascii_lowercase().starts_with(&song_name.to_ascii_lowercase()) {
        file_stem
            .strip_prefix(&song_name)
            .map(|value| value.trim_start_matches(" - ").trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "Sem instrumento".to_string())
    } else {
        file_stem
    };
    let score_name_with_extension = format!("{}{}", score_name, file_extension);

    if current_status == "main" {
        Some(format!(
            "A partitura {} saiu de {} e voltou para main na música {}.",
            score_name_with_extension, previous_status_label, song_name
        ))
    } else {
        Some(format!(
            "A partitura {} saiu de {} e foi para {} na música {}.",
            score_name_with_extension, previous_status_label, current_status_label, song_name
        ))
    }
}

fn describe_score_status_change_summary(
    db: &Database,
    changes: &[&ChangedFieldRecord],
) -> Option<String> {
    let first_change = changes.first()?;
    describe_score_status_change(db, first_change)
}

fn describe_score_added(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let conn = db.conn.lock().ok()?;

    let result = conn
        .query_row(
            "SELECT s.file_path, s.file_name, s.status
             FROM scores s
             WHERE s.id = ?1",
            params![change.entity_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .ok()?;

    if ScoreStatus::from_str(&result.2) == ScoreStatus::Ignored {
        return None;
    }

    Some(format!("Partitura adicionada: {}", build_score_full_path(&result.0, &result.1)))
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
    pub deleted_files: Vec<String>,
    pub recovered_files: Vec<String>,
    pub failed_files: Vec<(String, String)>,
    pub report_items: Vec<String>,
    pub database_changes_count: usize,
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
    use std::path::Path;

    use rusqlite::params;
    use tempfile::tempdir;

    use super::scan_files_for_changes_impl;
    use crate::domain::models::{AppSettings, ComputerType, Score, ScoreStatus, Song};
    use crate::infrastructure::database::ChangedFieldRecord;
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;
    use crate::services::indexer::get_file_metadata;

    fn now() -> chrono::NaiveDateTime {
        chrono::Local::now().naive_local()
    }

    #[test]
    fn recovers_deleted_back_to_draft_when_previous_status_was_draft() {
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

        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");
        let updated_song = db.get_song_list_item_by_id("song-1").expect("updated song");

        assert_eq!(updated_song.scores[0].status, ScoreStatus::Draft);
        assert!(result.recovered_files.is_empty());
    }

    #[test]
    fn ignores_scores_marked_as_ignored_during_scan() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");

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
        let score_path = score_dir.join("score-ignored.musx");
        fs::write(&score_path, b"ignored-version").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");
        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: Some("flauta".to_string()),
            host_id: "server-1".to_string(),
            file_path: score_dir.to_string_lossy().to_string(),
            file_name: "score-ignored.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Ignored,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let store = SystemStore::new(dir.path().to_path_buf());
        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");

        assert!(result.changed_files.is_empty());
        assert!(result.added_files.is_empty());
        assert!(result.deleted_files.is_empty());
    }

    #[test]
    fn deletes_missing_scores_when_apply_missing_deletions_is_enabled() {
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

        let score_path = song_dir.join("Canon - Trompete.musx");
        fs::write(&score_path, b"score").expect("write score");

        let (file_size, file_modified_at) = get_file_metadata(&score_path).expect("metadata");

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
            name: Some("Trompete".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "Canon - Trompete.musx".to_string(),
            file_size,
            file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        fs::remove_file(&score_path).expect("remove score file");

        let result = scan_files_for_changes_impl(&db, &store, true).expect("scan");
        let scores = db.get_scores_for_song("song-1").expect("scores");

        assert_eq!(result.deleted_files.len(), 1);
        assert!(result.database_changes_count >= 1);
        assert_eq!(scores.len(), 0);
    }

    #[test]
    fn describes_recovered_draft_score_without_instrument_as_sem_instrumento() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

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

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-1".to_string(),
            file_path: dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
            file_name: "CANON.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Draft,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("status".to_string()),
            value: Some("main".to_string()),
            timestamp: 0,
        };

        let text = super::describe_score_change(&db, &change).expect("description");

        assert!(text.contains("Sem instrumento"));
        assert!(!text.contains("CANON.musx"));
    }

    #[test]
    fn describes_recovered_score_from_ignored_as_ignored() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

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

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string() ),
            host_id: "server-1".to_string(),
            file_path: dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
            file_name: "CANON - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute(
                "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "prev-status",
                    "update",
                    "scores",
                    "score-1",
                    "status",
                    "ignored",
                    10i64,
                ],
            )
            .expect("insert previous status");
        }

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("status".to_string()),
            value: Some("main".to_string()),
            timestamp: 20,
        };

        let text = super::describe_score_change(&db, &change).expect("description");

        assert!(text.contains("principal"));
        assert!(text.contains("voltou para main"));
    }

    #[test]
    fn describes_score_status_change_from_ignored_to_draft() {
        let text = describe_score_status_change_for_previous_and_current_status("ignored", "draft");

        assert!(text.contains("ignorada"));
        assert!(text.contains("rascunho"));
        assert!(text.contains("foi para rascunho"));
    }

    #[test]
    fn describes_score_status_change_from_draft_to_ignored() {
        let text = describe_score_status_change_for_previous_and_current_status("draft", "ignored");

        assert!(text.contains("rascunho"));
        assert!(text.contains("ignorada"));
        assert!(text.contains("foi para ignorada"));
    }

    #[test]
    fn describes_score_status_change_from_main_to_ignored() {
        let text = describe_score_status_change_for_previous_and_current_status("main", "ignored");

        assert!(text.contains("principal"));
        assert!(text.contains("ignorada"));
        assert!(text.contains("foi para ignorada"));
    }

    fn describe_score_status_change_for_previous_and_current_status(previous_status: &str, current_status: &str) -> String {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

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

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
            file_name: "CANON - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::from_str(current_status),
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute(
                "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "prev-status",
                    "update",
                    "scores",
                    "score-1",
                    "status",
                    previous_status,
                    10i64,
                ],
            )
            .expect("insert previous status");
        }

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("status".to_string()),
            value: Some(previous_status.to_string()),
            timestamp: 20,
        };

        super::describe_score_change(&db, &change).expect("description")
    }

    #[test]
    fn describes_inserted_score_as_added() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        let song_dir = dir.path().join("songs").join("song-1");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
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
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("name".to_string()),
            value: Some("Flute2".to_string()),
            timestamp: 0,
        };

        let text = super::describe_score_change(&db, &change).expect("description");

        assert_eq!(
            text,
            format!(
                "Partitura adicionada: {}",
                song_dir
                    .join("08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx")
                    .to_string_lossy()
            )
        );
    }

    #[test]
    fn does_not_describe_ignored_score_as_added() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        let song_dir = dir.path().join("songs").join("song-1");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
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
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Ignored,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-ignored".to_string(),
            field: Some("name".to_string()),
            value: Some("Flute2".to_string()),
            timestamp: 0,
        };

        assert_eq!(super::describe_score_change(&db, &change), None);
    }

    #[test]
    fn describes_composer_and_arranger_changes_with_terminal_punctuation() {
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Eis o Nosso Deus".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let composer_added = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "songs".to_string(),
            entity_id: "song-1".to_string(),
            field: Some("composer".to_string()),
            value: Some("Neusom".to_string()),
            timestamp: 0,
        };

        let arranger_added = ChangedFieldRecord {
            id: "change-2".to_string(),
            change_type: "insert".to_string(),
            entity: "songs".to_string(),
            entity_id: "song-1".to_string(),
            field: Some("arranger".to_string()),
            value: Some("Maria".to_string()),
            timestamp: 0,
        };

        assert_eq!(
            super::describe_song_change(&db, &composer_added),
            Some("O compositor Neusom foi adicionado à música Eis o Nosso Deus.".to_string())
        );
        assert_eq!(
            super::describe_song_change(&db, &arranger_added),
            Some("O arranjador Maria foi adicionado à música Eis o Nosso Deus.".to_string())
        );
    }

    #[test]
    fn preview_scan_ignores_ignored_scores_when_listing_added_files() {
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

        let main_score_path = song_dir.join("08 H.C. CRISTO, O FIEL AMIGO - Flauta.musx");
        let ignored_score_path = song_dir.join("08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx");

        fs::write(&main_score_path, b"main-score").expect("write main score");
        fs::write(&ignored_score_path, b"ignored-score").expect("write ignored score");

        let (main_file_size, main_file_modified_at) = get_file_metadata(&main_score_path).expect("main metadata");
        let (ignored_file_size, ignored_file_modified_at) = get_file_metadata(&ignored_score_path).expect("ignored metadata");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
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
            id: "score-main".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flauta".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flauta.musx".to_string(),
            file_size: main_file_size,
            file_modified_at: main_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert main score");

        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx".to_string(),
            file_size: ignored_file_size,
            file_modified_at: ignored_file_modified_at,
            updated_at: now(),
            status: ScoreStatus::Ignored,
            updated_by: "server-1".to_string(),
        })
        .expect("insert ignored score");

        let result = super::preview_scan_files_for_changes_impl(&db, &store).expect("preview scan");

        assert!(result.added_files.is_empty());
        assert!(result.report_items.iter().all(|item| !item.contains("Flute2.musx")));
    }

    #[test]
    fn build_report_items_includes_score_additions_for_new_songs_and_keeps_later_score_updates() {
        let db = Database::new_in_memory().expect("db");
        let song_dir = Path::new("/music/song-1").to_path_buf();

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "HINO NOVO".to_string(),
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
            file_name: "HINO NOVO - Flauta.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        db.update_score_status(&"score-1".to_string(), ScoreStatus::Draft, "server-1", None)
            .expect("update score status");

        let added_files = vec![song_dir.join("HINO NOVO - Flauta.musx").to_string_lossy().to_string()];
        let changed_fields = db.get_changed_fields_ordered().expect("changed fields");

        let report_items = super::build_report_items(&db, &[], &added_files, &[], &[], &[], &changed_fields);

        assert!(report_items.iter().any(|item| item.contains("Música criada: HINO NOVO")));
        assert!(report_items.iter().any(|item| item.contains("foi para rascunho")));
        assert!(report_items.iter().any(|item| item.contains("Partitura adicionada:") && item.contains("HINO NOVO - Flauta.musx")));
    }

    #[test]
    fn category_song_report_uses_category_name_from_pending_changes() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
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

        let category_id = "category-1".to_string();
        let relation_id = "relation-1".to_string();

        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute("PRAGMA foreign_keys = OFF", [])
                .expect("disable foreign keys for test");
            conn.execute(
                "INSERT INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                rusqlite::params![&relation_id, &category_id, "song-1"],
            )
            .expect("insert relation");
        }

        let changed_fields = vec![
            ChangedFieldRecord {
                id: "cat-event-1".to_string(),
                change_type: "insert".to_string(),
                entity: "categories".to_string(),
                entity_id: category_id.clone(),
                field: Some("name".to_string()),
                value: Some("Coral".to_string()),
                timestamp: 1,
            },
            ChangedFieldRecord {
                id: "rel-event-1".to_string(),
                change_type: "insert".to_string(),
                entity: "categoriesSongs".to_string(),
                entity_id: relation_id,
                field: Some("categoryId".to_string()),
                value: Some(category_id),
                timestamp: 2,
            },
        ];

        let report_items = super::build_report_items(&db, &[], &[], &[], &[], &[], &changed_fields);

        assert!(report_items.iter().any(|item| item.contains("Coral")));
        assert!(report_items.iter().all(|item| !item.contains("category-1")));
    }

    #[test]
    fn category_song_report_ignores_song_id_relation_events() {
        let db = Database::new_in_memory().expect("db");
        db.insert_category(&crate::domain::models::Category {
            id: "category-1".to_string(),
            name: "Coral".to_string(),
            updated_at: now(),
            updated_by: "server-1".to_string(),
        })
        .expect("insert category");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let changed_fields = vec![ChangedFieldRecord {
            id: "rel-event-1".to_string(),
            change_type: "insert".to_string(),
            entity: "categoriesSongs".to_string(),
            entity_id: "relation-1".to_string(),
            field: Some("songId".to_string()),
            value: Some("song-1".to_string()),
            timestamp: 2,
        }];

        let report_items = super::build_report_items(&db, &[], &[], &[], &[], &[], &changed_fields);

        assert!(report_items.is_empty());
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

        let result = scan_files_for_changes_impl(&db, &store, false).expect("scan");
        let scores = db.get_scores_for_song("song-1").expect("scores");

        assert_eq!(result.deleted_files.len(), 1);
        assert_eq!(result.added_files.len(), 1);
        assert!(result.deleted_files[0].ends_with("Canon - Trompete.musx"));
        assert!(result.added_files[0].ends_with("Canon - Clarinete.musx"));
        assert!(scores.iter().any(|score| score.file_path.ends_with("Canon - Clarinete.musx")));
        assert!(
            scores
                .iter()
                .any(|score| score.file_path.ends_with("Canon - Trompete.musx") && score.status == ScoreStatus::Main)
        );
    }
}
