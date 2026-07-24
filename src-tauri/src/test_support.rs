use std::path::PathBuf;

use tempfile::{Builder, TempDir};

pub fn create_test_app_data_dir(test_name: &str) -> TempDir {
    let root = std::env::temp_dir().join("ottavada-tests");
    std::fs::create_dir_all(&root).expect("failed to create test root");

    Builder::new()
        .prefix(test_name)
        .tempdir_in(root)
        .expect("failed to create dedicated test app data dir")
}

#[allow(dead_code)]
pub fn test_app_data_path(test_name: &str) -> PathBuf {
    create_test_app_data_dir(test_name).path().to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::create_test_app_data_dir;

    #[test]
    fn creates_directories_inside_dedicated_test_root() {
        let dir = create_test_app_data_dir("support");
        let path = dir.path().to_string_lossy();

        assert!(path.contains("ottavada-tests"));
    }
}
