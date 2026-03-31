use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::domain::errors::AppError;

pub const ZSTD_LEVEL_BALANCED: i32 = 10;

pub fn serialize_msgpack_named<T: Serialize>(payload: &T, file_label: &str) -> Result<Vec<u8>, AppError> {
    rmp_serde::to_vec_named(payload)
        .map_err(|e| AppError::Generic(format!("Erro ao serializar {}: {}", file_label, e)))
}

pub fn compress_zstd_with_threads(
    data: &[u8],
    level: i32,
    file_label: &str,
) -> Result<Vec<u8>, AppError> {
    let mut encoder = zstd::stream::Encoder::new(Vec::new(), level).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao iniciar compressao zstd de {}: {}",
            file_label, e
        ))
    })?;

    let worker_count = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1);

    encoder.multithread(worker_count as u32).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao configurar multithread do zstd de {}: {}",
            file_label, e
        ))
    })?;

    std::io::Write::write_all(&mut encoder, data).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever payload de {} no zstd: {}",
            file_label, e
        ))
    })?;

    encoder.finish().map_err(|e| {
        AppError::Generic(format!(
            "Erro ao finalizar compressao zstd de {}: {}",
            file_label, e
        ))
    })
}

pub fn read_zstd_msgpack<T: serde::de::DeserializeOwned>(
    path: &Path,
    file_label: &str,
) -> Result<T, AppError> {
    let compressed = fs::read(path).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao ler {} em {}: {}",
            file_label,
            path.display(),
            e
        ))
    })?;

    let decompressed = zstd::stream::decode_all(compressed.as_slice()).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao descompactar {} em {}: {}",
            file_label,
            path.display(),
            e
        ))
    })?;

    rmp_serde::from_slice::<T>(&decompressed).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao desserializar MessagePack {} em {}: {}",
            file_label,
            path.display(),
            e
        ))
    })
}

pub fn write_atomic(path: &Path, bytes: &[u8], file_label: &str) -> Result<(), AppError> {
    let temp_path = temp_path_for(path);

    fs::write(&temp_path, bytes).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever arquivo temporario de {}: {}",
            file_label, e
        ))
    })?;

    fs::rename(&temp_path, path)
        .map_err(|e| AppError::Generic(format!("Erro ao finalizar {}: {}", file_label, e)))
}

fn temp_path_for(path: &Path) -> PathBuf {
    let mut temp = path.to_path_buf();
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("tmp");
    temp.set_extension(format!("{}.tmp", extension));
    temp
}
