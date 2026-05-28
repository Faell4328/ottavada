use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{mpsc, Arc, Mutex};

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

#[derive(Debug, Clone)]
struct DraftScoreCandidate {
    song_id: String,
    score_id: String,
    file_path: String,
    file_name: String,
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

    // Se não existe partitura elegível para nuvem (main),
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

    conn.execute(
        "INSERT INTO songsBackup (songId, status)
         VALUES (?1, ?2)
         ON CONFLICT(songId) DO UPDATE SET
            status = excluded.status",
        params![song_id, PROCESSING_STATUS],
    )?;

    Ok(())
}

fn update_backup_status(
    db: &Database,
    song_id: &str,
    status: &str,
) -> Result<(), AppError> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE songsBackup
         SET status = ?1
         WHERE songId = ?2",
        params![status, song_id],
    )?;
    Ok(())
}

fn list_song_backup_rows(db: &Database, songs_dir: &Path) -> Result<Vec<SongBackupRow>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT
            s.id,
            s.name,
            MAX(CAST(strftime('%s', sc.file_modified_at) AS INTEGER)) AS last_uploadable_score_modified_at
         FROM songs s
         LEFT JOIN scores sc
            ON s.id = sc.song_id
           AND sc.status IN ('main')
         GROUP BY s.id, s.name
         ORDER BY s.name",
    )?;

    let rows = stmt.query_map([], |row| {
        let song_id: String = row.get(0)?;
        let last_backup_at = fs::metadata(songs_dir.join(format!("{}.tar.zst", song_id)))
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs() as i64);

        Ok(SongBackupRow {
            song_id,
            song_name: row.get(1)?,
            last_uploadable_score_modified_at: row.get(2)?,
            last_backup_at,
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

        if normalized_status.as_str() == "draft" {
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

        if !matches!(normalized_status.as_str(), "main" | "draft") {
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
) -> Result<HashMap<String, Vec<DraftScoreCandidate>>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT song_id, id, file_path, file_name
         FROM scores
            WHERE status = 'draft'
         ORDER BY song_id, id",
    )?;

    let mut grouped = HashMap::<String, Vec<DraftScoreCandidate>>::new();
    let rows = stmt.query_map([], |row| {
        let song_id: String = row.get(0)?;
        let score_id: String = row.get(1)?;
        let file_path: String = row.get(2)?;
        let file_name: String = row.get(3)?;
        Ok(DraftScoreCandidate {
            song_id,
            score_id,
            file_path,
            file_name,
        })
    })?;

    for row in rows {
        let candidate = row?;
        grouped.entry(candidate.song_id.clone()).or_default().push(candidate);
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

    for (song_id, score_candidates) in draft_or_not_found {
        let target_score_ids: HashSet<&str> = score_candidates
            .iter()
            .map(|candidate| candidate.score_id.as_str())
            .collect();
        let song_temp_dir = temp_root.join(&song_id);
        fs::create_dir_all(&song_temp_dir)?;

        let archive_path = songs_dir.join(format!("{}.tar.zst", song_id));
        if archive_path.is_file() {
            extract_previous_main_versions_for_song(&archive_path, &target_score_ids, &song_temp_dir)?;
        }

        for candidate in score_candidates {
            let current_file_path = Path::new(&candidate.file_path).join(&candidate.file_name);
            if !current_file_path.is_file() {
                prepared
                    .summary
                    .without_previous_main
                    .insert(candidate.score_id.clone());
                continue;
            }

            if let Some(path) = find_score_file_in_dir(&song_temp_dir, &candidate.score_id) {
                prepared
                    .summary
                    .with_previous_main
                    .insert(candidate.score_id.clone());
                prepared
                    .preserved_files
                    .insert((song_id.clone(), candidate.score_id.clone()), path);
            } else {
                prepared
                    .summary
                    .without_previous_main
                    .insert(candidate.score_id.clone());
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
            "Nenhuma partitura elegível para gerar backup".to_string(),
        ));
    }

    for entry in entries {
        copy_single_score(entry, temp_dir)?;
    }

    Ok(())
}

fn copy_single_score(entry: &ScoreArchiveEntry, temp_dir: &Path) -> Result<(), AppError> {
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

    Ok(())
}

fn has_duplicate_tar_names(entries: &[ScoreArchiveEntry]) -> bool {
    let mut seen = HashSet::new();

    entries.iter().any(|entry| !seen.insert(entry.tar_name.clone()))
}

fn copy_and_rename_scores_parallel(
    entries: &[ScoreArchiveEntry],
    temp_dir: &Path,
    copy_workers: usize,
) -> Result<(), AppError> {
    if entries.is_empty() {
        return Err(AppError::Generic(
            "Nenhuma partitura elegível para gerar backup".to_string(),
        ));
    }

    let workers = copy_workers.max(1).min(entries.len());
    if workers == 1 || has_duplicate_tar_names(entries) {
        return copy_and_rename_scores(entries, temp_dir);
    }

    let next_index = Arc::new(AtomicUsize::new(0));
    let stop = Arc::new(AtomicBool::new(false));
    let first_error: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    std::thread::scope(|scope| {
        for _ in 0..workers {
            let next_index = Arc::clone(&next_index);
            let stop = Arc::clone(&stop);
            let first_error = Arc::clone(&first_error);

            scope.spawn(move || {
                loop {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }

                    let idx = next_index.fetch_add(1, Ordering::Relaxed);
                    if idx >= entries.len() {
                        break;
                    }

                    if let Err(err) = copy_single_score(&entries[idx], temp_dir) {
                        let mut guard = first_error.lock().unwrap();
                        if guard.is_none() {
                            *guard = Some(err.to_string());
                        }
                        stop.store(true, Ordering::Relaxed);
                        break;
                    }
                }
            });
        }
    });

    if let Some(error) = first_error.lock().unwrap().clone() {
        return Err(AppError::Generic(error));
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

fn archive_worker_count_for(total_jobs: usize, available_cores: usize) -> usize {
    let song_worker_budget = (available_cores / 2).max(1);
    song_worker_budget.min(total_jobs.max(1)).max(1)
}

fn copy_worker_count_for(archive_workers: usize, available_cores: usize) -> usize {
    let workers = archive_workers.max(1);

    (available_cores.max(1) / workers).max(1)
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

    let level = 5;
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
    copy_threads: usize,
) -> Result<(String, u64), AppError> {
    let final_file = songs_dir.join(format!("{}.tar.zst", song_id));
    let tmp_file = songs_dir.join(format!("{}.tar.zst.tmp", song_id));

    let mut last_error: Option<String> = None;

    for attempt in 1..=2 {
        let song_temp_dir = create_song_temp_dir(temp_root, song_id)?;

        let attempt_result = (|| -> Result<(String, u64), AppError> {
            copy_and_rename_scores_parallel(&entries, &song_temp_dir, copy_threads)?;

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

    archive_worker_count_for(total_jobs, cpu_based)
}

fn run_archive_jobs_parallel(
    jobs: Vec<ArchiveJob>,
    songs_dir: &Path,
    temp_root: &Path,
) -> Vec<(SongBackupRow, Result<(String, u64), AppError>)> {
    if jobs.is_empty() {
        return Vec::new();
    }

    let available_cores = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
        .max(1);
    let workers = archive_worker_count_for(jobs.len(), available_cores);
    let zstd_threads = zstd_threads_per_archive(workers);
    let copy_threads = copy_worker_count_for(workers, available_cores);
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
                    copy_threads,
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
                        copy_threads,
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
    song_ids_filter: Option<&HashSet<String>>,
) -> Result<SongArchiveSummary, AppError> {
    let songs_dir = cloud_root_dir.join(SONGS_DIR_NAME);
    let temp_root = app_data_dir.join(TMP_DIR_NAME).join(SONGS_DIR_NAME);

    fs::create_dir_all(&songs_dir)?;
    fs::create_dir_all(&temp_root)?;

    let rows = list_song_backup_rows(db, &songs_dir)?;

    let removed_orphans = cleanup_orphan_archives(&songs_dir, &rows)?;
    if removed_orphans > 0 {
        info!(
            "Limpeza de arquivos órfãos concluída: {} arquivo(s) removido(s)",
            removed_orphans
        );
    }

    let rows = if let Some(song_ids_filter) = song_ids_filter {
        let filtered_rows: Vec<SongBackupRow> = rows
            .into_iter()
            .filter(|row| song_ids_filter.contains(&row.song_id))
            .collect();

        if filtered_rows.is_empty() {
            return Err(AppError::Generic(
                "Nenhuma música encontrada para gerar backup".to_string(),
            ));
        }

        filtered_rows
    } else {
        rows
    };

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
            if let Err(err) = update_backup_status(db, &row.song_id, "ok") {
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
                if let Err(status_err) = update_backup_status(db, &row.song_id, "error") {
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
                if let Err(err) = update_backup_status(db, &row.song_id, "ok") {
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

                if let Err(status_err) = update_backup_status(db, &row.song_id, "error") {
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
    generate_song_archives_with_prepared_versions(
        db,
        app_data_dir,
        cloud_root_dir,
        &prepared_versions,
        None,
    )
}

pub fn generate_song_archives_for_song_ids(
    db: &Database,
    app_data_dir: &Path,
    cloud_root_dir: &Path,
    song_ids: &[String],
) -> Result<SongArchiveSummary, AppError> {
    if song_ids.is_empty() {
        return Ok(SongArchiveSummary {
            total: 0,
            generated: 0,
            skipped: 0,
            failed: 0,
            results: Vec::new(),
        });
    }

    let prepared_versions =
        prepare_draft_not_found_main_versions(db, app_data_dir, cloud_root_dir)?;
    let song_ids_filter = song_ids.iter().cloned().collect::<HashSet<_>>();

    generate_song_archives_with_prepared_versions(
        db,
        app_data_dir,
        cloud_root_dir,
        &prepared_versions,
        Some(&song_ids_filter),
    )
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

    generate_song_archives_with_prepared_versions(
        db,
        app_data_dir,
        cloud_root_dir,
        &prepared_versions,
        None,
    )
}

#[cfg(test)]
mod tests {
    use std::fs::File;

    use chrono::Local;
    use crate::domain::models::{Score, ScoreStatus, Song};
    use crate::infrastructure::database::Database;
    use tar::Builder;
    use tempfile::tempdir;

    use super::{
        archive_worker_count_for, cleanup_orphan_archives, copy_and_rename_scores_parallel,
        copy_worker_count_for, generate_song_archives, list_draft_not_found_scores_with_previous_main,
        should_generate_archive, SongBackupRow, ScoreArchiveEntry,
    };

    fn create_tar_zst_with_entry(archive_path: &std::path::Path, file_name: &str, content: &[u8]) {
        if let Some(parent) = archive_path.parent() {
            std::fs::create_dir_all(parent).expect("create archive dir");
        }

        let output = File::create(archive_path).expect("create archive file");
        let encoder = zstd::stream::Encoder::new(output, 5).expect("encoder");
        let mut tar = Builder::new(encoder);

        let mut header = tar::Header::new_gnu();
        header.set_path(file_name).expect("set path");
        header.set_size(content.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();

        tar.append(&header, content).expect("append entry");
        let encoder = tar.into_inner().expect("finish tar");
        encoder.finish().expect("finish zstd");
    }

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
    fn archive_worker_count_uses_all_available_cores_up_to_the_number_of_jobs() {
        assert_eq!(archive_worker_count_for(1, 8), 1);
        assert_eq!(archive_worker_count_for(4, 8), 4);
        assert_eq!(archive_worker_count_for(16, 8), 4);
        assert_eq!(archive_worker_count_for(16, 1), 1);
    }

    #[test]
    fn copy_worker_count_scales_with_song_workers() {
        assert_eq!(copy_worker_count_for(1, 8), 8);
        assert_eq!(copy_worker_count_for(4, 8), 2);
        assert_eq!(copy_worker_count_for(16, 8), 1);
    }

    #[test]
    fn copies_scores_in_parallel_into_temp_dir() {
        let temp = tempdir().expect("temp dir");
        let source_dir = temp.path().join("source");
        let target_dir = temp.path().join("target");
        std::fs::create_dir_all(&source_dir).expect("create source dir");
        std::fs::create_dir_all(&target_dir).expect("create target dir");

        let first_source = source_dir.join("first.musx");
        let second_source = source_dir.join("second.musx");
        let third_source = source_dir.join("third.musx");
        std::fs::write(&first_source, b"first").expect("write first");
        std::fs::write(&second_source, b"second").expect("write second");
        std::fs::write(&third_source, b"third").expect("write third");

        let entries = vec![
            ScoreArchiveEntry {
                score_id: "score-1".to_string(),
                source_path: first_source,
                tar_name: "first.tar".to_string(),
            },
            ScoreArchiveEntry {
                score_id: "score-2".to_string(),
                source_path: second_source,
                tar_name: "second.tar".to_string(),
            },
            ScoreArchiveEntry {
                score_id: "score-3".to_string(),
                source_path: third_source,
                tar_name: "third.tar".to_string(),
            },
        ];

        copy_and_rename_scores_parallel(&entries, &target_dir, 2).expect("copy scores");

        assert_eq!(std::fs::read(target_dir.join("first.tar")).expect("read first"), b"first");
        assert_eq!(std::fs::read(target_dir.join("second.tar")).expect("read second"), b"second");
        assert_eq!(std::fs::read(target_dir.join("third.tar")).expect("read third"), b"third");
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
    fn does_not_generate_archive_for_draft_only_song() {
        let temp = tempdir().expect("temp dir");
        let app_data_dir = temp.path().join("app-data");
        let cloud_root_dir = temp.path().join("cloud");
        let db_path = temp.path().join("database.sqlite");

        std::fs::create_dir_all(&app_data_dir).expect("create app data dir");
        std::fs::create_dir_all(cloud_root_dir.join("songs")).expect("create cloud songs dir");

        let db = Database::new(&db_path).expect("create db");

        let song_dir = temp.path().join("songs").join("song-1");
        std::fs::create_dir_all(&song_dir).expect("create song dir");
        let score_file_path = song_dir.join("draft-score.musx");
        std::fs::write(&score_file_path, b"draft content").expect("write score file");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: Local::now().naive_local(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Piano".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "draft-score.musx".to_string(),
            file_size: 13,
            file_modified_at: Local::now().naive_local(),
            updated_at: Local::now().naive_local(),
            status: ScoreStatus::Draft,
            updated_by: "server-1".to_string(),
        })
        .expect("insert draft score");

        let summary = generate_song_archives(&db, &app_data_dir, &cloud_root_dir)
            .expect("generate archives");

        assert_eq!(summary.total, 1);
        assert_eq!(summary.generated, 0);
        assert_eq!(summary.skipped, 1);
        assert_eq!(summary.failed, 0);
        assert!(!cloud_root_dir.join("songs").join("song-1.tar.zst").exists());
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

    #[test]
    fn finds_previous_main_version_from_cloud_songs_archive() {
        let temp = tempdir().expect("temp dir");
        let db_path = temp.path().join("test.db");
        let db = crate::infrastructure::database::Database::new(&db_path).expect("db init");
        let cloud_root_dir = temp.path().join("cloud");
        let draft_score_dir = temp.path().join("song-1");
        std::fs::create_dir_all(&draft_score_dir).expect("create draft score dir");
        let draft_score_file = draft_score_dir.join("score-1.musx");
        std::fs::write(&draft_score_file, b"draft-version").expect("write draft score file");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: crate::domain::models::ScoreStatus::Main,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), ?9)",
            rusqlite::params![
                "score-1",
                "song-1",
                "flauta",
                "server",
                draft_score_dir.to_string_lossy().as_ref(),
                "score-1.musx",
                "musx",
                0,
                "draft",
            ],
        )
        .expect("insert draft score");
        drop(conn);

        create_tar_zst_with_entry(
            &cloud_root_dir.join("songs").join("song-1.tar.zst"),
            "score-1.musx",
            b"main-version",
        );

        let summary = list_draft_not_found_scores_with_previous_main(
            &db,
            temp.path(),
            &cloud_root_dir,
        )
        .expect("list preserved versions");

        assert!(summary.has_previous_main("score-1"));
    }

    #[test]
    fn does_not_preserve_previous_main_for_missing_draft_score_file() {
        let temp = tempdir().expect("temp dir");
        let db_path = temp.path().join("test.db");
        let db = crate::infrastructure::database::Database::new(&db_path).expect("db init");
        let cloud_root_dir = temp.path().join("cloud");

        db.insert_song(
            &crate::domain::models::Song {
                id: "song-1".to_string(),
                name: "Musica".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: crate::domain::models::ScoreStatus::Main,
                updated_at: chrono::Local::now().naive_local(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let missing_score_dir = temp.path().join("missing-song-1");
        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), ?9)",
            rusqlite::params![
                "score-1",
                "song-1",
                "flauta",
                "server",
                missing_score_dir.to_string_lossy().as_ref(),
                "score-1.musx",
                "musx",
                0,
                "draft",
            ],
        )
        .expect("insert draft score");
        drop(conn);

        create_tar_zst_with_entry(
            &cloud_root_dir.join("songs").join("song-1.tar.zst"),
            "score-1.musx",
            b"main-version",
        );

        let summary = list_draft_not_found_scores_with_previous_main(
            &db,
            temp.path(),
            &cloud_root_dir,
        )
        .expect("list preserved versions");

        assert!(!summary.has_previous_main("score-1"));
        assert!(summary.without_previous_main.contains("score-1"));
    }
}
