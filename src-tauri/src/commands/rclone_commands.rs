use crate::commands::common::{configure_no_window_command, run_blocking_with_store};
use crate::domain::errors::AppError;
use crate::infrastructure::store::SystemStore;
use serde_json::Value;
use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use std::time::Instant;
use tauri::State;
use tracing::{error, info, warn};

/// Retorna o comandо correto para executar rclone baseado no sistema operacional
///
/// - Windows: C:\rclone\rclone.exe
/// - Linux/macOS: rclone (do PATH)
fn get_rclone_command() -> String {
    if cfg!(target_os = "windows") {
        "C:\\rclone\\rclone.exe".to_string()
    } else {
        "rclone".to_string()
    }
}

fn ensure_cloud_dir(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let cloud_dir = app_data_dir.join("cloud");
    let legacy_dir = app_data_dir.join("nuvem");

    if cloud_dir.exists() {
        return Ok(cloud_dir);
    }

    if legacy_dir.exists() {
        std::fs::rename(&legacy_dir, &cloud_dir).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao migrar diretório legado '{}' para '{}': {}",
                legacy_dir.display(),
                cloud_dir.display(),
                e
            ))
        })?;
    }

    std::fs::create_dir_all(&cloud_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao preparar pasta local cloud: {}", e)))?;

    Ok(cloud_dir)
}

const RCLONE_TRANSFERS: &str = "1";
const RCLONE_RETRIES: &str = "2";
const RCLONE_LOW_LEVEL_RETRIES: &str = "10";
const RCLONE_CONNECT_TIMEOUT: &str = "10s";
const RCLONE_IO_TIMEOUT: &str = "180s";
const RCLONE_RC_TIMEOUT_MS: u64 = 3000;

fn active_rclone_pids() -> &'static Mutex<HashSet<u32>> {
    static ACTIVE_RCLONE_PIDS: OnceLock<Mutex<HashSet<u32>>> = OnceLock::new();
    ACTIVE_RCLONE_PIDS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn register_rclone_pid(pid: u32) {
    if let Ok(mut guard) = active_rclone_pids().lock() {
        guard.insert(pid);
    }
}

fn unregister_rclone_pid(pid: u32) {
    if let Ok(mut guard) = active_rclone_pids().lock() {
        guard.remove(&pid);
    }
}

fn list_active_rclone_pids() -> Vec<u32> {
    if let Ok(guard) = active_rclone_pids().lock() {
        guard.iter().copied().collect()
    } else {
        Vec::new()
    }
}

#[cfg(target_os = "windows")]
fn terminate_process_pid(pid: u32) -> Result<(), AppError> {
    let pid_str = pid.to_string();
    let output = configure_no_window_command(Command::new("taskkill"))
        .args(["/PID", pid_str.as_str(), "/T", "/F"])
        .output()
        .map_err(|e| AppError::Generic(format!("Erro ao encerrar processo rclone {}: {}", pid, e)))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
    if stderr.contains("not found")
        || stderr.contains("nao foi encontrado")
        || stderr.contains("não foi encontrado")
    {
        return Ok(());
    }

    Err(AppError::Generic(format!(
        "Falha ao encerrar processo rclone {}: {}",
        pid,
        String::from_utf8_lossy(&output.stderr)
    )))
}

#[cfg(not(target_os = "windows"))]
fn terminate_process_pid(pid: u32) -> Result<(), AppError> {
    let pid_str = pid.to_string();

    let term_output = Command::new("kill")
        .args(["-TERM", pid_str.as_str()])
        .output()
        .map_err(|e| AppError::Generic(format!("Erro ao encerrar processo rclone {}: {}", pid, e)))?;

    if term_output.status.success() {
        return Ok(());
    }

    let term_stderr = String::from_utf8_lossy(&term_output.stderr).to_lowercase();
    if term_stderr.contains("no such process") {
        return Ok(());
    }

    let kill_output = Command::new("kill")
        .args(["-KILL", pid_str.as_str()])
        .output()
        .map_err(|e| {
            AppError::Generic(format!(
                "Erro ao forçar encerramento do processo rclone {}: {}",
                pid, e
            ))
        })?;

    if kill_output.status.success() {
        return Ok(());
    }

    let kill_stderr = String::from_utf8_lossy(&kill_output.stderr).to_lowercase();
    if kill_stderr.contains("no such process") {
        return Ok(());
    }

    Err(AppError::Generic(format!(
        "Falha ao encerrar processo rclone {}: {}",
        pid,
        String::from_utf8_lossy(&kill_output.stderr)
    )))
}

fn run_rclone_once(args: &[&str], operation_label: &str) -> Result<std::process::Output, AppError> {
    let mut cmd = configure_no_window_command(Command::new(get_rclone_command()));
    cmd.args(args);

    let child = cmd.spawn().map_err(|e| {
        error!("Erro ao executar rclone [{}]: {:?}", operation_label, e);
        AppError::Generic(format!("Erro ao executar rclone ({}): {}", operation_label, e))
    })?;

    let pid = child.id();
    register_rclone_pid(pid);

    let output = child.wait_with_output().map_err(|e| {
        AppError::Generic(format!(
            "Erro ao aguardar execução do rclone ({}): {}",
            operation_label, e
        ))
    });

    unregister_rclone_pid(pid);
    output
}

pub fn terminate_running_rclone_processes() {
    let pids = list_active_rclone_pids();
    if pids.is_empty() {
        return;
    }

    info!(
        "Encerrando {} processo(s) rclone ativos durante finalização do app",
        pids.len()
    );

    for pid in pids {
        if let Err(err) = terminate_process_pid(pid) {
            warn!("Falha ao encerrar processo rclone {}: {}", pid, err);
        }
        unregister_rclone_pid(pid);
    }
}

fn run_rclone_with_retry(args: &[&str], operation_label: &str) -> Result<std::process::Output, AppError> {
    let mut output = run_rclone_once(args, operation_label)?;
    if output.status.success() {
        return Ok(output);
    }

    let first_stderr = String::from_utf8_lossy(&output.stderr);
    error!(
        "Falha na 1a tentativa do rclone [{}]: {}",
        operation_label, first_stderr
    );
    info!(
        "Tentando novamente rclone [{}] por falha transitória",
        operation_label
    );

    thread::sleep(Duration::from_millis(350));
    output = run_rclone_once(args, operation_label)?;
    Ok(output)
}

fn append_common_copy_flags(args: &mut Vec<&str>) {
    args.extend([
        "--transfers",
        RCLONE_TRANSFERS,
        "--check-first",
        "--retries",
        RCLONE_RETRIES,
        "--low-level-retries",
        RCLONE_LOW_LEVEL_RETRIES,
        "--contimeout",
        RCLONE_CONNECT_TIMEOUT,
        "--timeout",
        RCLONE_IO_TIMEOUT,
        "--fast-list",
    ]);
}

fn append_common_sync_flags(args: &mut Vec<&str>) {
    args.extend([
        "--rc",
        "--rc-addr=127.0.0.1:5572",
        "--transfers",
        RCLONE_TRANSFERS,
        "--check-first",
        "--retries",
        RCLONE_RETRIES,
        "--low-level-retries",
        RCLONE_LOW_LEVEL_RETRIES,
        "--contimeout",
        RCLONE_CONNECT_TIMEOUT,
        "--timeout",
        RCLONE_IO_TIMEOUT,
        // Evita sincronizar artefatos temporários do pipeline de geração.
        "--exclude",
        "*.tmp",
        "--exclude",
        "**/*.tmp",
        "--fast-list",
    ]);
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RcloneSyncDirection {
    Upload,
    Download,
}

impl RcloneSyncDirection {
    fn from_str(value: &str) -> Result<Self, AppError> {
        match value {
            "upload" => Ok(Self::Upload),
            "download" => Ok(Self::Download),
            _ => Err(AppError::Generic(format!(
                "Direção de sync inválida: {}. Use 'upload' ou 'download'",
                value
            ))),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RcloneSyncSummary {
    pub direction: String,
    pub source: String,
    pub destination: String,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RcloneSelectiveUploadSummary {
    pub uploaded_count: usize,
    pub skipped_count: usize,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RcloneRcStats {
    pub active: bool,
    pub bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: f64,
    pub eta_seconds: Option<i64>,
    pub percentage: Option<f64>,
}

fn fetch_rclone_rc_stats() -> Result<Option<RcloneRcStats>, AppError> {
    let mut stream = match TcpStream::connect("127.0.0.1:5572") {
        Ok(stream) => stream,
        Err(_) => return Ok(None),
    };

    stream
        .set_read_timeout(Some(Duration::from_millis(RCLONE_RC_TIMEOUT_MS)))
        .map_err(|e| AppError::Generic(format!("Erro ao configurar timeout de leitura RC: {}", e)))?;
    stream
        .set_write_timeout(Some(Duration::from_millis(RCLONE_RC_TIMEOUT_MS)))
        .map_err(|e| AppError::Generic(format!("Erro ao configurar timeout de escrita RC: {}", e)))?;

    let request = concat!(
        "POST /core/stats HTTP/1.1\r\n",
        "Host: 127.0.0.1:5572\r\n",
        "Content-Type: application/json\r\n",
        "Content-Length: 2\r\n",
        "Connection: close\r\n\r\n",
        "{}"
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| AppError::Generic(format!("Erro ao consultar RC do rclone: {}", e)))?;

    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|e| AppError::Generic(format!("Erro ao ler resposta RC do rclone: {}", e)))?;

    let response_text = String::from_utf8_lossy(&response);
    let (_, body) = response_text
        .split_once("\r\n\r\n")
        .ok_or_else(|| AppError::Generic("Resposta RC inválida do rclone".to_string()))?;

    let parsed: Value = serde_json::from_str(body)
        .map_err(|e| AppError::Generic(format!("Erro ao parsear core/stats do rclone: {}", e)))?;

    let bytes = parsed.get("bytes").and_then(Value::as_u64).unwrap_or(0);
    let total_bytes_raw = parsed.get("totalBytes").and_then(Value::as_u64).unwrap_or(0);
    let total_bytes = if total_bytes_raw > 0 {
        Some(total_bytes_raw)
    } else {
        None
    };

    let speed_bytes_per_sec = parsed.get("speed").and_then(Value::as_f64).unwrap_or(0.0);
    let eta_seconds = parsed.get("eta").and_then(Value::as_i64).filter(|eta| *eta >= 0);

    let transferring_count = parsed
        .get("transferring")
        .and_then(Value::as_array)
        .map(|items| items.len())
        .unwrap_or(0);
    let checking_count = parsed
        .get("checking")
        .and_then(Value::as_array)
        .map(|items| items.len())
        .unwrap_or(0);

    let active = transferring_count > 0 || checking_count > 0 || speed_bytes_per_sec > 0.0;

    let transferring_progress_fraction = parsed
        .get("transferring")
        .and_then(Value::as_array)
        .and_then(|items| {
            let mut sum_bytes = 0_u64;
            let mut sum_sizes = 0_u64;
            let mut sum_percentage_fraction = 0.0_f64;
            let mut percentage_items = 0_u64;

            for item in items {
                let item_bytes = item.get("bytes").and_then(Value::as_u64).unwrap_or(0);
                let item_size = item.get("size").and_then(Value::as_u64).unwrap_or(0);

                if item_size > 0 {
                    sum_bytes = sum_bytes.saturating_add(item_bytes.min(item_size));
                    sum_sizes = sum_sizes.saturating_add(item_size);
                    continue;
                }

                if let Some(item_percentage) = item.get("percentage").and_then(Value::as_f64) {
                    sum_percentage_fraction += (item_percentage / 100.0).clamp(0.0, 1.0);
                    percentage_items = percentage_items.saturating_add(1);
                }
            }

            if sum_sizes > 0 {
                Some((sum_bytes as f64 / sum_sizes as f64).clamp(0.0, 1.0))
            } else if percentage_items > 0 {
                Some((sum_percentage_fraction / percentage_items as f64).clamp(0.0, 1.0))
            } else {
                None
            }
        });

    let transfers_done = parsed.get("transfers").and_then(Value::as_u64).unwrap_or(0);
    let total_transfers = parsed
        .get("totalTransfers")
        .and_then(Value::as_u64)
        .filter(|total| *total > 0);

    let percentage = if let Some(total) = total_bytes.filter(|total| *total > 0) {
        Some(((bytes as f64 / total as f64) * 100.0).clamp(0.0, 100.0))
    } else if let Some(total) = total_transfers {
        let completed = transfers_done.min(total);
        let remaining = total.saturating_sub(completed);
        let inflight = (transferring_count as u64).min(remaining);
        let inflight_progress = transferring_progress_fraction.unwrap_or(0.0) * inflight as f64;
        Some((((completed as f64 + inflight_progress) / total as f64) * 100.0).clamp(0.0, 100.0))
    } else {
        transferring_progress_fraction.map(|fraction| (fraction * 100.0).clamp(0.0, 100.0))
    };

    Ok(Some(RcloneRcStats {
        active,
        bytes,
        total_bytes,
        speed_bytes_per_sec,
        eta_seconds,
        percentage,
    }))
}

fn reset_rclone_rc_stats() -> Result<(), AppError> {
    let mut stream = match TcpStream::connect("127.0.0.1:5572") {
        Ok(stream) => stream,
        Err(_) => return Ok(()),
    };

    stream
        .set_read_timeout(Some(Duration::from_millis(RCLONE_RC_TIMEOUT_MS)))
        .map_err(|e| AppError::Generic(format!("Erro ao configurar timeout de leitura RC: {}", e)))?;
    stream
        .set_write_timeout(Some(Duration::from_millis(RCLONE_RC_TIMEOUT_MS)))
        .map_err(|e| AppError::Generic(format!("Erro ao configurar timeout de escrita RC: {}", e)))?;

    let request = concat!(
        "POST /core/stats-reset HTTP/1.1\r\n",
        "Host: 127.0.0.1:5572\r\n",
        "Content-Type: application/json\r\n",
        "Content-Length: 2\r\n",
        "Connection: close\r\n\r\n",
        "{}"
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| AppError::Generic(format!("Erro ao resetar RC do rclone: {}", e)))?;

    // Consome resposta para fechar corretamente a conexao.
    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|e| AppError::Generic(format!("Erro ao ler resposta do reset RC: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub fn get_rclone_rc_stats() -> Result<Option<RcloneRcStats>, AppError> {
    fetch_rclone_rc_stats()
}

/// Testa a conexão com um remote do rclone
///
/// # Parâmetros
/// - `remote`: Nome do remote configurado no rclone (ex: "gdrive", "pcloud")
/// - `path`: Caminho no remote a testar (ex: "ScoreMaestro")
///
/// # Retorna
/// - `Ok(true)`: Conexão testada com sucesso
/// - `Ok(false)`: Falha na conexão
/// - `Err(AppError)`: Erro ao executar teste
#[tauri::command]
pub fn test_rclone_connection(remote: String, path: String) -> Result<bool, AppError> {
    info!(
        "Testando conexão com rclone remote: {} path: {}",
        remote, path
    );

    // Limpar o path (remover barras extras)
    let clean_path = path.trim().trim_start_matches('/').trim_end_matches('/');

    // Primeiro, testar a conexão com o remote root
    info!("Testando acesso ao remote: {}", remote);
    let mut cmd = configure_no_window_command(Command::new(get_rclone_command()));
    let output = cmd
        .args(&["lsd", &format!("{}:", remote), "--max-depth", "1"])
        .output()
        .map_err(|e| {
            error!("Erro ao executar rclone: {:?}", e);
            AppError::Generic(format!(
                "Erro ao executar rclone. Verifique se o rclone está instalado e configurado: {}",
                e
            ))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Falha ao acessar remote '{}': {}", remote, stderr);

        // Verificar se é problema de configuração do rclone
        if stderr.contains("didn't find section in config file") {
            return Err(AppError::Generic(format!(
                "O remote '{}' não está configurado no rclone. Execute 'rclone config' para configurar.",
                remote
            )));
        }

        return Ok(false);
    }

    info!("✓ Acesso ao remote '{}' confirmado", remote);

    // Se um caminho específico foi fornecido, tentar verificar se existe
    if !clean_path.is_empty() {
        info!("Verificando se o caminho existe: {}", clean_path);
        let mut path_cmd = configure_no_window_command(Command::new(get_rclone_command()));
        let path_test = path_cmd
            .args(&[
                "lsd",
                &format!("{}:{}", remote, clean_path),
                "--max-depth",
                "1",
            ])
            .output()
            .map_err(|e| {
                error!("Erro ao verificar caminho: {:?}", e);
                AppError::Generic(format!("Erro ao verificar caminho: {}", e))
            })?;

        if !path_test.status.success() {
            let stderr = String::from_utf8_lossy(&path_test.stderr);
            info!(
                "Caminho '{}' não encontrado ou inacessível: {}",
                clean_path, stderr
            );
            // Não tratamos como erro - apenas retornamos true pois o remote está configurado
            // O caminho será criado automaticamente durante o primeiro backup
        } else {
            info!("✓ Caminho '{}' confirmado", clean_path);
        }
    }

    info!("✓ Conexão com rclone testada com sucesso");
    Ok(true)
}

/// Faz upload de um arquivo usando rclone
///
/// # Parâmetros
/// - `remote`: Nome do remote configurado no rclone
/// - `path`: Caminho de destino no remote
/// - `file_path`: Caminho local do arquivo a fazer upload
///
/// # Retorna
/// - `Ok(String)`: Caminho remoto do arquivo enviado
/// - `Err(AppError)`: Erro durante o upload
#[tauri::command]
pub fn upload_with_rclone(
    remote: String,
    path: String,
    file_path: String,
) -> Result<String, AppError> {
    info!(
        "Iniciando upload com rclone: {} -> {}:{}",
        file_path, remote, path
    );

    // Extrair nome do arquivo
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| AppError::Generic("Caminho inválido".to_string()))?;

    // Executar upload
    let destination = format!("{}:{}", remote, path);
    let mut args = vec!["copy", file_path.as_str(), destination.as_str()];
    append_common_copy_flags(&mut args);
    let output = run_rclone_with_retry(&args, "upload")?;

    if output.status.success() {
        let remote_path = format!("{}:{}/{}", remote, path, file_name);
        info!("Upload concluído com sucesso: {}", remote_path);
        Ok(remote_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Falha no upload rclone: {}", stderr);
        Err(AppError::Generic(format!("Falha no upload: {}", stderr)))
    }
}

/// Sincroniza a pasta local `/cloud` com o remote configurado no rclone usando `rclone sync`.
///
/// Sempre utiliza os parâmetros exigidos pelo projeto:
/// - `--rc`
/// - `--rc-addr=127.0.0.1:5572`
/// - `--transfers=10`
#[tauri::command]
pub async fn sync_cloud_with_rclone(
    store: State<'_, SystemStore>,
    direction: String,
) -> Result<RcloneSyncSummary, AppError> {
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao sincronizar com rclone",
        move |store| sync_cloud_with_rclone_impl(&store, &direction),
    )
    .await
}

#[tauri::command]
pub async fn upload_cloud_paths_with_rclone(
    store: State<'_, SystemStore>,
    relative_paths: Vec<String>,
) -> Result<RcloneSelectiveUploadSummary, AppError> {
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao enviar caminhos selecionados com rclone",
        move |store| upload_cloud_paths_with_rclone_impl(&store, &relative_paths),
    )
    .await
}

fn upload_cloud_paths_with_rclone_impl(
    store: &SystemStore,
    relative_paths: &[String],
) -> Result<RcloneSelectiveUploadSummary, AppError> {
    let _ = reset_rclone_rc_stats();

    let settings = store.get_app_settings()?;
    let rclone_config = settings
        .rclone_config
        .ok_or_else(|| AppError::Generic("Configuração do rclone não encontrada".to_string()))?;

    let clean_remote_path = rclone_config
        .path
        .trim()
        .trim_start_matches('/')
        .trim_end_matches('/');

    let remote_target = if clean_remote_path.is_empty() {
        format!("{}:", rclone_config.remote)
    } else {
        format!("{}:{}", rclone_config.remote, clean_remote_path)
    };

    let cloud_local_dir = ensure_cloud_dir(store.app_data_dir())?;
    let cloud_local_dir_str = cloud_local_dir.to_str().ok_or_else(|| {
        AppError::Generic(format!(
            "Caminho local da pasta cloud inválido para upload incremental: {}",
            cloud_local_dir.display()
        ))
    })?;

    let started_at = Instant::now();
    let mut skipped_count: usize = 0;
    let mut files_to_upload: Vec<String> = Vec::new();

    for relative_path in relative_paths {
        let normalized_relative = relative_path
            .trim()
            .trim_start_matches('/')
            .replace('\\', "/");

        if normalized_relative.is_empty() {
            skipped_count += 1;
            continue;
        }

        let local_path = cloud_local_dir.join(&normalized_relative);
        if !local_path.exists() {
            info!(
                "Pulando upload incremental de '{}' (arquivo local não existe)",
                normalized_relative
            );
            skipped_count += 1;
            continue;
        }

        if local_path.is_file() {
            files_to_upload.push(normalized_relative);
            continue;
        }

        if local_path.is_dir() {
            let mut stack = vec![local_path.clone()];

            while let Some(current_dir) = stack.pop() {
                let entries = std::fs::read_dir(&current_dir).map_err(|e| {
                    AppError::Generic(format!(
                        "Erro ao listar diretório incremental '{}': {}",
                        current_dir.display(),
                        e
                    ))
                })?;

                for entry_result in entries {
                    let entry = entry_result.map_err(|e| {
                        AppError::Generic(format!(
                            "Erro ao ler entrada de diretório incremental '{}': {}",
                            current_dir.display(),
                            e
                        ))
                    })?;

                    let entry_path = entry.path();
                    if entry_path.is_dir() {
                        stack.push(entry_path);
                        continue;
                    }

                    if !entry_path.is_file() {
                        continue;
                    }

                    let relative_entry = entry_path.strip_prefix(&cloud_local_dir).map_err(|e| {
                        AppError::Generic(format!(
                            "Erro ao calcular caminho relativo '{}' para upload incremental: {}",
                            entry_path.display(),
                            e
                        ))
                    })?;

                    let normalized_entry = relative_entry.to_string_lossy().replace('\\', "/");
                    if !normalized_entry.is_empty() {
                        files_to_upload.push(normalized_entry);
                    }
                }
            }

            continue;
        }

        skipped_count += 1;
    }

    files_to_upload.sort();
    files_to_upload.dedup();

    if files_to_upload.is_empty() {
        return Ok(RcloneSelectiveUploadSummary {
            uploaded_count: 0,
            skipped_count,
            duration_ms: started_at.elapsed().as_millis(),
        });
    }

    let files_from_name = {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        format!(".rclone-files-from-{}.txt", stamp)
    };
    let files_from_path = store.app_data_dir().join(files_from_name);
    let files_from_content = format!("{}\n", files_to_upload.join("\n"));

    std::fs::write(&files_from_path, files_from_content).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao gerar lista de upload incremental '{}': {}",
            files_from_path.display(),
            e
        ))
    })?;

    let files_from_str = files_from_path.to_str().ok_or_else(|| {
        AppError::Generic(format!(
            "Caminho da lista de upload incremental inválido: {}",
            files_from_path.display()
        ))
    })?;

    let mut args = vec![
        "copy",
        cloud_local_dir_str,
        remote_target.as_str(),
        "--files-from",
        files_from_str,
        "--no-traverse",
        "--rc",
        "--rc-addr=127.0.0.1:5572",
    ];

    append_common_copy_flags(&mut args);
    let output = run_rclone_with_retry(&args, "upload-selective:batch");
    let _ = std::fs::remove_file(&files_from_path);

    let output = output?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Falha no upload incremental em lote: {}", stderr);
        return Err(AppError::Generic(format!(
            "Falha no upload incremental em lote: {}",
            stderr
        )));
    }

    Ok(RcloneSelectiveUploadSummary {
        uploaded_count: files_to_upload.len(),
        skipped_count,
        duration_ms: started_at.elapsed().as_millis(),
    })
}

fn sync_cloud_with_rclone_impl(
    store: &SystemStore,
    direction: &str,
) -> Result<RcloneSyncSummary, AppError> {
    let _ = reset_rclone_rc_stats();

    let sync_direction = RcloneSyncDirection::from_str(direction.trim())?;

    let settings = store.get_app_settings()?;
    let rclone_config = settings
        .rclone_config
        .ok_or_else(|| AppError::Generic("Configuração do rclone não encontrada".to_string()))?;

    let clean_remote_path = rclone_config
        .path
        .trim()
        .trim_start_matches('/')
        .trim_end_matches('/');

    let remote_target = if clean_remote_path.is_empty() {
        format!("{}:", rclone_config.remote)
    } else {
        format!("{}:{}", rclone_config.remote, clean_remote_path)
    };

    let cloud_local_dir = ensure_cloud_dir(store.app_data_dir())?;

    let local_target = cloud_local_dir.to_string_lossy().to_string();

    let (source, destination, direction_label) = match sync_direction {
        RcloneSyncDirection::Upload => {
            (local_target.clone(), remote_target.clone(), "upload".to_string())
        }
        RcloneSyncDirection::Download => {
            (remote_target.clone(), local_target.clone(), "download".to_string())
        }
    };

    info!(
        "Iniciando rclone sync [{}]: {} -> {}",
        direction_label, source, destination
    );

    let started_at = Instant::now();

    let mut args = vec!["sync", source.as_str(), destination.as_str()];
    append_common_sync_flags(&mut args);
    let output = run_rclone_with_retry(&args, &format!("sync:{}", direction_label))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Falha no rclone sync [{}]: {}", direction_label, stderr);
        return Err(AppError::Generic(format!(
            "Falha no rclone sync ({}): {}",
            direction_label, stderr
        )));
    }

    let duration_ms = started_at.elapsed().as_millis();
    info!(
        "✓ rclone sync [{}] concluído em {}ms",
        direction_label, duration_ms
    );

    Ok(RcloneSyncSummary {
        direction: direction_label,
        source,
        destination,
        duration_ms,
    })
}

/// Faz um teste completo de upload com rclone
///
/// Cria um arquivo de teste local, faz upload via rclone e remove o arquivo local após sucesso
///
/// # Parâmetros
/// - `store`: SystemStore para obter o diretório de dados
/// - `remote`: Nome do remote configurado no rclone
/// - `path`: Caminho de destino no remote
///
/// # Retorna
/// - `Ok(())`: Teste completado com sucesso
/// - `Err(AppError)`: Erro durante o teste
#[tauri::command]
pub async fn test_rclone_upload(
    store: State<'_, SystemStore>,
    remote: String,
    path: String,
) -> Result<(), AppError> {
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao testar upload do rclone",
        move |store| test_rclone_upload_impl(&store, &remote, &path),
    )
    .await
}

fn test_rclone_upload_impl(store: &SystemStore, remote: &str, path: &str) -> Result<(), AppError> {
    info!(
        "Iniciando teste de upload com rclone: remote={}, path={}",
        remote, path
    );

    // Criar diretório de testes se não existir
    let cloud_dir = ensure_cloud_dir(store.app_data_dir())?;

    info!("Diretório de teste: {:?}", cloud_dir);

    // Criar arquivo de teste
    let test_file_path = cloud_dir.join("rclone_test.txt");
    let test_content = "Upload feito com sucesso";

    std::fs::write(&test_file_path, test_content)
        .map_err(|e| AppError::Generic(format!("Erro ao criar arquivo de teste: {}", e)))?;

    info!("Arquivo de teste criado: {:?}", test_file_path);

    // Limpar o path (remover barras extras)
    let clean_path = path.trim().trim_start_matches('/').trim_end_matches('/');
    let remote_path = if clean_path.is_empty() {
        format!("{}:", remote)
    } else {
        format!("{}:{}", remote, clean_path)
    };

    // Fazer upload do arquivo de teste
    info!("Iniciando upload para: {}", remote_path);
    let test_file_str = test_file_path.to_str().ok_or_else(|| {
        AppError::Generic("Caminho local de teste inválido para upload rclone".to_string())
    })?;

    let mut args = vec!["copy", test_file_str, remote_path.as_str(), "--no-traverse"];
    append_common_copy_flags(&mut args);
    let output = run_rclone_with_retry(&args, "test-upload")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Falha no teste de upload: {}", stderr);

        // Tentar remover o arquivo de teste mesmo após falha
        let _ = std::fs::remove_file(&test_file_path);

        return Err(AppError::Generic(format!(
            "Falha no teste de upload: {}",
            stderr
        )));
    }

    info!("✓ Upload de teste concluído com sucesso");

    // Remover arquivo de teste local após sucesso
    std::fs::remove_file(&test_file_path).map_err(|e| {
        error!("Aviso: Erro ao remover arquivo de teste: {}", e);
        AppError::Generic(format!("Aviso: Erro ao remover arquivo de teste: {}", e))
    })?;

    info!("✓ Arquivo de teste removido com sucesso");
    Ok(())
}

/// Deleta o arquivo de teste local em /cloud após o usuário prosseguir com rclone
///
/// # Parâmetros
/// - `store`: SystemStore para obter o diretório de dados
///
/// # Retorna
/// - `Ok(())`: Arquivo deletado com sucesso ou não encontrado
#[tauri::command]
pub fn delete_rclone_test_file(store: State<'_, SystemStore>) -> Result<(), AppError> {
    info!("Deletando arquivo de teste local");

    let app_data_dir = store.app_data_dir();
    let cloud_dir = ensure_cloud_dir(app_data_dir)?;
    let test_file_path = cloud_dir.join("rclone_test.txt");

    // Deletar arquivo local se existir
    if test_file_path.exists() {
        std::fs::remove_file(&test_file_path).map_err(|e| {
            error!("Erro ao remover arquivo de teste local: {}", e);
            AppError::Generic(format!("Erro ao remover arquivo de teste: {}", e))
        })?;

        info!("✓ Arquivo de teste local removido com sucesso");
    } else {
        info!("Arquivo de teste local não encontrado, nada a remover");
    }

    Ok(())
}
