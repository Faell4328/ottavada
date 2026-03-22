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

    fn make_song(id: &str, name: &str) -> Song {
        Song {
            id: id.to_string(),
            name: name.to_string(),
            composer: Some("Bach".to_string()),
            arranger: None,
            is_favorite: false,
            status: ScoreStatus::Main,
            updated_at: now(),
            updated_by: "test-computer".to_string(),
        }
    }

    fn make_score(db: &Database, id: &str, song_id: &str, name: Option<&str>) -> Score {
        let dir_id = db.insert_or_get_directory("/tmp/music").unwrap();
        Score {
            id: id.to_string(),
            song_id: song_id.to_string(),
            name: name.map(|s| s.to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir_id,
            file_name: format!("{}.pdf", name.unwrap_or("test")),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        }
    }

    fn make_category(id: &str, name: &str) -> Category {
        Category {
            id: id.to_string(),
            name: name.to_string(),
            updated_at: now(),
            updated_by: "test-computer".to_string(),
        }
    }

    // ── Directory CRUD ──

    #[test]
    fn test_insert_or_get_directory_creates_new() {
        let db = make_db();
        let id = db.insert_or_get_directory("/home/user/music").unwrap();
        assert!(!id.is_empty());
    }

    #[test]
    fn test_insert_or_get_directory_returns_existing() {
        let db = make_db();
        let id1 = db.insert_or_get_directory("/home/user/music").unwrap();
        let id2 = db.insert_or_get_directory("/home/user/music").unwrap();
        assert_eq!(id1, id2);
    }

    #[test]
    fn test_insert_or_get_directory_different_paths() {
        let db = make_db();
        let id1 = db.insert_or_get_directory("/home/user/music").unwrap();
        let id2 = db.insert_or_get_directory("/home/user/other").unwrap();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_get_all_directories() {
        let db = make_db();
        db.insert_or_get_directory("/path/a").unwrap();
        db.insert_or_get_directory("/path/b").unwrap();

        let dirs = db.get_all_directories().unwrap();
        assert_eq!(dirs.len(), 2);
    }

    #[test]
    fn test_resolve_directory_for_path() {
        let db = make_db();
        let (dir_id, file_name) = db.resolve_directory_for_path("/home/user/music/Canon.musx").unwrap();
        assert!(!dir_id.is_empty());
        assert_eq!(file_name, "Canon.musx");

        // Mesmo diretório deve retornar mesmo ID
        let (dir_id2, file_name2) = db.resolve_directory_for_path("/home/user/music/Sonata.pdf").unwrap();
        assert_eq!(dir_id, dir_id2);
        assert_eq!(file_name2, "Sonata.pdf");
    }

    // ── Song CRUD ──

    #[test]
    fn test_insert_and_get_all_songs() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight Sonata"), &[]).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 2);
    }

    #[test]
    fn test_get_all_songs_empty() {
        let db = make_db();
        let songs = db.get_all_songs().unwrap();
        assert!(songs.is_empty());
    }

    #[test]
    fn test_get_song_by_id() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();

        let song = db.get_song_by_id("s1").unwrap();
        assert_eq!(song.name, "Canon in D");
        assert_eq!(song.composer, Some("Bach".to_string()));
    }

    #[test]
    fn test_get_song_by_id_not_found() {
        let db = make_db();
        let result = db.get_song_by_id("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_song_list_item_by_id() {
        let db = make_db();
        let cat = make_category("c1", "Hinos");
        db.insert_category(&cat).unwrap();
        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();

        let item = db.get_song_list_item_by_id("s1").unwrap();
        assert_eq!(item.name, "Canon");
        assert_eq!(item.scores.len(), 1);
        assert_eq!(item.category_ids.len(), 1);
    }

    #[test]
    fn test_get_song_list_item_by_id_not_found() {
        let db = make_db();
        let result = db.get_song_list_item_by_id("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_toggle_favorite() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let fav = db.toggle_favorite("s1").unwrap();
        assert!(fav);

        let fav = db.toggle_favorite("s1").unwrap();
        assert!(!fav);
    }

    #[test]
    fn test_get_favorited_songs() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight"), &[]).unwrap();
        db.toggle_favorite("s1").unwrap();

        let favs = db.get_favorited_songs().unwrap();
        assert_eq!(favs.len(), 1);
        assert_eq!(favs[0].id, "s1");
    }

    #[test]
    fn test_update_song() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let mut updated = make_song("s1", "Canon in D Major");
        updated.composer = Some("Pachelbel".to_string());
        db.update_song(&updated, &[]).unwrap();

        let song = db.get_song_by_id("s1").unwrap();
        assert_eq!(song.name, "Canon in D Major");
        assert_eq!(song.composer, Some("Pachelbel".to_string()));
    }

    #[test]
    fn test_update_song_categories() {
        let db = make_db();
        let cat1 = make_category("c1", "Hinos");
        let cat2 = make_category("c2", "Clássicas");
        db.insert_category(&cat1).unwrap();
        db.insert_category(&cat2).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()]).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 1);

        let song = make_song("s1", "Canon");
        db.update_song(&song, &["c1".to_string(), "c2".to_string()]).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 2);
    }

    // ── FTS5 Search ──

    #[test]
    fn test_search_songs_fts5() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight Sonata"), &[]).unwrap();

        let results = db.search_songs("Canon").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Canon in D");
    }

    #[test]
    fn test_search_songs_prefix() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();

        let results = db.search_songs("Can").unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_songs_no_results() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();

        let results = db.search_songs("Beethoven").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_by_composer() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();

        let results = db.search_songs("Bach").unwrap();
        assert_eq!(results.len(), 1);
    }

    // ── Scores ──

    #[test]
    fn test_insert_score_and_list() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino 1"))).unwrap();
        db.insert_score(&make_score(&db, "sc2", "s1", Some("Piano"))).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].scores.len(), 2);
    }

    #[test]
    fn test_score_status() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let mut score = make_score(&db, "sc1", "s1", Some("Violino"));
        score.status = ScoreStatus::Draft;
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Draft);
    }

    #[test]
    fn test_score_file_extension_derived() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = db.insert_or_get_directory("/tmp/music").unwrap();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].file_extension, "musx");
    }

    #[test]
    fn test_score_file_path_reconstructed() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = db.insert_or_get_directory("/home/user/music").unwrap();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs[0].scores[0].file_path.contains("Canon - Violino.musx"));
        assert!(songs[0].scores[0].file_path.contains("music"));
    }

    #[test]
    fn test_update_score() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();

        let new_dir_id = db.insert_or_get_directory("/new/path").unwrap();
        db.update_score("sc1", Some("Violino 1".to_string()), &new_dir_id, "score.musx", 2048, now(), now(), "test-computer").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].name, Some("Violino 1".to_string()));
        assert!(songs[0].scores[0].file_path.contains("score.musx"));
    }

    #[test]
    fn test_delete_score() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();

        db.delete_score("sc1").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores.len(), 0);
    }

    #[test]
    fn test_delete_score_not_found() {
        let db = make_db();
        let result = db.delete_score("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_score_file_path() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = db.insert_or_get_directory("/music/scores").unwrap();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };
        db.insert_score(&score).unwrap();

        let path = db.get_score_file_path("sc1").unwrap();
        assert!(path.contains("Canon - Violino.musx"));
        assert!(path.contains("music"));
    }

    #[test]
    fn test_get_score_file_path_not_found() {
        let db = make_db();
        let result = db.get_score_file_path("nonexistent");
        assert!(result.is_err());
    }

    // ── Score Status ──

    #[test]
    fn test_update_score_status() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Draft);
    }

    #[test]
    fn test_update_score_status_with_metadata() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();

        let new_modified_at = now();
        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", Some((4096, new_modified_at))).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Draft);
    }

    // ── Score Metadata for Scanning ──

    #[test]
    fn test_get_all_scores_with_metadata() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();
        db.insert_score(&make_score(&db, "sc2", "s1", Some("Piano"))).unwrap();

        let metadata = db.get_all_scores_with_metadata().unwrap();
        assert_eq!(metadata.len(), 2);

        // Cada entrada tem (id, file_path, file_size, file_modified_at)
        for (id, path, size, _) in &metadata {
            assert!(!id.is_empty());
            assert!(!path.is_empty());
            assert_eq!(*size, 1024);
        }
    }

    // ── Scores with different directories ──

    #[test]
    fn test_scores_in_different_directories() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir1 = db.insert_or_get_directory("/music/classical").unwrap();
        let dir2 = db.insert_or_get_directory("/music/hymns").unwrap();

        let score1 = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir1,
            file_name: "Canon - Violino.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        let score2 = Score {
            id: "sc2".to_string(),
            song_id: "s1".to_string(),
            name: Some("Piano".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir2,
            file_name: "Canon - Piano.pdf".to_string(),
            file_size: 2048,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        db.insert_score(&score1).unwrap();
        db.insert_score(&score2).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores.len(), 2);

        let paths: Vec<&str> = songs[0].scores.iter().map(|s| s.file_path.as_str()).collect();
        assert!(paths.iter().any(|p| p.contains("classical")));
        assert!(paths.iter().any(|p| p.contains("hymns")));
    }

    #[test]
    fn test_unique_constraint_directory_file_name() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = db.insert_or_get_directory("/music").unwrap();
        let score1 = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir_id.clone(),
            file_name: "Canon.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        let score2 = Score {
            id: "sc2".to_string(),
            song_id: "s1".to_string(),
            name: Some("Piano".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir_id,
            file_name: "Canon.pdf".to_string(), // Mesmo arquivo no mesmo diretório
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        db.insert_score(&score1).unwrap();
        let result = db.insert_score(&score2);
        assert!(result.is_err()); // UNIQUE constraint violated
    }

    #[test]
    fn test_same_filename_different_directories_ok() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir1 = db.insert_or_get_directory("/music/v1").unwrap();
        let dir2 = db.insert_or_get_directory("/music/v2").unwrap();

        let score1 = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir1,
            file_name: "Canon.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        let score2 = Score {
            id: "sc2".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino v2".to_string()),
            host_id: "test-computer".to_string(),
            directory_id: dir2,
            file_name: "Canon.pdf".to_string(), // Mesmo nome, diretório diferente - OK
            file_size: 2048,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        db.insert_score(&score1).unwrap();
        db.insert_score(&score2).unwrap(); // Deve funcionar

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores.len(), 2);
    }

    // ── Categories ──

    #[test]
    fn test_category_crud() {
        let db = make_db();
        let cat = make_category("c1", "Harpa Cristã");
        db.insert_category(&cat).unwrap();

        let categories = db.get_all_categories().unwrap();
        assert_eq!(categories.len(), 1);
        assert_eq!(categories[0].name, "Harpa Cristã");

        db.delete_category("c1").unwrap();
        let categories = db.get_all_categories().unwrap();
        assert!(categories.is_empty());
    }

    #[test]
    fn test_songs_by_category() {
        let db = make_db();

        let cat = make_category("c1", "Hinos");
        db.insert_category(&cat).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight"), &[]).unwrap();

        let songs = db.get_songs_by_category("c1").unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].name, "Canon");
    }

    #[test]
    fn test_song_multiple_categories() {
        let db = make_db();

        let cat1 = make_category("c1", "Hinos");
        let cat2 = make_category("c2", "Clássicas");
        db.insert_category(&cat1).unwrap();
        db.insert_category(&cat2).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string(), "c2".to_string()]).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 2);

        let by_c1 = db.get_songs_by_category("c1").unwrap();
        assert_eq!(by_c1.len(), 1);

        let by_c2 = db.get_songs_by_category("c2").unwrap();
        assert_eq!(by_c2.len(), 1);
    }

    #[test]
    fn test_category_delete_removes_relationship() {
        let db = make_db();

        let cat = make_category("c1", "Hinos");
        db.insert_category(&cat).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()]).unwrap();
        db.delete_category("c1").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 1);
        assert!(songs[0].category_ids.is_empty());
    }

    // ── Songs with Drafts ──

    #[test]
    fn test_get_songs_with_drafts() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight"), &[]).unwrap();

        let mut draft_score = make_score(&db, "sc1", "s1", Some("Violino"));
        draft_score.status = ScoreStatus::Draft;
        db.insert_score(&draft_score).unwrap();

        db.insert_score(&make_score(&db, "sc2", "s2", Some("Piano"))).unwrap();

        let drafts = db.get_songs_with_drafts().unwrap();
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].name, "Canon");
    }

    // ── Cascade Delete ──

    #[test]
    fn test_song_delete_cascades_to_scores() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino"))).unwrap();

        // Deletar a música diretamente via SQL
        {
            let conn = db.conn.lock().unwrap();
            conn.execute("DELETE FROM songs WHERE id = 's1'", []).unwrap();
        }

        let metadata = db.get_all_scores_with_metadata().unwrap();
        assert!(metadata.is_empty());
    }
}
