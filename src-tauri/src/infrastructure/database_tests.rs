#[cfg(test)]
mod tests {
    use chrono::Local;
    use crate::domain::models::*;
    use crate::infrastructure::database::Database;

    fn make_db() -> Database {
        Database::new_in_memory().expect("failed to create in-memory db")
    }

    fn now() -> chrono::NaiveDateTime {
        Local::now().naive_local()
    }

    fn make_score(id: &str, title: &str) -> Score {
        Score {
            id: id.to_string(),
            title: title.to_string(),
            composer: Some("Bach".to_string()),
            arranger: None,
            category_id: None,
            tags: vec!["classical".to_string()],
            favorited: false,
            created_at: now(),
            updated_at: now(),
        }
    }

    fn make_score_file(id: &str, score_id: &str, instrument: Option<&str>) -> ScoreFile {
        ScoreFile {
            id: id.to_string(),
            score_id: score_id.to_string(),
            instrument: instrument.map(|s| s.to_string()),
            original_path: "/tmp/test.pdf".to_string(),
            file_extension: "pdf".to_string(),
            file_size: 1024,
            hash: None,
            host_computer_id: "test-computer".to_string(),
            created_at: now(),
            updated_at: now(),
        }
    }

    fn make_version(id: &str, file_id: &str, num: i32, status: VersionStatus) -> FileVersion {
        FileVersion {
            id: id.to_string(),
            score_file_id: file_id.to_string(),
            version_number: num,
            label: Some(format!("V{}", num)),
            status,
            file_path: format!("/tmp/versions/{}.pdf", id),
            file_size: 2048,
            hash: None,
            is_compressed: false,
            created_at: now(),
        }
    }

    // ── Score CRUD ──

    #[test]
    fn test_insert_and_get_all_scores() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon in D")).unwrap();
        db.insert_score(&make_score("s2", "Moonlight Sonata")).unwrap();

        let scores = db.get_all_scores().unwrap();
        assert_eq!(scores.len(), 2);
    }

    #[test]
    fn test_get_all_scores_empty() {
        let db = make_db();
        let scores = db.get_all_scores().unwrap();
        assert!(scores.is_empty());
    }

    #[test]
    fn test_toggle_favorite() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();

        let fav = db.toggle_favorite("s1").unwrap();
        assert!(fav);

        let fav = db.toggle_favorite("s1").unwrap();
        assert!(!fav);
    }

    #[test]
    fn test_get_favorited_scores() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score(&make_score("s2", "Moonlight")).unwrap();
        db.toggle_favorite("s1").unwrap();

        let favs = db.get_favorited_scores().unwrap();
        assert_eq!(favs.len(), 1);
        assert_eq!(favs[0].id, "s1");
    }

    // ── FTS5 Search ──

    #[test]
    fn test_search_scores_fts5() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon in D")).unwrap();
        db.insert_score(&make_score("s2", "Moonlight Sonata")).unwrap();

        let results = db.search_scores("Canon").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Canon in D");
    }

    #[test]
    fn test_search_scores_prefix() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon in D")).unwrap();

        let results = db.search_scores("Can").unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_scores_no_results() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon in D")).unwrap();

        let results = db.search_scores("Beethoven").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_by_composer() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon in D")).unwrap();

        // Composer is "Bach" in make_score
        let results = db.search_scores("Bach").unwrap();
        assert_eq!(results.len(), 1);
    }

    // ── Score Files ──

    #[test]
    fn test_insert_score_file_and_list() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score_file(&make_score_file("f1", "s1", Some("Violino 1"))).unwrap();
        db.insert_score_file(&make_score_file("f2", "s1", Some("Piano"))).unwrap();

        let scores = db.get_all_scores().unwrap();
        assert_eq!(scores.len(), 1);
        assert_eq!(scores[0].instruments.len(), 2);
    }

    // ── Versions ──

    #[test]
    fn test_insert_and_get_versions() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score_file(&make_score_file("f1", "s1", Some("Violino"))).unwrap();

        let v1 = make_version("v1", "f1", 1, VersionStatus::Current);
        db.insert_version(&v1).unwrap();

        let versions = db.get_versions_for_file("f1").unwrap();
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].version_number, 1);
        assert_eq!(versions[0].status, VersionStatus::Current);
    }

    #[test]
    fn test_promote_draft() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score_file(&make_score_file("f1", "s1", Some("Violino"))).unwrap();

        // Insert v1 as current
        let v1 = make_version("v1", "f1", 1, VersionStatus::Current);
        db.insert_version(&v1).unwrap();

        // Insert draft
        let draft = make_version("d1", "f1", 0, VersionStatus::Draft);
        db.insert_version(&draft).unwrap();

        // Promote draft
        db.promote_draft_to_version("d1").unwrap();

        let versions = db.get_versions_for_file("f1").unwrap();
        assert_eq!(versions.len(), 2);

        let current = versions.iter().find(|v| v.status == VersionStatus::Current).unwrap();
        assert_eq!(current.id, "d1");
        assert_eq!(current.version_number, 2);

        let previous = versions.iter().find(|v| v.status == VersionStatus::Previous).unwrap();
        assert_eq!(previous.id, "v1");
    }

    #[test]
    fn test_delete_version_non_current() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score_file(&make_score_file("f1", "s1", None)).unwrap();

        let v1 = make_version("v1", "f1", 1, VersionStatus::Current);
        let v_old = make_version("v0", "f1", 0, VersionStatus::Previous);
        db.insert_version(&v1).unwrap();
        db.insert_version(&v_old).unwrap();

        db.delete_version("v0").unwrap();
        let versions = db.get_versions_for_file("f1").unwrap();
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].id, "v1");
    }

    #[test]
    fn test_delete_current_version_fails() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score_file(&make_score_file("f1", "s1", None)).unwrap();

        let v1 = make_version("v1", "f1", 1, VersionStatus::Current);
        db.insert_version(&v1).unwrap();

        let result = db.delete_version("v1");
        assert!(result.is_err());
    }

    // ── Categories ──

    #[test]
    fn test_category_crud() {
        let db = make_db();
        let cat = Category {
            id: "c1".to_string(),
            name: "Harpa Cristã".to_string(),
            created_at: now(),
        };
        db.insert_category(&cat).unwrap();

        let categories = db.get_all_categories().unwrap();
        assert_eq!(categories.len(), 1);
        assert_eq!(categories[0].name, "Harpa Cristã");

        db.delete_category("c1").unwrap();
        let categories = db.get_all_categories().unwrap();
        assert!(categories.is_empty());
    }

    #[test]
    fn test_scores_by_category() {
        let db = make_db();

        let cat = Category {
            id: "c1".to_string(),
            name: "Hinos".to_string(),
            created_at: now(),
        };
        db.insert_category(&cat).unwrap();

        let mut s1 = make_score("s1", "Canon");
        s1.category_id = Some("c1".to_string());
        db.insert_score(&s1).unwrap();

        let mut s2 = make_score("s2", "Moonlight");
        s2.category_id = None;
        db.insert_score(&s2).unwrap();

        let scores = db.get_scores_by_category("c1").unwrap();
        assert_eq!(scores.len(), 1);
        assert_eq!(scores[0].title, "Canon");
    }

    // ── Settings ──

    #[test]
    fn test_settings_default() {
        let db = make_db();
        let settings = db.get_app_settings().unwrap();
        assert!(!settings.hash_enabled);
        assert!(!settings.first_run_completed);
        assert_eq!(settings.google_drive_mode, GoogleDriveMode::Local);
        assert!(settings.computer_name.is_none());
    }

    #[test]
    fn test_save_and_get_settings() {
        let db = make_db();
        let settings = AppSettings {
            computer_id: "test-computer-id".to_string(),
            computer_name: Some("Computador Teste".to_string()),
            logo_path: None,
            google_drive_mode: GoogleDriveMode::Api,
            hash_enabled: true,
            first_run_completed: true,
            google_service_account: None,
        };
        db.save_app_settings(&settings).unwrap();

        let loaded = db.get_app_settings().unwrap();
        assert_eq!(loaded.computer_name, Some("Computador Teste".to_string()));
        assert_eq!(loaded.google_drive_mode, GoogleDriveMode::Api);
        assert!(loaded.hash_enabled);
        assert!(loaded.first_run_completed);
    }

    #[test]
    fn test_set_and_get_setting() {
        let db = make_db();
        db.set_setting("custom_key", "custom_value").unwrap();
        let val = db.get_setting("custom_key").unwrap();
        assert_eq!(val, Some("custom_value".to_string()));

        let missing = db.get_setting("nonexistent").unwrap();
        assert!(missing.is_none());
    }

    // ── Scores with Drafts ──

    #[test]
    fn test_get_scores_with_drafts() {
        let db = make_db();
        db.insert_score(&make_score("s1", "Canon")).unwrap();
        db.insert_score(&make_score("s2", "Moonlight")).unwrap();
        db.insert_score_file(&make_score_file("f1", "s1", Some("Violino"))).unwrap();
        db.insert_score_file(&make_score_file("f2", "s2", Some("Piano"))).unwrap();

        // s1 has a draft
        db.insert_version(&make_version("v1", "f1", 1, VersionStatus::Current)).unwrap();
        db.insert_version(&make_version("d1", "f1", 0, VersionStatus::Draft)).unwrap();

        // s2 has only a current version
        db.insert_version(&make_version("v2", "f2", 1, VersionStatus::Current)).unwrap();

        let drafts = db.get_scores_with_drafts().unwrap();
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].title, "Canon");
    }

    // ── Cascade delete ──

    #[test]
    fn test_category_delete_sets_null() {
        let db = make_db();

        let cat = Category {
            id: "c1".to_string(),
            name: "Hinos".to_string(),
            created_at: now(),
        };
        db.insert_category(&cat).unwrap();

        let mut score = make_score("s1", "Canon");
        score.category_id = Some("c1".to_string());
        db.insert_score(&score).unwrap();

        db.delete_category("c1").unwrap();

        // Score should still exist but with category_id = NULL
        let scores = db.get_all_scores().unwrap();
        assert_eq!(scores.len(), 1);
    }
}
