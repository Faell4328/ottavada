use std::ffi::OsString;
use std::fs::{self, File};
use std::path::{Path, PathBuf};

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

#[derive(Debug)]
struct SongBackupRow {
    song_id: String,
    song_name: String,
    last_score_file_modified_at: i64,
    last_backup_at: Option<i64>,
}

#[derive(Debug)]
struct ScoreArchiveEntry {
    score_id: String,
    source_path: PathBuf,
    tar_name: String,
}

const SONGS_DIR_NAME: &str = "songs";
const TEMP_DIR_NAME: &str = "temp";
const PROCESSING_STATUS: &str = "processing";

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
        "SELECT s.id, s.name, s.last_score_file_modified_at, b.last_backup_at
         FROM songs s
         LEFT JOIN backupSongs b ON s.id = b.song_id
         ORDER BY s.name",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(SongBackupRow {
            song_id: row.get(0)?,
            song_name: row.get(1)?,
            last_score_file_modified_at: row.get(2)?,
            last_backup_at: row.get(3)?,
        })
    })?;

    let rows: Result<Vec<_>, _> = rows.collect();
    Ok(rows?)
}

fn list_scores_for_archive(
    db: &Database,
    song_id: &str,
) -> Result<Vec<ScoreArchiveEntry>, AppError> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name
         FROM scores
         WHERE song_id = ?1 AND status IN ('main', 'pending')
         ORDER BY name",
    )?;

    let rows = stmt.query_map([song_id], |row| {
        let score_id: String = row.get(0)?;
        let dir_path: String = row.get(1)?;
        let file_name: String = row.get(2)?;

        let source_path = PathBuf::from(&dir_path).join(&file_name);

        let extension = Path::new(&file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase());

        let tar_name = match extension {
            Some(ext) if !ext.is_empty() => format!("{}.{}", score_id, ext),
            _ => score_id.clone(),
        };

        Ok(ScoreArchiveEntry {
            score_id,
            source_path,
            tar_name,
        })
    })?;

    let rows: Result<Vec<_>, _> = rows.collect();
    Ok(rows?)
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

fn create_tar_zst_from_temp_dir(temp_dir: &Path, output_file: &Path) -> Result<u64, AppError> {
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

    let worker_count = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1);
    encoder
        .multithread(worker_count as u32)
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

fn generate_archive_with_retry(
    db: &Database,
    song_id: &str,
    songs_dir: &Path,
    temp_root: &Path,
) -> Result<(String, u64), AppError> {
    let entries = list_scores_for_archive(db, song_id)?;
    let final_file = songs_dir.join(format!("{}.tar.zst", song_id));
    let tmp_file = songs_dir.join(format!("{}.tar.zst.tmp", song_id));

    let mut last_error: Option<String> = None;

    for attempt in 1..=2 {
        let song_temp_dir = create_song_temp_dir(temp_root, song_id)?;

        let attempt_result = (|| -> Result<(String, u64), AppError> {
            copy_and_rename_scores(&entries, &song_temp_dir)?;

            remove_if_exists(&tmp_file);
            let size = create_tar_zst_from_temp_dir(&song_temp_dir, &tmp_file)?;

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

pub fn generate_song_archives(
    db: &Database,
    cloud_root_dir: &Path,
) -> Result<SongArchiveSummary, AppError> {
    let songs_dir = cloud_root_dir.join(SONGS_DIR_NAME);
    let temp_root = cloud_root_dir.join(TEMP_DIR_NAME).join(SONGS_DIR_NAME);

    fs::create_dir_all(&songs_dir)?;
    fs::create_dir_all(&temp_root)?;

    let rows = list_song_backup_rows(db)?;
    let mut results = Vec::with_capacity(rows.len());

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

        let should_generate = row
            .last_backup_at
            .map(|last_backup| row.last_score_file_modified_at > last_backup)
            .unwrap_or(true);

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

        match generate_archive_with_retry(db, &row.song_id, &songs_dir, &temp_root) {
            Ok((archive_path, archive_size)) => {
                if let Err(err) = update_backup_status(
                    db,
                    &row.song_id,
                    "ok",
                    Some(row.last_score_file_modified_at),
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
