use chrono::NaiveDateTime;
use std::path::Path;
use walkdir::WalkDir;

use crate::domain::models::IndexedFile;
use crate::services::name_formatter::{normalize_optional_score_name, normalize_song_name};

/// Extensões de arquivo suportadas
const SUPPORTED_EXTENSIONS: &[&str] = &["pdf", "mus", "musx"];

/// Indexa um diretório, retornando todos os arquivos de partitura encontrados.
pub fn scan_directory(dir_path: &Path) -> Vec<IndexedFile> {
    let mut files = Vec::new();

    for entry in WalkDir::new(dir_path)
        .max_depth(1)
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

        let name = song_name_from_parent_directory(path)
            .unwrap_or_else(|| normalize_song_name(&file_stem));
        let instrument = parse_instrument_from_file_stem(&file_stem, &name);

        files.push(IndexedFile {
            path: path.to_string_lossy().to_string(),
            name,
            instrument,
            extension,
        });
    }

    files
}

fn song_name_from_parent_directory(path: &Path) -> Option<String> {
    let parent_name = path
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())?;

    let normalized = normalize_song_name(parent_name);
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_instrument_probe(value: &str) -> String {
    value
        .chars()
        .flat_map(char::to_lowercase)
        .map(|ch| if ch.is_ascii_alphanumeric() || ch.is_ascii_whitespace() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn looks_like_known_instrument(value: &str) -> bool {
    let normalized = normalize_instrument_probe(value);
    if normalized.is_empty() {
        return false;
    }

    const PREFIXES: &[&str] = &[
        "grade",
        "score",
        "full score",
        "conductor score",
        "partitura completa",
        "partitura geral",
        "regencia",
        "flute",
        "flauta",
        "oboe",
        "bassoon",
        "fagote",
        "clarinet",
        "clarinete",
        "bass clarinet",
        "alto sax",
        "sax alto",
        "saxofone alto",
        "tenor sax",
        "sax tenor",
        "saxofone tenor",
        "baritone sax",
        "sax baritone",
        "saxofone baritono",
        "trumpet",
        "trompete",
        "horn",
        "trompa",
        "trombone",
        "baritone",
        "tuba",
        "violin",
        "violino",
        "viola",
        "cello",
        "violoncello",
        "violoncelo",
        "contrabass",
        "double bass",
        "contrabaixo",
    ];

    PREFIXES.iter().any(|prefix| normalized.starts_with(prefix))
}

fn looks_like_non_instrument_descriptor(value: &str) -> bool {
    let normalized = normalize_instrument_probe(value);
    if normalized.is_empty() {
        return false;
    }

    const FIRST_WORDS: &[&str] = &[
        "part",
        "parte",
        "section",
        "arr",
        "arranjo",
        "arrangement",
        "score",
        "grade",
        "partitura",
        "regencia",
        "versao",
        "version",
    ];

    let first_word = normalized.split_whitespace().next().unwrap_or("");
    if FIRST_WORDS.contains(&first_word) {
        return true;
    }

    const PHRASES: &[&str] = &["full score", "conductor score", "partitura completa", "partitura geral"];
    PHRASES.iter().any(|phrase| normalized.starts_with(phrase))
}

/// Extrai o nome do instrumento a partir do nome do arquivo.
/// Suporta tanto "nome da música - instrumento.ext" quanto "instrumento.ext".
fn parse_instrument_from_file_stem(file_stem: &str, song_name: &str) -> Option<String> {
    if let Some(idx) = file_stem.rfind(" - ") {
        let normalized = normalize_optional_score_name(Some(&file_stem[idx + 3..]));
        return normalized.filter(|candidate| {
            normalize_song_name(candidate) != song_name && !looks_like_non_instrument_descriptor(candidate)
        });
    }

    let normalized_instrument = normalize_optional_score_name(Some(file_stem));
    normalized_instrument.filter(|instrument| {
        normalize_song_name(instrument) != song_name && looks_like_known_instrument(instrument)
    })
}

/// Separa um caminho completo de arquivo em (diretório, nome_do_arquivo)
pub fn split_file_path(file_path: &str) -> (String, String) {
    let last_sep = file_path.rfind(|c: char| c == '/' || c == '\\');
    match last_sep {
        Some(idx) => {
            let dir = &file_path[..idx];
            let name = &file_path[idx + 1..];
            if dir.is_empty() {
                (".".to_string(), name.to_string())
            } else {
                (dir.to_string(), name.to_string())
            }
        }
        None => (".".to_string(), file_path.to_string()),
    }
}

/// Compara caminhos de arquivo de forma resiliente entre plataformas.
/// - Normaliza separadores para '/'
/// - Em paths estilo Windows (com letra de drive), comparação é case-insensitive
pub fn paths_match(path_a: &str, path_b: &str) -> bool {
    let normalized_a = path_a.replace('\\', "/");
    let normalized_b = path_b.replace('\\', "/");

    let is_windows_path = |value: &str| {
        value.len() >= 3
            && value.as_bytes()[1] == b':'
            && value.as_bytes()[2] == b'/'
            && value.as_bytes()[0].is_ascii_alphabetic()
    };

    if is_windows_path(&normalized_a) || is_windows_path(&normalized_b) {
        normalized_a.eq_ignore_ascii_case(&normalized_b)
    } else {
        normalized_a == normalized_b
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
    fn test_parse_instrument_with_suffix() {
        let instrument = parse_instrument_from_file_stem("Canon in D - Violino 1", "CANON IN D");
        assert_eq!(instrument, Some("Violino 1".to_string()));
    }

    #[test]
    fn test_parse_instrument_with_unknown_suffix() {
        let instrument = parse_instrument_from_file_stem(
            "298H.C. AVANTE SERVO DE JEOVA - Bass Guitar",
            "298H.C. AVANTE SERVO DE JEOVA",
        );
        assert_eq!(instrument, Some("Bass Guitar".to_string()));
    }

    #[test]
    fn test_parse_instrument_without_suffix() {
        let instrument =
            parse_instrument_from_file_stem("Moonlight Sonata", "SONATA AO LUAR");
        assert_eq!(instrument, None);
    }

    #[test]
    fn test_parse_instrument_without_suffix_when_known_instrument() {
        let instrument = parse_instrument_from_file_stem("flauta 1 & 2", "EIS O NOSSO DEUS");
        assert_eq!(instrument, Some("flauta 1 & 2".to_string()));
    }

    #[test]
    fn test_parse_instrument_suffix_not_detected_as_instrument() {
        let instrument = parse_instrument_from_file_stem(
            "Eis o nosso deus - Parte Principal",
            "EIS O NOSSO DEUS",
        );
        assert_eq!(instrument, None);
    }

    #[test]
    fn test_parse_instrument_with_multiple_dashes() {
        let instrument =
            parse_instrument_from_file_stem("Ode to Joy - Arr. Sousa - Piano", "ODE TO JOY");
        assert_eq!(instrument, Some("Piano".to_string()));
    }

    #[test]
    fn test_parse_instrument_trailing_dash() {
        let instrument = parse_instrument_from_file_stem("Some Song - ", "SOME SONG");
        assert_eq!(instrument, None);
    }

    #[test]
    fn test_parse_instrument_ignores_file_name_equal_to_song_name() {
        let instrument = parse_instrument_from_file_stem("Eis o nosso deus", "EIS O NOSSO DEUS");
        assert_eq!(instrument, None);
    }

    #[test]
    fn test_song_name_from_parent_directory() {
        let path = Path::new("/tmp/Eis o nosso deus/Eis o nosso deus - Flute.musx");
        let song_name = song_name_from_parent_directory(path);
        assert_eq!(song_name, Some("EIS O NOSSO DEUS".to_string()));
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

        let expected_song_name = normalize_song_name(
            dir.path()
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(""),
        );
        assert!(files.iter().all(|f| f.name == expected_song_name));
    }

    #[test]
    fn test_scan_directory_ignores_subdirectories() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("subdir");
        std::fs::create_dir(&sub).unwrap();

        std::fs::write(dir.path().join("top.pdf"), b"pdf").unwrap();
        std::fs::write(sub.join("nested.pdf"), b"pdf").unwrap();

        let files = scan_directory(dir.path());
        assert_eq!(files.len(), 1);
        assert!(files[0].path.ends_with("top.pdf"));
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
        let song_dir = dir.path().join("Eis o nosso deus");
        std::fs::create_dir(&song_dir).unwrap();
        std::fs::write(song_dir.join("Eis o nosso deus - Flute.pdf"), b"data").unwrap();

        let files = scan_directory(&song_dir);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "EIS O NOSSO DEUS");
        assert_eq!(files[0].instrument, Some("Flute".to_string()));
        assert_eq!(files[0].extension, "pdf");
    }

    // ── split_file_path tests ──

    #[test]
    fn test_split_file_path_unix() {
        let (dir, name) = split_file_path("/home/user/music/Canon - Violino.musx");
        assert_eq!(dir, "/home/user/music");
        assert_eq!(name, "Canon - Violino.musx");
    }

    #[test]
    fn test_split_file_path_windows() {
        let (dir, name) = split_file_path("C:\\Users\\user\\music\\Canon.musx");
        assert_eq!(dir, "C:\\Users\\user\\music");
        assert_eq!(name, "Canon.musx");
    }

    #[test]
    fn test_split_file_path_no_directory() {
        let (dir, name) = split_file_path("Canon.musx");
        assert_eq!(dir, ".");
        assert_eq!(name, "Canon.musx");
    }

    #[test]
    fn test_split_file_path_root() {
        let (dir, name) = split_file_path("/Canon.musx");
        assert_eq!(dir, ".");
        assert_eq!(name, "Canon.musx");
    }

    #[test]
    fn test_paths_match_unix_equal() {
        assert!(paths_match(
            "/home/user/music/Canon.musx",
            "/home/user/music/Canon.musx"
        ));
    }

    #[test]
    fn test_paths_match_windows_separator_difference() {
        assert!(paths_match(
            "C:\\Users\\user\\music\\Canon.musx",
            "C:/Users/user/music/Canon.musx"
        ));
    }

    #[test]
    fn test_paths_match_windows_drive_case_difference() {
        assert!(paths_match(
            "C:\\Users\\user\\music\\Canon.musx",
            "c:/Users/user/music/Canon.musx"
        ));
    }

    #[test]
    fn test_paths_match_different_paths() {
        assert!(!paths_match(
            "C:\\Users\\user\\music\\Canon.musx",
            "C:/Users/user/music/Other.musx"
        ));
    }
}
