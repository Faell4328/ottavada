use tauri::State;
use std::path::PathBuf;
use tracing::info;

use crate::domain::errors::AppError;
use crate::infrastructure::database::Database;

/// Função interna para exportar banco de dados para um arquivo comprimido
/// Pode ser usada por comandos ou por outros serviços internos
pub fn export_database_to_path_internal(
    db: &Database,
    output_path: String,
) -> Result<(), AppError> {
    let output_path = PathBuf::from(&output_path);
    
    // Validar se o diretório pai existe
    if let Some(parent) = output_path.parent() {
        if !parent.exists() {
            return Err(AppError::Generic(format!(
                "Diretório pai não existe: {}",
                parent.display()
            )));
        }
    }
    
    // Exportar para MessagePack
    let msgpack_data = db.export_and_serialize_msgpack()?;
    info!("Banco de dados serializado para MessagePack ({} bytes)", msgpack_data.len());
    
    // Comprimir com xz
    let compressed_data = Database::compress_xz(&msgpack_data)?;
    info!("Dados comprimidos com xz ({} bytes)", compressed_data.len());
    
    // Salvar em arquivo temporário
    let temp_file = if output_path.extension().map_or(false, |ext| ext == "xz") {
        output_path.with_extension("xz.tmp")
    } else {
        PathBuf::from(format!("{}.tmp", output_path.display()))
    };
    
    std::fs::write(&temp_file, &compressed_data)
        .map_err(|e| AppError::Generic(format!(
            "Erro ao escrever arquivo temporário {}: {}",
            temp_file.display(),
            e
        )))?;
    
    info!("Arquivo temporário criado: {}", temp_file.display());
    
    // Renomear arquivo temporário para final
    std::fs::rename(&temp_file, &output_path)
        .map_err(|e| AppError::Generic(format!(
            "Erro ao renomear arquivo de {} para {}: {}",
            temp_file.display(),
            output_path.display(),
            e
        )))?;
    
    info!("Arquivo exportado com sucesso: {}", output_path.display());
    
    Ok(())
}

/// Exporta o banco de dados completo para MessagePack e retorna o caminho do arquivo
/// 
/// O arquivo é salvo com o nome `database.msgpack` no diretório temporário do SO
/// 
/// # Parâmetros
/// - `db`: Instância do banco de dados
/// 
/// # Retorna
/// - `Ok(String)`: Caminho completo do arquivo exportado
/// - `Err(AppError)`: Erro durante a exportação
#[tauri::command]
pub fn export_database_to_msgpack(db: State<'_, Database>) -> Result<String, AppError> {
    info!("Iniciando exportação do banco de dados para MessagePack");
    
    // Exportar para MessagePack (sem compressão)
    let msgpack_data = db.export_and_serialize_msgpack()?;
    info!("Banco de dados serializado para MessagePack ({} bytes)", msgpack_data.len());
    
    // Definir caminho de destino no diretório temporário
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("database.msgpack");
    
    // Escrever arquivo
    std::fs::write(&file_path, &msgpack_data)
        .map_err(|e| AppError::Generic(format!("Erro ao escrever arquivo MessagePack: {}", e)))?;
    
    let path_str = file_path.to_string_lossy().to_string();
    info!("Arquivo MessagePack exportado com sucesso: {}", path_str);
    
    Ok(path_str)
}

/// Exporta o banco de dados para MessagePack comprimido com xz
/// 
/// O arquivo é salvo com o nome `database.msgpack.xz` no diretório temporário do SO
/// 
/// # Parâmetros
/// - `db`: Instância do banco de dados
/// 
/// # Retorna
/// - `Ok(String)`: Caminho completo do arquivo exportado
/// - `Err(AppError)`: Erro durante a exportação ou compressão
#[tauri::command]
pub fn export_database_to_msgpack_xz(db: State<'_, Database>) -> Result<String, AppError> {
    info!("Iniciando exportação do banco de dados para MessagePack com compressão xz");
    
    // Exportar para MessagePack
    let msgpack_data = db.export_and_serialize_msgpack()?;
    info!("Banco de dados serializado para MessagePack ({} bytes)", msgpack_data.len());
    
    // Comprimir com xz
    let compressed_data = Database::compress_xz(&msgpack_data)?;
    info!("Dados comprimidos com xz ({} bytes, compressão: {:.2}%)", 
        compressed_data.len(),
        (1.0 - (compressed_data.len() as f64 / msgpack_data.len() as f64)) * 100.0
    );
    
    // Definir caminho de destino no diretório temporário
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("database.msgpack.xz");
    
    // Escrever arquivo
    std::fs::write(&file_path, &compressed_data)
        .map_err(|e| AppError::Generic(format!("Erro ao escrever arquivo comprimido: {}", e)))?;
    
    let path_str = file_path.to_string_lossy().to_string();
    info!("Arquivo MessagePack comprimido exportado com sucesso: {}", path_str);
    
    Ok(path_str)
}

/// Exporta o banco de dados para um arquivo tmp com renomeação segura
/// 
/// Primeiro salva em `database.msgpack.xz.tmp` e depois renomeia para `database.msgpack.xz`
/// Isso evita arquivos corrompidos caso a operação seja interrompida
/// 
/// # Parâmetros
/// - `db`: Instância do banco de dados
/// - `output_path`: Caminho completo onde salvar o arquivo
/// 
/// # Retorna
/// - `Ok(())`: Arquivo exportado com sucesso
/// - `Err(AppError)`: Erro durante a exportação
#[tauri::command]
pub fn export_database_to_path(
    db: State<'_, Database>,
    output_path: String,
) -> Result<(), AppError> {
    info!("Iniciando exportação do banco de dados para: {}", output_path);
    
    export_database_to_path_internal(&*db, output_path)
}
