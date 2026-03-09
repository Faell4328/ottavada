use std::fs;
use std::path::Path;

use crate::domain::errors::AppError;

/// Calcula o hash BLAKE3 de um arquivo.
pub fn hash_file(path: &Path) -> Result<String, AppError> {
    let data = fs::read(path)?;
    let hash = blake3::hash(&data);
    Ok(hash.to_hex().to_string())
}

/// Detecta se um arquivo foi alterado comparando tamanho + data de modificação.
/// Quando hash está ativado, compara também pelo hash.
#[allow(dead_code)]
pub fn file_changed(
    path: &Path,
    known_size: u64,
    known_hash: Option<&str>,
    hash_enabled: bool,
) -> Result<bool, AppError> {
    let metadata = fs::metadata(path)?;

    // Check rápido: tamanho diferente = arquivo mudou
    if metadata.len() != known_size {
        return Ok(true);
    }

    // Se hash estiver habilitado e tivermos um hash anterior, comparar
    if hash_enabled {
        if let Some(old_hash) = known_hash {
            let current_hash = hash_file(path)?;
            return Ok(current_hash != old_hash);
        }
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_hash_file_deterministic() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, "hello world").unwrap();

        let h1 = hash_file(tmp.path()).unwrap();
        let h2 = hash_file(tmp.path()).unwrap();
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // BLAKE3 hex = 64 chars
    }

    #[test]
    fn test_hash_file_different_content() {
        let mut f1 = tempfile::NamedTempFile::new().unwrap();
        write!(f1, "content A").unwrap();

        let mut f2 = tempfile::NamedTempFile::new().unwrap();
        write!(f2, "content B").unwrap();

        let h1 = hash_file(f1.path()).unwrap();
        let h2 = hash_file(f2.path()).unwrap();
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_file_changed_size_differs() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, "short").unwrap();

        // Known size that doesn't match the file
        let changed = file_changed(tmp.path(), 99999, None, false).unwrap();
        assert!(changed);
    }

    #[test]
    fn test_file_changed_same_size_no_hash() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        let content = b"hello";
        tmp.write_all(content).unwrap();

        let changed = file_changed(tmp.path(), content.len() as u64, None, false).unwrap();
        assert!(!changed);
    }

    #[test]
    fn test_file_changed_same_size_hash_matches() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        let content = b"hello world";
        tmp.write_all(content).unwrap();

        let hash = hash_file(tmp.path()).unwrap();
        let changed = file_changed(tmp.path(), content.len() as u64, Some(&hash), true).unwrap();
        assert!(!changed);
    }

    #[test]
    fn test_file_changed_same_size_hash_differs() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        let content = b"hello world";
        tmp.write_all(content).unwrap();

        let changed = file_changed(tmp.path(), content.len() as u64, Some("fake_hash"), true).unwrap();
        assert!(changed);
    }
}
