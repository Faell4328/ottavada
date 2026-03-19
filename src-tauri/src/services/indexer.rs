use std::path::Path;
use walkdir::WalkDir;
use chrono::NaiveDateTime;

use crate::domain::models::IndexedFile;

/// Extensões de arquivo suportadas
const SUPPORTED_EXTENSIONS: &[&str] = &["pdf", "mus", "musx"];

/// Indexa um diretório, retornando todos os arquivos de partitura encontrados.
pub fn scan_directory(dir_path: &Path) -> Vec<IndexedFile> {
    let mut files = Vec::new();

    for entry in WalkDir::new(dir_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        if !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
            continue;
        }

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        let (name, instrument) = parse_filename(&file_stem);

        files.push(IndexedFile {
            path: path.to_string_lossy().to_string(),
            name,
            instrument,
            extension,
        });
    }

    files
}

/// Extrai nome e instrumento do nome do arquivo.
/// Padrão esperado: "nome - instrumento.musx"
/// Se não houver " - ", o instrumento fica None e o nome é o nome completo.
fn parse_filename(file_stem: &str) -> (String, Option<String>) {
    if let Some(idx) = file_stem.rfind(" - ") {
        let name = file_stem[..idx].trim().to_string();
        let instrument = file_stem[idx + 3..].trim().to_string();
        if instrument.is_empty() {
            (name, None)
        } else {
            (name, Some(instrument))
        }
    } else {
        (file_stem.to_string(), None)
    }
}

/// Obtém os metadados do arquivo (size e modified_at)
pub fn get_file_metadata(file_path: &Path) -> Result<(u64, NaiveDateTime), std::io::Error> {
    let metadata = std::fs::metadata(file_path)?;
    let file_size = metadata.len();
    let modified_at = metadata
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| {
            let timestamp = d.as_secs() as i64;
            chrono::DateTime::from_timestamp(timestamp, 0)
                .map(|dt| dt.naive_utc())
                .unwrap_or_else(|| chrono::Local::now().naive_local())
        })
        .unwrap_or_else(|_| chrono::Local::now().naive_local());
    
    Ok((file_size, modified_at))
}

/// Detecta alterações no arquivo comparando size e modified_at
pub struct FileChangeDetector {
    pub current_size: u64,
    pub current_modified_at: NaiveDateTime,
    pub stored_size: u64,
    pub stored_modified_at: NaiveDateTime,
}

impl FileChangeDetector {
    pub fn new(
        current_size: u64,
        current_modified_at: NaiveDateTime,
        stored_size: u64,
        stored_modified_at: NaiveDateTime,
    ) -> Self {
        Self {
            current_size,
            current_modified_at,
            stored_size,
            stored_modified_at,
        }
    }

    /// Verifica se o arquivo foi alterado
    pub fn has_changed(&self) -> bool {
        self.current_size != self.stored_size || self.current_modified_at != self.stored_modified_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_filename_with_instrument() {
        let (name, instrument) = parse_filename("Canon in D - Violino 1");
        assert_eq!(name, "Canon in D");
        assert_eq!(instrument, Some("Violino 1".to_string()));
    }

    #[test]
    fn test_parse_filename_without_instrument() {
        let (name, instrument) = parse_filename("Moonlight Sonata");
        assert_eq!(name, "Moonlight Sonata");
        assert_eq!(instrument, None);
    }

    #[test]
    fn test_parse_filename_with_multiple_dashes() {
        let (name, instrument) = parse_filename("Ode to Joy - Arr. Sousa - Piano");
        assert_eq!(name, "Ode to Joy - Arr. Sousa");
        assert_eq!(instrument, Some("Piano".to_string()));
    }

    #[test]
    fn test_parse_filename_trailing_dash() {
        let (name, instrument) = parse_filename("Some Song - ");
        assert_eq!(name, "Some Song");
        assert_eq!(instrument, None);
    }

    #[test]
    fn test_scan_directory_finds_supported_files() {
        let dir = tempfile::tempdir().unwrap();

        // Create supported files
        std::fs::write(dir.path().join("Canon - Violino.pdf"), b"fake pdf").unwrap();
        std::fs::write(dir.path().join("Moonlight.musx"), b"fake musx").unwrap();
        std::fs::write(dir.path().join("Ode - Piano.mus"), b"fake mus").unwrap();

        // Create unsupported files
        std::fs::write(dir.path().join("readme.txt"), b"text").unwrap();
        std::fs::write(dir.path().join("photo.jpg"), b"img").unwrap();

        let files = scan_directory(dir.path());
        assert_eq!(files.len(), 3);

        let names: Vec<&str> = files.iter().map(|f| f.name.as_str()).collect();
        assert!(names.contains(&"Canon"));
        assert!(names.contains(&"Moonlight"));
        assert!(names.contains(&"Ode"));
    }

    #[test]
    fn test_scan_directory_recursive() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("subdir");
        std::fs::create_dir(&sub).unwrap();

        std::fs::write(dir.path().join("top.pdf"), b"pdf").unwrap();
        std::fs::write(sub.join("nested.pdf"), b"pdf").unwrap();

        let files = scan_directory(dir.path());
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn test_scan_directory_empty() {
        let dir = tempfile::tempdir().unwrap();
        let files = scan_directory(dir.path());
        assert!(files.is_empty());
    }

    #[test]
    fn test_scan_directory_extracts_instrument() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("Canon in D - Violino 1.pdf"), b"data").unwrap();

        let files = scan_directory(dir.path());
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "Canon in D");
        assert_eq!(files[0].instrument, Some("Violino 1".to_string()));
        assert_eq!(files[0].extension, "pdf");
    }
}
