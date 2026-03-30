use std::fs::File;
use std::path::{Path, PathBuf};
use tar::Builder;
use tracing::{info, warn, error};

use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;

/// Resultado do backup de uma música
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SongBackupResult {
    pub song_id: String,
    pub song_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub success: bool,
    pub error: Option<String>,
}

impl SongBackupResult {
    pub fn success(song_id: String, song_name: String, file_path: String, file_size: u64) -> Self {
        Self {
            song_id,
            song_name,
            file_path,
            file_size,
            success: true,
            error: None,
        }
    }

    pub fn error(song_id: String, song_name: String, error: String) -> Self {
        Self {
            song_id,
            song_name,
            file_path: String::new(),
            file_size: 0,
            success: false,
            error: Some(error),
        }
    }
}

/// Gera um arquivo .tar contendo todos os scores de uma música
fn create_tar_for_song(db: &Database, song_id: &str, output_path: &Path) -> Result<u64, AppError> {
    info!("Criando arquivo tar para música: {}", song_id);

    let file = File::create(output_path)
        .map_err(|e| AppError::Generic(format!(
            "Erro ao criar arquivo tar em {}: {}",
            output_path.display(),
            e
        )))?;

    let mut builder = Builder::new(file);

    // Obter todos os scores da música
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT s.id, d.path_name, s.file_name
             FROM scores s
             JOIN directories d ON d.id = s.directory_id
             WHERE s.song_id = ?1
             ORDER BY s.name"
        )
        .map_err(|e| AppError::Generic(format!("Erro ao preparar query: {}", e)))?;

    let results = stmt
        .query_map([song_id], |row| {
            Ok((
                row.get::<_, String>(0)?, // score_id
                row.get::<_, String>(1)?, // dir_path
                row.get::<_, String>(2)?, // file_name
            ))
        })
        .map_err(|e| AppError::Generic(format!("Erro ao executar query: {}", e)))?;

    let mut total_size = 0u64;
    let mut files_added = 0;

    for result in results {
        let (_score_id, dir_path, file_name) = result
            .map_err(|e| AppError::Generic(format!("Erro ao ler resultado: {}", e)))?;

        let file_path = PathBuf::from(&dir_path).join(&file_name);

        if !file_path.exists() {
            warn!(
                "Arquivo não encontrado para adicionar ao tar: {}",
                file_path.display()
            );
            continue;
        }

        // Adicionar arquivo ao tar
        let mut file = File::open(&file_path)
            .map_err(|e| AppError::Generic(format!(
                "Erro ao abrir arquivo {}: {}",
                file_path.display(),
                e
            )))?;

        let metadata = file_path.metadata()
            .map_err(|e| AppError::Generic(format!(
                "Erro ao obter metadata de {}: {}",
                file_path.display(),
                e
            )))?;

        let size = metadata.len();
        total_size += size;

        // Usar apenas o nome do arquivo no tar (sem caminho completo)
        builder
            .append_file(&file_name, &mut file)
            .map_err(|e| AppError::Generic(format!(
                "Erro ao adicionar {} ao tar: {}",
                file_name,
                e
            )))?;

        files_added += 1;
        info!("Adicionado ao tar: {} ({})", file_name, size);
    }

    // Finalizar o tar
    builder.finish()
        .map_err(|e| AppError::Generic(format!("Erro ao finalizar tar: {}", e)))?;

    info!(
        "Arquivo tar criado com sucesso: {} ({} arquivos, {} bytes)",
        output_path.display(),
        files_added,
        total_size
    );

    Ok(total_size)
}

/// Verifica se uma música precisa de backup comparando com a tabela backupSongs
pub fn should_backup_song(db: &Database, song_id: &str) -> Result<bool, AppError> {
    let conn = db.conn.lock().unwrap();

    // Obter o último timestamp de alteração de partitura da música
    let mut stmt = conn
        .prepare("SELECT last_score_file_modified_at FROM songs WHERE id = ?1")
        .map_err(|e| AppError::Generic(format!("Erro ao preparar query: {}", e)))?;

    let last_score_file_modified_at: i64 = stmt
        .query_row([song_id], |row| row.get(0))
        .map_err(|_| AppError::Generic(format!("Música não encontrada: {}", song_id)))?;

    // Obter o last_backup_at da tabela backupSongs
    let mut stmt = conn
        .prepare("SELECT last_backup_at FROM backupSongs WHERE song_id = ?1")
        .map_err(|e| AppError::Generic(format!("Erro ao preparar query: {}", e)))?;

    let last_backup_at_opt: Option<i64> = stmt
        .query_row([song_id], |row| row.get(0))
        .ok();

    // Se não tem registro de backup ou houve alteração local após o último backup, fazer backup
    let should_backup = match last_backup_at_opt {
        None => {
            info!(
                "Nenhum backup anterior para música {}, precisa fazer backup",
                song_id
            );
            true
        }
        Some(last_backup) => {
            if last_score_file_modified_at > last_backup {
                info!(
                    "Música {} foi alterada após último backup ({} > {}), precisa fazer backup",
                    song_id, last_score_file_modified_at, last_backup
                );
                true
            } else {
                info!(
                    "Música {} não foi alterada desde último backup, ignorando",
                    song_id
                );
                false
            }
        }
    };

    Ok(should_backup)
}

/// Gera arquivo .tar.zst para uma música e retorna o resultado
pub fn backup_song(
    db: &Database,
    song_id: &str,
    nuvem_dir: &Path,
) -> Result<SongBackupResult, AppError> {
    // Obter informações da música
    let (_, song_name): (String, String) = {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, status FROM songs WHERE id = ?1")
            .map_err(|e| AppError::Generic(format!("Erro ao preparar query: {}", e)))?;

        stmt.query_row([song_id], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|_| AppError::Generic(format!("Música não encontrada: {}", song_id)))?
    };

    // Criar arquivo tar temporário
    let tar_filename = format!("{}.tar", song_id);
    let tar_path = nuvem_dir.join(&tar_filename);
    let tar_zst_filename = format!("{}.tar.zst", song_id);
    let tar_zst_path = nuvem_dir.join(&tar_zst_filename);
    let tar_zst_tmp_path = nuvem_dir.join(format!("{}.tmp", &tar_zst_filename));

    // Criar arquivo tar
    match create_tar_for_song(db, song_id, &tar_path) {
        Ok(tar_size) => {
            info!("Tar criado com sucesso: {} ({} bytes)", tar_path.display(), tar_size);

            // Comprimir tar com zstd
            match std::fs::read(&tar_path) {
                Ok(tar_data) => {
                    match Database::compress_zstd(&tar_data) {
                        Ok(compressed_data) => {
                            // Salvar em arquivo temporário
                            match std::fs::write(&tar_zst_tmp_path, &compressed_data) {
                                Ok(_) => {
                                    // Renomear para final
                                    match std::fs::rename(&tar_zst_tmp_path, &tar_zst_path) {
                                        Ok(_) => {
                                            let file_size = compressed_data.len() as u64;
                                            info!(
                                                "✓ Backup de música concluído: {} ({} bytes comprimidos) -> {}",
                                                tar_zst_path.display(),
                                                file_size,
                                                tar_zst_path.display()
                                            );

                                            // Limpar arquivo tar original
                                            let _ = std::fs::remove_file(&tar_path);

                                            // Atualizar último backup na tabela backup_songs
                                            let _ = db.update_backup_song_status(
                                                song_id,
                                                &crate::domain::models::BackupStatus::Ok,
                                                None,
                                            );

                                            Ok(SongBackupResult::success(
                                                song_id.to_string(),
                                                song_name,
                                                tar_zst_path.to_string_lossy().to_string(),
                                                file_size,
                                            ))
                                        }
                                        Err(e) => {
                                            error!("Erro ao renomear arquivo: {}", e);
                                            let _ = std::fs::remove_file(&tar_zst_tmp_path);
                                            let _ = std::fs::remove_file(&tar_path);
                                            Ok(SongBackupResult::error(
                                                song_id.to_string(),
                                                song_name,
                                                format!("Erro ao finalizar compressão: {}", e),
                                            ))
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Erro ao escrever arquivo comprimido: {}", e);
                                    let _ = std::fs::remove_file(&tar_path);
                                    Ok(SongBackupResult::error(
                                        song_id.to_string(),
                                        song_name,
                                        format!("Erro ao escrever arquivo: {}", e),
                                    ))
                                }
                            }
                        }
                        Err(e) => {
                            error!("Erro ao comprimir tar: {:?}", e);
                            let _ = std::fs::remove_file(&tar_path);
                            Ok(SongBackupResult::error(
                                song_id.to_string(),
                                song_name,
                                format!("Erro ao comprimir: {}", e.to_string()),
                            ))
                        }
                    }
                }
                Err(e) => {
                    error!("Erro ao ler arquivo tar: {}", e);
                    let _ = std::fs::remove_file(&tar_path);
                    Ok(SongBackupResult::error(
                        song_id.to_string(),
                        song_name,
                        format!("Erro ao ler arquivo: {}", e),
                    ))
                }
            }
        }
        Err(e) => {
            error!("Erro ao criar tar: {:?}", e);
            let _ = std::fs::remove_file(&tar_path);
            Ok(SongBackupResult::error(
                song_id.to_string(),
                song_name,
                e.to_string(),
            ))
        }
    }
}

/// Faz backup de todas as músicas que precisam (status main ou pending)
/// Retorna lista de resultados
pub fn backup_all_songs(
    db: &Database,
    nuvem_dir: &Path,
) -> Result<Vec<SongBackupResult>, AppError> {
    info!("Iniciando backup de todas as músicas");

    // Criar diretório Song dentro de nuvem
    let songs_dir = nuvem_dir.join("Song");
    std::fs::create_dir_all(&songs_dir)
        .map_err(|e| AppError::Generic(format!(
            "Erro ao criar diretório de músicas: {}",
            e
        )))?;
    
    info!("✓ Diretório de músicas criado/confirmado: {}", songs_dir.display());

    // Obter todas as músicas com status main ou pending
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, status FROM songs WHERE status IN ('main', 'pending') ORDER BY name"
        )
        .map_err(|e| AppError::Generic(format!("Erro ao preparar query: {}", e)))?;

    let results = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| AppError::Generic(format!("Erro ao executar query: {}", e)))?;

    let mut backup_results = Vec::new();
    let mut total_count = 0;
    let mut skipped_count = 0;
    
    // Converter para vec para debugar
    let songs_list: Vec<_> = results.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Generic(format!("Erro ao coletar resultados: {}", e)))?;
    
    info!("🎵 Músicas encontradas para backup: {}", songs_list.len());
    if songs_list.is_empty() {
        info!("⚠️  Nenhuma música com status main ou pending encontrada!");
        info!("💡 Verifique o status das músicas no banco de dados");
    }

    for (song_id, song_name, status) in songs_list {
        info!("  - ID: {}, Nome: {}, Status: {}", song_id, song_name, status);
        total_count += 1;

        // Verificar se precisa fazer backup
        match should_backup_song(db, &song_id) {
            Ok(should_backup) => {
                if !should_backup {
                    skipped_count += 1;
                    info!("  ⏭️  Música {} já foi sincronizada, ignorando", song_id);
                    continue;
                }
            }
            Err(e) => {
                warn!("Erro ao verificar se deve fazer backup de {}: {}", song_id, e);
                continue;
            }
        }

        // Fazer backup da música
        match backup_song(db, &song_id, &songs_dir) {
            Ok(result) => {
                info!("✓ Backup de música {} concluído com sucesso", song_id);
                backup_results.push(result);
            }
            Err(e) => {
                warn!("Erro ao fazer backup de {}: {}", song_id, e);
            }
        }
    }

    drop(stmt);
    drop(conn);

    info!(
        "Backup de músicas concluído: {} processadas, {} ignoradas, {} sucesso, {} erro",
        total_count,
        skipped_count,
        backup_results.iter().filter(|r| r.success).count(),
        backup_results.iter().filter(|r| !r.success).count()
    );

    Ok(backup_results)
}
