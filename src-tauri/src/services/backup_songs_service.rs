use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::mpsc;

use rusqlite::params;
use tar::Builder;
use tracing::{error, info, warn};

use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SongArchiveResult {
    pub song_id: String,
    pub song_name: String,
    pub archive_path: Option<String>,
    pub archive_size: Option<u64>,
    pub generated: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SongArchiveSummary {
    pub total: usize,
    pub generated: usize,
    pub skipped: usize,
    pub failed: usize,
    pub results: Vec<SongArchiveResult>,
}

#[derive(Debug, Clone)]
struct SongBackupRow {
    song_id: String,
    song_name: String,
    last_uploadable_score_modified_at: Option<i64>,
    last_backup_at: Option<i64>,
}

#[derive(Debug, Clone)]
struct ScoreArchiveEntry {
    score_id: String,
    source_path: PathBuf,
    tar_name: String,
}

const SONGS_DIR_NAME: &str = "songs";
const TMP_DIR_NAME: &str = "tmp";
const PROCESSING_STATUS: &str = "processing";
const MAX_ARCHIVE_WORKERS: usize = 4;

#[derive(Debug)]
struct ArchiveJob {
    row: SongBackupRow,
    entries: Vec<ScoreArchiveEntry>,
}

#[derive(Debug, Clone, Default)]
pub struct DraftNotFoundMainVersionSummary {
    pub with_previous_main: HashSet<String>,
    pub without_previous_main: HashSet<String>,
}

impl DraftNotFoundMainVersionSummary {
    pub fn has_previous_main(&self, score_id: &str) -> bool {
        self.with_previous_main.contains(score_id)
    }
}

#[derive(Debug, Clone, Default)]
struct PreparedDraftNotFoundMainVersions {
    summary: DraftNotFoundMainVersionSummary,
    preserved_files: HashMap<(String, String), PathBuf>,
}

fn should_generate_archive(
    row: &SongBackupRow,
    songs_dir: &Path,
    preserved_scores_count: usize,
) -> bool {
    let archive_exists = songs_dir.join(format!("{}.tar.zst", row.song_id)).is_file();

    if !archive_exists {
        return row.last_uploadable_score_modified_at.is_some() || preserved_scores_count > 0;
    }

    // Se não existe partitura elegível para nuvem (main/pending),
    // nunca deve regerar o arquivo com conteúdo draft/not_found.
    let Some(last_uploadable_modified_at) = row.last_uploadable_score_modified_at else {
        return false;
    };

    row.last_backup_at
        .map(|last_backup| last_uploadable_modified_at > last_backup)
        .unwrap_or(true)
}

fn upsert_processing_status(db: &Database, song_id: &str) -> Result<(), AppError> {
    let conn = db.conn.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO backupSongs (id, song_id, status, last_backup_at, error_message)
         VALUES (?1, ?2, ?3, NULL, NULL)
         ON CONFLICT(song_id) DO UPDATE SET
         status = excluded.status,
         error_message = NULL",
        params![id, song_id, PROCESSING_STATUS],
    )?;

    Ok(())
}

fn update_backup_status(
    db: &Database,
    song_id: &str,
    status: &str,
    last_backup_at: Option<i64>,
    error_message: Option<&str>,
) -> Result<(), AppError> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE backupSongs
         SET status = ?1, last_backup_at = ?2, error_message = ?3
         WHERE song_id = ?4",
        params![status, last_backup_at, error_message, song_id],
    )?;
    Ok(())
}

fn list_song_backup_rows(db: &Database) -> Result<Vec<SongBackupRow>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT
            s.id,
            s.name,
            MAX(CAST(strftime('%s', sc.file_modified_at) AS INTEGER)) AS last_uploadable_score_modified_at,
            b.last_backup_at
         FROM songs s
         LEFT JOIN scores sc
            ON s.id = sc.song_id
           AND sc.status IN ('main', 'pending')
         LEFT JOIN backupSongs b ON s.id = b.song_id
         GROUP BY s.id, s.name, b.last_backup_at
         ORDER BY s.name",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(SongBackupRow {
            song_id: row.get(0)?,
            song_name: row.get(1)?,
            last_uploadable_score_modified_at: row.get(2)?,
            last_backup_at: row.get(3)?,
        })
    })?;

    let rows: Result<Vec<_>, _> = rows.collect();
    Ok(rows?)
}

fn list_scores_for_archive(
    db: &Database,
    song_id: &str,
    prepared_versions: &PreparedDraftNotFoundMainVersions,
) -> Result<Vec<ScoreArchiveEntry>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, status
         FROM scores
         WHERE song_id = ?1
         ORDER BY name",
    )?;

    let rows = stmt.query_map([song_id], |row| {
        let score_id: String = row.get(0)?;
        let dir_path: String = row.get(1)?;
        let file_name: String = row.get(2)?;
        let status: String = row.get(3)?;

        let normalized_status = status.to_ascii_lowercase();

        if matches!(normalized_status.as_str(), "draft" | "not_found") {
            let Some(preserved_source_path) = prepared_versions
                .preserved_files
                .get(&(song_id.to_string(), score_id.clone()))
            else {
                return Ok(None);
            };

            let tar_name = preserved_source_path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.to_string())
                .unwrap_or_else(|| score_id.clone());

            return Ok(Some(ScoreArchiveEntry {
                score_id,
                source_path: preserved_source_path.clone(),
                tar_name,
            }));
        }

        if !matches!(normalized_status.as_str(), "main" | "pending") {
            return Ok(None);
        }

        let source_path = PathBuf::from(&dir_path).join(&file_name);

        let extension = Path::new(&file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase());

        let tar_name = match extension {
            Some(ext) if !ext.is_empty() => format!("{}.{}", score_id, ext),
            _ => score_id.clone(),
        };

        Ok(Some(ScoreArchiveEntry {
            score_id,
            source_path,
            tar_name,
        }))
    })?;

    let mut entries = Vec::new();
    for row in rows {
        if let Some(entry) = row? {
            entries.push(entry);
        }
    }

    Ok(entries)
}

fn list_draft_not_found_scores_by_song(
    db: &Database,
) -> Result<HashMap<String, Vec<String>>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT song_id, id
         FROM scores
         WHERE status IN ('draft', 'not_found')
         ORDER BY song_id, id",
    )?;

    let mut grouped = HashMap::<String, Vec<String>>::new();
    let rows = stmt.query_map([], |row| {
        let song_id: String = row.get(0)?;
        let score_id: String = row.get(1)?;
        Ok((song_id, score_id))
    })?;

    for row in rows {
        let (song_id, score_id) = row?;
        grouped.entry(song_id).or_default().push(score_id);
    }

    Ok(grouped)
}

fn find_score_file_in_dir(dir: &Path, score_id: &str) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let stem_matches = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(|stem| stem.eq_ignore_ascii_case(score_id))
            .unwrap_or(false);

        if stem_matches {
            return Some(path);
        }
    }

    None
}

fn extract_previous_main_versions_for_song(
    archive_path: &Path,
    target_score_ids: &HashSet<&str>,
    output_dir: &Path,
) -> Result<(), AppError> {
    if !archive_path.is_file() {
        return Ok(());
    }

    let archive_file = File::open(archive_path).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao abrir arquivo de backup {}: {}",
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
    let entries = archive.entries().map_err(|e| {
        AppError::Generic(format!(
            "Erro ao listar entradas do arquivo {}: {}",
            archive_path.display(),
            e
        ))
    })?;

    fs::create_dir_all(output_dir)?;

    for entry_result in entries {
        let mut entry = entry_result.map_err(|e| {
            AppError::Generic(format!(
                "Erro ao ler entrada de {}: {}",
                archive_path.display(),
                e
            ))
        })?;

        let maybe_file_name = match entry.path() {
            Ok(path) => path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.to_string()),
            Err(_) => None,
        };

        let Some(file_name) = maybe_file_name else {
            continue;
        };

        let Some(stem) = Path::new(&file_name).file_stem().and_then(|s| s.to_str()) else {
            continue;
        };

        if !target_score_ids.contains(stem) {
            continue;
        }

        let output_file = output_dir.join(&file_name);
        let mut output = File::create(&output_file).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao criar arquivo temporário {}: {}",
                output_file.display(),
                e
            ))
        })?;

        std::io::copy(&mut entry, &mut output).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao extrair arquivo {} de {}: {}",
                file_name,
                archive_path.display(),
                e
            ))
        })?;
    }

    Ok(())
}

fn prepare_draft_not_found_main_versions(
    db: &Database,
    app_data_dir: &Path,
    cloud_root_dir: &Path,
) -> Result<PreparedDraftNotFoundMainVersions, AppError> {
    let draft_or_not_found = list_draft_not_found_scores_by_song(db)?;
    if draft_or_not_found.is_empty() {
        return Ok(PreparedDraftNotFoundMainVersions::default());
    }

    let temp_root = app_data_dir
        .join(TMP_DIR_NAME)
        .join("songs")
        .join("preserved-main");
    remove_dir_if_exists(&temp_root);
    fs::create_dir_all(&temp_root)?;

    let songs_dir = cloud_root_dir.join(SONGS_DIR_NAME);
    let mut prepared = PreparedDraftNotFoundMainVersions::default();

    for (song_id, score_ids) in draft_or_not_found {
        let target_score_ids: HashSet<&str> = score_ids.iter().map(|id| id.as_str()).collect();
        let song_temp_dir = temp_root.join(&song_id);
        fs::create_dir_all(&song_temp_dir)?;

        let archive_path = songs_dir.join(format!("{}.tar.zst", song_id));
        if archive_path.is_file() {
            extract_previous_main_versions_for_song(&archive_path, &target_score_ids, &song_temp_dir)?;
        }

        for score_id in score_ids {
            if let Some(path) = find_score_file_in_dir(&song_temp_dir, &score_id) {
                prepared
                    .summary
                    .with_previous_main
                    .insert(score_id.clone());
                prepared
                    .preserved_files
                    .insert((song_id.clone(), score_id.clone()), path);
            } else {
                prepared
                    .summary
                    .without_previous_main
                    .insert(score_id.clone());
            }
        }
    }

    Ok(prepared)
}

pub fn list_draft_not_found_scores_with_previous_main(
    db: &Database,
    app_data_dir: &Path,
    cloud_root_dir: &Path,
) -> Result<DraftNotFoundMainVersionSummary, AppError> {
    Ok(prepare_draft_not_found_main_versions(db, app_data_dir, cloud_root_dir)?.summary)
}

fn create_song_temp_dir(temp_root: &Path, song_id: &str) -> Result<PathBuf, AppError> {
    fs::create_dir_all(temp_root)?;
    let temp_dir = temp_root.join(format!("song-{}-{}", song_id, uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir)?;
    Ok(temp_dir)
}

fn copy_and_rename_scores(entries: &[ScoreArchiveEntry], temp_dir: &Path) -> Result<(), AppError> {
    if entries.is_empty() {
        return Err(AppError::Generic(
            "Nenhuma partitura com status main/pending para gerar backup".to_string(),
        ));
    }

    for entry in entries {
        if !entry.source_path.is_file() {
            return Err(AppError::Generic(format!(
                "Arquivo não encontrado para score {}: {}",
                entry.score_id,
                entry.source_path.display()
            )));
        }

        let destination = temp_dir.join(&entry.tar_name);
        fs::copy(&entry.source_path, &destination).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao copiar arquivo {} para {}: {}",
                entry.source_path.display(),
                destination.display(),
                e
            ))
        })?;
    }

    Ok(())
}

fn zstd_threads_per_archive(archive_workers: usize) -> u32 {
    let total_cores = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
        .max(1);
    let workers = archive_workers.max(1);

    // Divide os núcleos entre os arquivos paralelos para evitar oversubscription.
    (total_cores / workers).max(1) as u32
}

fn create_tar_zst_from_temp_dir_with_threads(
    temp_dir: &Path,
    output_file: &Path,
    zstd_threads: u32,
) -> Result<u64, AppError> {
    let output = File::create(output_file).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao criar arquivo temporário {}: {}",
            output_file.display(),
            e
        ))
    })?;

    let level = 10;
    let mut encoder = zstd::stream::Encoder::new(output, level)
        .map_err(|e| AppError::Generic(format!("Erro ao inicializar encoder zstd: {}", e)))?;

    encoder
        .multithread(zstd_threads)
        .map_err(|e| AppError::Generic(format!("Erro ao configurar multithread do zstd: {}", e)))?;

    {
        let mut tar_builder = Builder::new(&mut encoder);

        let mut files: Vec<PathBuf> = fs::read_dir(temp_dir)?
            .filter_map(|entry| entry.ok().map(|e| e.path()))
            .filter(|path| path.is_file())
            .collect();
        files.sort();

        for file in files {
            let file_name: OsString = file
                .file_name()
                .ok_or_else(|| {
                    AppError::Generic(
                        "Nome de arquivo inválido no diretório temporário".to_string(),
                    )
                })?
                .to_owned();

            tar_builder
                .append_path_with_name(&file, Path::new(&file_name))
                .map_err(|e| {
                    AppError::Generic(format!(
                        "Erro ao adicionar {} no tar: {}",
                        file.display(),
                        e
                    ))
                })?;
        }

        tar_builder
            .finish()
            .map_err(|e| AppError::Generic(format!("Erro ao finalizar tar: {}", e)))?;
    }

    encoder
        .finish()
        .map_err(|e| AppError::Generic(format!("Erro ao finalizar zstd: {}", e)))?;

    let size = fs::metadata(output_file)?.len();
    Ok(size)
}

fn remove_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn remove_dir_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_dir_all(path);
    }
}

fn cleanup_orphan_archives(songs_dir: &Path, rows: &[SongBackupRow]) -> Result<usize, AppError> {
    let valid_song_ids: HashSet<&str> = rows.iter().map(|row| row.song_id.as_str()).collect();
    let mut removed_count = 0usize;

    for entry in fs::read_dir(songs_dir)? {
        let path = entry?.path();
        if !path.is_file() {
            continue;
        }

        let file_name = match path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name,
            None => continue,
        };

        if !file_name.ends_with(".tar.zst") {
            continue;
        }

        let Some(song_id) = file_name.strip_suffix(".tar.zst") else {
            continue;
        };

        if valid_song_ids.contains(song_id) {
            continue;
        }

        fs::remove_file(&path)?;
        removed_count += 1;
        info!(
            "Arquivo órfão removido do cache local da nuvem: {}",
            path.display()
        );
    }

    Ok(removed_count)
}

fn generate_archive_with_retry(
    entries: &[ScoreArchiveEntry],
    song_id: &str,
    songs_dir: &Path,
    temp_root: &Path,
    zstd_threads: u32,
) -> Result<(String, u64), AppError> {
    let final_file = songs_dir.join(format!("{}.tar.zst", song_id));
    let tmp_file = songs_dir.join(format!("{}.tar.zst.tmp", song_id));

    let mut last_error: Option<String> = None;

    for attempt in 1..=2 {
        let song_temp_dir = create_song_temp_dir(temp_root, song_id)?;

        let attempt_result = (|| -> Result<(String, u64), AppError> {
            copy_and_rename_scores(&entries, &song_temp_dir)?;

            remove_if_exists(&tmp_file);
            let size = create_tar_zst_from_temp_dir_with_threads(
                &song_temp_dir,
                &tmp_file,
                zstd_threads,
            )?;

            if final_file.exists() {
                fs::remove_file(&final_file)?;
            }

            fs::rename(&tmp_file, &final_file)?;
            Ok((final_file.to_string_lossy().to_string(), size))
        })();

        remove_dir_if_exists(&song_temp_dir);
        remove_if_exists(&tmp_file);

        match attempt_result {
            Ok(result) => return Ok(result),
            Err(err) => {
                last_error = Some(err.to_string());
                warn!(
                    "Falha ao gerar arquivo da música {} na tentativa {}: {}",
                    song_id, attempt, err
                );
            }
        }
    }

    Err(AppError::Generic(last_error.unwrap_or_else(|| {
        "Falha desconhecida ao gerar arquivo da música".to_string()
    })))
}

fn archive_worker_count(total_jobs: usize) -> usize {
    let cpu_based = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
        .max(1);

    cpu_based.min(MAX_ARCHIVE_WORKERS).min(total_jobs).max(1)
}

fn run_archive_jobs_parallel(
    jobs: Vec<ArchiveJob>,
    songs_dir: &Path,
    temp_root: &Path,
) -> Vec<(SongBackupRow, Result<(String, u64), AppError>)> {
    if jobs.is_empty() {
        return Vec::new();
    }

    let workers = archive_worker_count(jobs.len());
    let zstd_threads = zstd_threads_per_archive(workers);
    if workers == 1 {
        return jobs
            .into_iter()
            .map(|job| {
                let result = generate_archive_with_retry(
                    &job.entries,
                    &job.row.song_id,
                    songs_dir,
                    temp_root,
                    zstd_threads,
                );
                (job.row, result)
            })
            .collect();
    }

    let (tx, rx) = mpsc::channel::<(
        usize,
        SongBackupRow,
        Result<(String, u64), AppError>,
    )>();

    std::thread::scope(|scope| {
        for worker_idx in 0..workers {
            let tx = tx.clone();
            let jobs_ref = &jobs;

            scope.spawn(move || {
                for (idx, job) in jobs_ref.iter().enumerate() {
                    if idx % workers != worker_idx {
                        continue;
                    }

                    let result = generate_archive_with_retry(
                        &job.entries,
                        &job.row.song_id,
                        songs_dir,
                        temp_root,
                        zstd_threads,
                    );

                    // Se o receiver foi encerrado antecipadamente, só interrompe o worker.
                    if tx.send((idx, job.row.clone(), result)).is_err() {
                        break;
                    }
                }
            });
        }
    });

    drop(tx);

    let mut ordered: Vec<Option<(SongBackupRow, Result<(String, u64), AppError>)>> =
        Vec::with_capacity(jobs.len());
    ordered.resize_with(jobs.len(), || None);
    for _ in 0..jobs.len() {
        if let Ok((idx, row, result)) = rx.recv() {
            ordered[idx] = Some((row, result));
        }
    }

    ordered
        .into_iter()
        .flatten()
        .collect::<Vec<(SongBackupRow, Result<(String, u64), AppError>)>>()
}

fn generate_song_archives_with_prepared_versions(
    db: &Database,
    app_data_dir: &Path,
    cloud_root_dir: &Path,
    prepared_versions: &PreparedDraftNotFoundMainVersions,
) -> Result<SongArchiveSummary, AppError> {
    let songs_dir = cloud_root_dir.join(SONGS_DIR_NAME);
    let temp_root = app_data_dir.join(TMP_DIR_NAME).join(SONGS_DIR_NAME);

    fs::create_dir_all(&songs_dir)?;
    fs::create_dir_all(&temp_root)?;

    let rows = list_song_backup_rows(db)?;

    let removed_orphans = cleanup_orphan_archives(&songs_dir, &rows)?;
    if removed_orphans > 0 {
        info!(
            "Limpeza de arquivos órfãos concluída: {} arquivo(s) removido(s)",
            removed_orphans
        );
    }

    let mut results = Vec::with_capacity(rows.len());
    let mut jobs = Vec::new();

    for row in rows {
        if let Err(err) = upsert_processing_status(db, &row.song_id) {
            error!(
                "Erro ao iniciar status de processamento para {}: {}",
                row.song_id, err
            );
            results.push(SongArchiveResult {
                song_id: row.song_id,
                song_name: row.song_name,
                archive_path: None,
                archive_size: None,
                generated: false,
                error: Some(err.to_string()),
            });
            continue;
        }

        let preserved_scores_count = prepared_versions
            .preserved_files
            .keys()
            .filter(|(song_id, _)| song_id == &row.song_id)
            .count();

        let should_generate = should_generate_archive(&row, &songs_dir, preserved_scores_count);

        if !should_generate {
            if let Err(err) = update_backup_status(db, &row.song_id, "ok", row.last_backup_at, None)
            {
                error!(
                    "Erro ao atualizar status de backup (skip) para {}: {}",
                    row.song_id, err
                );
            }

            results.push(SongArchiveResult {
                song_id: row.song_id,
                song_name: row.song_name,
                archive_path: None,
                archive_size: None,
                generated: false,
                error: None,
            });
            continue;
        }

        let entries = match list_scores_for_archive(db, &row.song_id, prepared_versions) {
            Ok(entries) => entries,
            Err(err) => {
                let error_text = err.to_string();
                if let Err(status_err) = update_backup_status(
                    db,
                    &row.song_id,
                    "error",
                    row.last_backup_at,
                    Some(&error_text),
                ) {
                    error!(
                        "Erro ao atualizar status de backup (error) para {}: {}",
                        row.song_id, status_err
                    );
                }

                results.push(SongArchiveResult {
                    song_id: row.song_id,
                    song_name: row.song_name,
                    archive_path: None,
                    archive_size: None,
                    generated: false,
                    error: Some(error_text),
                });
                continue;
            }
        };

        jobs.push(ArchiveJob { row, entries });
    }

    if !jobs.is_empty() {
        let workers = archive_worker_count(jobs.len());
        let zstd_threads = zstd_threads_per_archive(workers);
        info!(
            "Gerando {} arquivo(s) .tar.zst com até {} worker(s) e {} thread(s) zstd por arquivo",
            jobs.len(),
            workers,
            zstd_threads
        );
    }

    for (row, archive_result) in run_archive_jobs_parallel(jobs, &songs_dir, &temp_root) {
        match archive_result {
            Ok((archive_path, archive_size)) => {
                if let Err(err) = update_backup_status(
                    db,
                    &row.song_id,
                    "ok",
                    row.last_uploadable_score_modified_at,
                    None,
                ) {
                    error!(
                        "Erro ao atualizar status de backup (ok) para {}: {}",
                        row.song_id, err
                    );
                }

                info!(
                    "Arquivo {}.tar.zst gerado com sucesso em {}",
                    row.song_id, archive_path
                );

                results.push(SongArchiveResult {
                    song_id: row.song_id,
                    song_name: row.song_name,
                    archive_path: Some(archive_path),
                    archive_size: Some(archive_size),
                    generated: true,
                    error: None,
                });
            }
            Err(err) => {
                let error_text = err.to_string();

                if let Err(status_err) = update_backup_status(
                    db,
                    &row.song_id,
                    "error",
                    row.last_backup_at,
                    Some(&error_text),
                ) {
                    error!(
                        "Erro ao atualizar status de backup (error) para {}: {}",
                        row.song_id, status_err
                    );
                }

                results.push(SongArchiveResult {
                    song_id: row.song_id,
                    song_name: row.song_name,
                    archive_path: None,
                    archive_size: None,
                    generated: false,
                    error: Some(error_text),
                });
            }
        }
    }

    let generated = results.iter().filter(|r| r.generated).count();
    let failed = results.iter().filter(|r| r.error.is_some()).count();
    let skipped = results.len().saturating_sub(generated + failed);

    Ok(SongArchiveSummary {
        total: results.len(),
        generated,
        skipped,
        failed,
        results,
    })
}

pub fn generate_song_archives(
    db: &Database,
    app_data_dir: &Path,
    cloud_root_dir: &Path,
) -> Result<SongArchiveSummary, AppError> {
    let prepared_versions =
        prepare_draft_not_found_main_versions(db, app_data_dir, cloud_root_dir)?;
    generate_song_archives_with_prepared_versions(db, app_data_dir, cloud_root_dir, &prepared_versions)
}

pub fn regenerate_all_song_archives(
    db: &Database,
    app_data_dir: &Path,
    cloud_root_dir: &Path,
) -> Result<SongArchiveSummary, AppError> {
    let prepared_versions =
        prepare_draft_not_found_main_versions(db, app_data_dir, cloud_root_dir)?;

    let songs_dir = cloud_root_dir.join(SONGS_DIR_NAME);
    remove_dir_if_exists(&songs_dir);
    fs::create_dir_all(&songs_dir)?;

    db.mark_all_song_archives_for_regeneration()?;

    generate_song_archives_with_prepared_versions(db, app_data_dir, cloud_root_dir, &prepared_versions)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{cleanup_orphan_archives, should_generate_archive, SongBackupRow};

    #[test]
    fn generates_when_archive_is_missing_even_if_last_backup_is_up_to_date() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        let row = SongBackupRow {
            song_id: "song-1".to_string(),
            song_name: "Musica".to_string(),
            last_uploadable_score_modified_at: Some(100),
            last_backup_at: Some(100),
        };

        assert!(should_generate_archive(&row, &songs_dir, 0));
    }

    #[test]
    fn skips_when_archive_exists_and_last_backup_is_up_to_date() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        let row = SongBackupRow {
            song_id: "song-2".to_string(),
            song_name: "Musica".to_string(),
            last_uploadable_score_modified_at: Some(100),
            last_backup_at: Some(100),
        };

        let archive_path = songs_dir.join("song-2.tar.zst");
        std::fs::write(&archive_path, b"already generated").expect("create archive placeholder");

        assert!(!should_generate_archive(&row, &songs_dir, 0));
    }

    #[test]
    fn generates_when_last_score_is_newer_than_last_backup() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        let row = SongBackupRow {
            song_id: "song-3".to_string(),
            song_name: "Musica".to_string(),
            last_uploadable_score_modified_at: Some(200),
            last_backup_at: Some(100),
        };

        let archive_path = songs_dir.join("song-3.tar.zst");
        std::fs::write(&archive_path, b"old archive").expect("create archive placeholder");

        assert!(should_generate_archive(&row, &songs_dir, 0));
    }

    #[test]
    fn skips_when_only_draft_or_not_found_scores_exist() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        let row = SongBackupRow {
            song_id: "song-4".to_string(),
            song_name: "Musica".to_string(),
            last_uploadable_score_modified_at: None,
            last_backup_at: Some(100),
        };

        let archive_path = songs_dir.join("song-4.tar.zst");
        std::fs::write(&archive_path, b"existing main archive")
            .expect("create archive placeholder");

        assert!(!should_generate_archive(&row, &songs_dir, 0));
    }

    #[test]
    fn regenerates_when_archive_missing_but_has_preserved_scores() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        let row = SongBackupRow {
            song_id: "song-5".to_string(),
            song_name: "Musica".to_string(),
            last_uploadable_score_modified_at: None,
            last_backup_at: Some(100),
        };

        assert!(should_generate_archive(&row, &songs_dir, 1));
    }

    #[test]
    fn removes_orphan_archives_from_songs_dir() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        std::fs::write(songs_dir.join("valid-song.tar.zst"), b"valid")
            .expect("write valid archive");
        std::fs::write(songs_dir.join("orphan-song.tar.zst"), b"orphan")
            .expect("write orphan archive");

        let rows = vec![SongBackupRow {
            song_id: "valid-song".to_string(),
            song_name: "Valid Song".to_string(),
            last_uploadable_score_modified_at: Some(100),
            last_backup_at: Some(100),
        }];

        let removed = cleanup_orphan_archives(&songs_dir, &rows).expect("cleanup archives");

        assert_eq!(removed, 1);
        assert!(songs_dir.join("valid-song.tar.zst").is_file());
        assert!(!songs_dir.join("orphan-song.tar.zst").exists());
    }

    #[test]
    fn ignores_non_archive_files_when_cleaning_orphans() {
        let temp = tempdir().expect("temp dir");
        let songs_dir = temp.path().join("songs");
        std::fs::create_dir_all(&songs_dir).expect("create songs dir");

        std::fs::write(songs_dir.join("notes.txt"), b"noop").expect("write notes file");

        let rows = Vec::<SongBackupRow>::new();
        let removed = cleanup_orphan_archives(&songs_dir, &rows).expect("cleanup archives");

        assert_eq!(removed, 0);
        assert!(songs_dir.join("notes.txt").is_file());
    }
}
