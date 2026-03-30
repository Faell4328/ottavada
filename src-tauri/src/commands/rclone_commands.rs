use std::process::Command;
use tracing::{info, error};
use crate::domain::errors::AppError;
use crate::infrastructure::store::SystemStore;
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

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

/// Configura um Command para executar sem mostrar a janela de console no Windows
/// 
/// No Windows, usa a flag CREATE_NO_WINDOW (0x08000000) para ocultar a janela
/// Em outros SOs, não faz nada
#[allow(dead_code)]
fn configure_no_window_command(cmd: Command) -> Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = cmd;
        // CREATE_NO_WINDOW = 0x08000000
        cmd.creation_flags(0x08000000);
        return cmd;
    }

    #[cfg(not(target_os = "windows"))]
    {
        cmd
    }
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
    info!("Testando conexão com rclone remote: {} path: {}", remote, path);
    
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
            .args(&["lsd", &format!("{}:{}", remote, clean_path), "--max-depth", "1"])
            .output()
            .map_err(|e| {
                error!("Erro ao verificar caminho: {:?}", e);
                AppError::Generic(format!("Erro ao verificar caminho: {}", e))
            })?;
        
        if !path_test.status.success() {
            let stderr = String::from_utf8_lossy(&path_test.stderr);
            info!("Caminho '{}' não encontrado ou inacessível: {}", clean_path, stderr);
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
    info!("Iniciando upload com rclone: {} -> {}:{}", file_path, remote, path);
    
    // Extrair nome do arquivo
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| AppError::Generic("Caminho inválido".to_string()))?;
    
    // Executar upload
    let mut cmd = configure_no_window_command(Command::new(get_rclone_command()));
    let output = cmd
        .args(&["copy", &file_path, &format!("{}:{}", remote, path)])
        .output()
        .map_err(|e| {
            error!("Erro ao executar rclone upload: {:?}", e);
            AppError::Generic(format!("Erro ao fazer upload com rclone: {}", e))
        })?;
    
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
pub fn test_rclone_upload(
    store: State<'_, SystemStore>,
    remote: String,
    path: String,
) -> Result<(), AppError> {
    info!("Iniciando teste de upload com rclone: remote={}, path={}", remote, path);
    
    let app_data_dir = store.app_data_dir();
    
    // Criar diretório de testes se não existir
    let nuvem_dir = app_data_dir.join("nuvem");
    std::fs::create_dir_all(&nuvem_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao criar diretório nuvem: {}", e)))?;
    
    info!("Diretório de teste: {:?}", nuvem_dir);
    
    // Criar arquivo de teste
    let test_file_path = nuvem_dir.join("rclone_test.txt");
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
    let mut cmd = configure_no_window_command(Command::new(get_rclone_command()));
    let output = cmd
        .args(&["copy", test_file_path.to_str().unwrap_or(""), &remote_path])
        .output()
        .map_err(|e| {
            error!("Erro ao executar rclone upload: {:?}", e);
            AppError::Generic(format!("Erro ao fazer upload com rclone: {}", e))
        })?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Falha no teste de upload: {}", stderr);
        
        // Tentar remover o arquivo de teste mesmo após falha
        let _ = std::fs::remove_file(&test_file_path);
        
        return Err(AppError::Generic(format!("Falha no teste de upload: {}", stderr)));
    }
    
    info!("✓ Upload de teste concluído com sucesso");
    
    // Remover arquivo de teste local após sucesso
    std::fs::remove_file(&test_file_path)
        .map_err(|e| {
            error!("Aviso: Erro ao remover arquivo de teste: {}", e);
            AppError::Generic(format!("Aviso: Erro ao remover arquivo de teste: {}", e))
        })?;
    
    info!("✓ Arquivo de teste removido com sucesso");
    Ok(())
}

/// Deleta o arquivo de teste local em /nuvem após o usuário prosseguir com rclone
/// 
/// # Parâmetros
/// - `store`: SystemStore para obter o diretório de dados
/// 
/// # Retorna
/// - `Ok(())`: Arquivo deletado com sucesso ou não encontrado
#[tauri::command]
pub fn delete_rclone_test_file(
    store: State<'_, SystemStore>,
) -> Result<(), AppError> {
    info!("Deletando arquivo de teste local");
    
    let app_data_dir = store.app_data_dir();
    let nuvem_dir = app_data_dir.join("nuvem");
    let test_file_path = nuvem_dir.join("rclone_test.txt");
    
    // Deletar arquivo local se existir
    if test_file_path.exists() {
        std::fs::remove_file(&test_file_path)
            .map_err(|e| {
                error!("Erro ao remover arquivo de teste local: {}", e);
                AppError::Generic(format!("Erro ao remover arquivo de teste: {}", e))
            })?;
        
        info!("✓ Arquivo de teste local removido com sucesso");
    } else {
        info!("Arquivo de teste local não encontrado, nada a remover");
    }
    
    Ok(())
}
