use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::domain::errors::AppError;

pub const ZSTD_LEVEL_BALANCED: i32 = 10;

pub fn serialize_msgpack_named<T: Serialize>(
    payload: &T,
    file_label: &str,
) -> Result<Vec<u8>, AppError> {
    rmp_serde::to_vec_named(payload)
        .map_err(|e| AppError::Generic(format!("Error serializing {}: {}", file_label, e)))
}

pub fn compress_zstd_with_threads(
    data: &[u8],
    level: i32,
    file_label: &str,
) -> Result<Vec<u8>, AppError> {
    let mut encoder = zstd::stream::Encoder::new(Vec::new(), 5).map_err(|e| {
        AppError::Generic(format!(
            "Error starting zstd compression of {}: {}",
            file_label, e
        ))
    })?;

    let worker_count = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1);

    encoder.multithread(worker_count as u32).map_err(|e| {
        AppError::Generic(format!(
            "Error configuring zstd multithreading for {}: {}",
            file_label, e
        ))
    })?;

    std::io::Write::write_all(&mut encoder, data).map_err(|e| {
        AppError::Generic(format!(
            "Error writing payload of {} to zstd: {}",
            file_label, e
        ))
    })?;

    encoder.finish().map_err(|e| {
        AppError::Generic(format!(
            "Error finalizing zstd compression of {}: {}",
            file_label, e
        ))
    })
}

pub fn read_zstd_msgpack<T: serde::de::DeserializeOwned>(
    path: &Path,
    file_label: &str,
) -> Result<T, AppError> {
    let file = fs::File::open(path).map_err(|e| {
        AppError::Generic(format!(
            "Error reading {} at {}: {}",
            file_label,
            path.display(),
            e
        ))
    })?;

    let decoder = zstd::stream::read::Decoder::new(file).map_err(|e| {
        AppError::Generic(format!(
            "Error decompressing {} at {}: {}",
            file_label,
            path.display(),
            e
        ))
    })?;

    rmp_serde::from_read::<_, T>(decoder).map_err(|e| {
        AppError::Generic(format!(
            "Error deserializing MessagePack {} at {}: {}",
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
            "Error writing temporary file of {}: {}",
            file_label, e
        ))
    })?;

    fs::rename(&temp_path, path)
        .map_err(|e| AppError::Generic(format!("Error finalizing {}: {}", file_label, e)))
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
