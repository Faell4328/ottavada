use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use crate::domain::errors::AppError;
use crate::domain::models::*;
use crate::infrastructure::database::Database;

/// Diretório base para armazenar versões dos arquivos
fn versions_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("versions")
}

/// Cria um rascunho a partir de uma alteração detectada no arquivo.
pub fn create_draft(
    db: &Database,
    app_data_dir: &Path,
    score_file_id: &str,
    source_path: &Path,
    hash_enabled: bool,
) -> Result<FileVersion, AppError> {
    let versions_base = versions_dir(app_data_dir);
    let draft_dir = versions_base.join(score_file_id).join("drafts");
    fs::create_dir_all(&draft_dir)?;

    let now = Local::now().naive_local();
    let draft_id = uuid::Uuid::new_v4().to_string();
    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let dest_filename = format!("{}.{}", draft_id, ext);
    let dest_path = draft_dir.join(&dest_filename);

    fs::copy(source_path, &dest_path)?;

    let metadata = fs::metadata(&dest_path)?;
    let hash = if hash_enabled {
        Some(compute_hash(&dest_path)?)
    } else {
        None
    };

    let version = FileVersion {
        id: draft_id,
        score_file_id: score_file_id.to_string(),
        version_number: 0,
        label: Some("Rascunho".to_string()),
        status: VersionStatus::Draft,
        file_path: dest_path.to_string_lossy().to_string(),
        file_size: metadata.len(),
        hash,
        is_compressed: false,
        created_at: now,
    };

    db.insert_version(&version)?;

    Ok(version)
}

/// Promove um rascunho para versão oficial.
pub fn promote_draft(db: &Database, version_id: &str) -> Result<(), AppError> {
    db.promote_draft_to_version(version_id)
}

/// Armazena a versão atual de um arquivo quando ele é indexado pela primeira vez.
pub fn store_initial_version(
    db: &Database,
    app_data_dir: &Path,
    score_file: &ScoreFile,
    hash_enabled: bool,
) -> Result<FileVersion, AppError> {
    let versions_base = versions_dir(app_data_dir);
    let file_dir = versions_base.join(&score_file.id);
    fs::create_dir_all(&file_dir)?;

    let version_id = uuid::Uuid::new_v4().to_string();
    let source = Path::new(&score_file.original_path);
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let dest_filename = format!("v1_{}.{}", version_id, ext);
    let dest_path = file_dir.join(&dest_filename);

    fs::copy(source, &dest_path)?;

    let metadata = fs::metadata(&dest_path)?;
    let hash = if hash_enabled {
        Some(compute_hash(&dest_path)?)
    } else {
        None
    };

    let version = FileVersion {
        id: version_id,
        score_file_id: score_file.id.clone(),
        version_number: 1,
        label: Some("Versão Inicial".to_string()),
        status: VersionStatus::Current,
        file_path: dest_path.to_string_lossy().to_string(),
        file_size: metadata.len(),
        hash,
        is_compressed: false,
        created_at: chrono::Local::now().naive_local(),
    };

    db.insert_version(&version)?;

    Ok(version)
}

/// Calcula hash BLAKE3 de um arquivo
fn compute_hash(path: &Path) -> Result<String, AppError> {
    let data = fs::read(path)?;
    let hash = blake3::hash(&data);
    Ok(hash.to_hex().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::Database;
    use chrono::Local;
    use std::io::Write;

    fn make_db() -> Database {
        Database::new_in_memory().expect("in-memory db")
    }

    fn setup_score_and_file(db: &Database) -> ScoreFile {
        let now = Local::now().naive_local();
        let score = Score {
            id: "s1".to_string(),
            title: "Test Score".to_string(),
            composer: None,
            arranger: None,
            category_id: None,
            tags: vec![],
            favorited: false,
            created_at: now,
            updated_at: now,
        };
        db.insert_score(&score).unwrap();

        let score_file = ScoreFile {
            id: "f1".to_string(),
            score_id: "s1".to_string(),
            instrument: Some("Violino".to_string()),
            original_path: "/tmp/test.pdf".to_string(),
            file_extension: "pdf".to_string(),
            file_size: 100,
            hash: None,
            host_computer_id: "test-computer".to_string(),
            created_at: now,
            updated_at: now,
        };
        db.insert_score_file(&score_file).unwrap();
        score_file
    }

    #[test]
    fn test_create_draft() {
        let db = make_db();
        let score_file = setup_score_and_file(&db);

        let app_data = tempfile::tempdir().unwrap();

        // Create a source file to be copied
        let mut source = tempfile::NamedTempFile::new().unwrap();
        write!(source, "draft content").unwrap();

        let result = create_draft(
            &db,
            app_data.path(),
            &score_file.id,
            source.path(),
            false,
        );
        assert!(result.is_ok());

        let draft = result.unwrap();
        assert_eq!(draft.score_file_id, "f1");
        assert_eq!(draft.status, VersionStatus::Draft);
        assert_eq!(draft.version_number, 0);
        assert!(draft.hash.is_none());

        // Check file was actually copied
        assert!(Path::new(&draft.file_path).exists());

        // Check DB has the version
        let versions = db.get_versions_for_file("f1").unwrap();
        assert_eq!(versions.len(), 1);
    }

    #[test]
    fn test_create_draft_with_hash() {
        let db = make_db();
        let score_file = setup_score_and_file(&db);
        let app_data = tempfile::tempdir().unwrap();

        let mut source = tempfile::NamedTempFile::new().unwrap();
        write!(source, "hashed draft content").unwrap();

        let draft = create_draft(
            &db,
            app_data.path(),
            &score_file.id,
            source.path(),
            true,
        ).unwrap();

        assert!(draft.hash.is_some());
        assert_eq!(draft.hash.as_ref().unwrap().len(), 64);
    }

    #[test]
    fn test_store_initial_version() {
        let db = make_db();
        let app_data = tempfile::tempdir().unwrap();

        // Create the actual source file
        let source_dir = tempfile::tempdir().unwrap();
        let source_path = source_dir.path().join("test.pdf");
        std::fs::write(&source_path, b"pdf content").unwrap();

        let now = Local::now().naive_local();
        let score = Score {
            id: "s1".to_string(),
            title: "Test".to_string(),
            composer: None,
            arranger: None,
            category_id: None,
            tags: vec![],
            favorited: false,
            created_at: now,
            updated_at: now,
        };
        db.insert_score(&score).unwrap();

        let score_file = ScoreFile {
            id: "f1".to_string(),
            score_id: "s1".to_string(),
            instrument: None,
            original_path: source_path.to_string_lossy().to_string(),
            file_extension: "pdf".to_string(),
            file_size: 11,
            hash: None,
            host_computer_id: "test-computer".to_string(),
            created_at: now,
            updated_at: now,
        };
        db.insert_score_file(&score_file).unwrap();

        let version = store_initial_version(&db, app_data.path(), &score_file, false).unwrap();
        assert_eq!(version.version_number, 1);
        assert_eq!(version.status, VersionStatus::Current);
        assert!(Path::new(&version.file_path).exists());
        assert!(version.hash.is_none());
    }

    #[test]
    fn test_promote_draft_flow() {
        let db = make_db();
        let score_file = setup_score_and_file(&db);
        let app_data = tempfile::tempdir().unwrap();

        // Create initial version
        let source = tempfile::tempdir().unwrap();
        let src_path = source.path().join("test.pdf");
        std::fs::write(&src_path, b"initial").unwrap();

        let sf_with_path = ScoreFile {
            original_path: src_path.to_string_lossy().to_string(),
            ..score_file.clone()
        };
        store_initial_version(&db, app_data.path(), &sf_with_path, false).unwrap();

        // Create a draft
        let mut draft_src = tempfile::NamedTempFile::new().unwrap();
        write!(draft_src, "draft v2").unwrap();
        let draft = create_draft(&db, app_data.path(), "f1", draft_src.path(), false).unwrap();

        // Promote the draft
        promote_draft(&db, &draft.id).unwrap();

        let versions = db.get_versions_for_file("f1").unwrap();
        assert_eq!(versions.len(), 2);

        let current = versions.iter().find(|v| v.status == VersionStatus::Current).unwrap();
        assert_eq!(current.id, draft.id);
        assert_eq!(current.version_number, 2);
    }
}
