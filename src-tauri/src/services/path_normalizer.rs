/// Gets the user profile directory (equivalent to `%USERPROFILE%` on Windows).
pub fn get_user_profile() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE").ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").ok()
    }
}

/// Converts an absolute path to the storage format using `%USERPROFILE%`.
///
/// Only applies the conversion if the path is inside the user profile directory.
/// Otherwise, returns the original path.
pub fn to_storage_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return trimmed.to_string();
    }

    let Some(home) = get_user_profile() else {
        return trimmed.to_string();
    };

    if home.trim().is_empty() {
        return trimmed.to_string();
    }

    let (home_for_check, path_for_check) = normalize_for_comparison(&home, trimmed);

    if !path_for_check.starts_with(&home_for_check) {
        return trimmed.to_string();
    }

    let remainder = &trimmed[home.len()..];
    let remainder = remainder.trim_start_matches(['\\', '/']);

    if remainder.is_empty() {
        "%USERPROFILE%".to_string()
    } else {
        let normalized = remainder.replace('\\', "/");
        format!("%USERPROFILE%/{}", normalized)
    }
}

/// Expands `%USERPROFILE%` back to the real absolute path (for file system operations).
///
/// If the path does not start with `%USERPROFILE%`, returns the original.
pub fn from_storage_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return trimmed.to_string();
    }

    let upper = trimmed.to_uppercase();
    if !upper.starts_with("%USERPROFILE%") {
        return trimmed.to_string();
    }

    let Some(home) = get_user_profile() else {
        return trimmed.to_string();
    };

    let remainder = &trimmed["%USERPROFILE%".len()..];
    let remainder = remainder.trim_start_matches(['\\', '/']);

    if remainder.is_empty() {
        home
    } else {
        let mut path = std::path::PathBuf::from(home.trim_end_matches(['\\', '/']));
        for component in remainder.split(['\\', '/']) {
            if !component.is_empty() {
                path.push(component);
            }
        }
        path.to_string_lossy().to_string()
    }
}

fn normalize_for_comparison(home: &str, path: &str) -> (String, String) {
    let home_normalized = home.replace('\\', "/").to_lowercase();
    let path_normalized = path.replace('\\', "/").to_lowercase();

    let home_normalized = home_normalized.trim_end_matches('/').to_string();
    let path_normalized = path_normalized.trim_end_matches('/').to_string();

    (home_normalized, path_normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn with_userprofile(value: &str, test: impl FnOnce()) {
        let key = if cfg!(target_os = "windows") {
            "USERPROFILE"
        } else {
            "HOME"
        };
        let old = env::var(key).ok();
        unsafe { env::set_var(key, value) };
        test();
        match old {
            Some(v) => unsafe { env::set_var(key, v) },
            None => unsafe { env::remove_var(key) },
        }
    }

    #[test]
    fn storage_path_empty_returns_empty() {
        assert_eq!(to_storage_path(""), "");
    }

    #[test]
    fn storage_path_outside_profile_returns_unchanged() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(to_storage_path(r"C:\music\song"), r"C:\music\song");
        });
    }

    #[test]
    fn storage_path_inside_profile_converts() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(
                to_storage_path(r"C:\Users\john\Documents\Song"),
                r"%USERPROFILE%/Documents/Song"
            );
        });
    }

    #[test]
    fn storage_path_exact_profile() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(to_storage_path(r"C:\Users\john"), r"%USERPROFILE%");
        });
    }

    #[test]
    fn storage_path_case_insensitive() {
        with_userprofile(r"C:\Users\John", || {
            assert_eq!(
                to_storage_path(r"c:\users\john\Documents\Song"),
                r"%USERPROFILE%/Documents/Song"
            );
        });
    }

    #[test]
    fn from_storage_path_expands_correctly() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(
                from_storage_path(r"%USERPROFILE%/Documents/Song"),
                r"C:\Users\john\Documents\Song"
            );
        });
    }

    #[test]
    fn from_storage_path_legacy_backslash_format() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(
                from_storage_path(r"%USERPROFILE%\Documents\Song"),
                r"C:\Users\john\Documents\Song"
            );
        });
    }

    #[test]
    fn from_storage_path_exact() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(from_storage_path(r"%USERPROFILE%"), r"C:\Users\john");
        });
    }

    #[test]
    fn from_storage_path_no_placeholder_returns_unchanged() {
        with_userprofile(r"C:\Users\john", || {
            assert_eq!(
                from_storage_path(r"C:\music\song"),
                r"C:\music\song"
            );
        });
    }

    #[test]
    fn from_storage_path_unix_format_expands() {
        with_userprofile("/home/user", || {
            assert_eq!(
                from_storage_path(r"%USERPROFILE%/Documents/Song"),
                if cfg!(target_os = "windows") {
                    r"/home/user\Documents\Song"
                } else {
                    "/home/user/Documents/Song"
                }
            );
        });
    }

    #[test]
    fn from_storage_path_unix_legacy_backslash_expands() {
        with_userprofile("/home/user", || {
            assert_eq!(
                from_storage_path(r"%USERPROFILE%\Documents\Song"),
                if cfg!(target_os = "windows") {
                    r"/home/user\Documents\Song"
                } else {
                    "/home/user/Documents/Song"
                }
            );
        });
    }

    #[test]
    fn storage_path_unix_home_converts() {
        with_userprofile("/home/user", || {
            assert_eq!(
                to_storage_path("/home/user/Documents/Song"),
                r"%USERPROFILE%/Documents/Song"
            );
        });
    }

    #[test]
    fn roundtrip_preserves_semantics() {
        with_userprofile(r"C:\Users\john", || {
            let original = r"C:\Users\john\Documents\Song";
            let stored = to_storage_path(original);
            let restored = from_storage_path(&stored);
            assert_eq!(restored.to_lowercase(), original.to_lowercase());
        });
    }

    #[test]
    fn roundtrip_preserves_semantics_unix() {
        with_userprofile("/home/user", || {
            let original = "/home/user/Documents/Song";
            let stored = to_storage_path(original);
            let restored = from_storage_path(&stored);
            assert_eq!(restored.replace('\\', "/"), original);
        });
    }
}
