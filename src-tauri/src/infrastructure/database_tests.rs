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
            updated_at: now(),
        }
    }

    fn make_score(id: &str, song_id: &str, name: Option<&str>) -> Score {
        Score {
            id: id.to_string(),
            song_id: song_id.to_string(),
            name: name.map(|s| s.to_string()),
            host_id: "test-computer".to_string(),
            file_path: "/tmp/test.pdf".to_string(),
            updated_at: now(),
            status: ScoreStatus::Main,
        }
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
        db.insert_score(&make_score("sc1", "s1", Some("Violino 1"))).unwrap();
        db.insert_score(&make_score("sc2", "s1", Some("Piano"))).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].scores.len(), 2);
    }

    #[test]
    fn test_score_status() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let mut score = make_score("sc1", "s1", Some("Violino"));
        score.status = ScoreStatus::Draft;
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Draft);
    }

    #[test]
    fn test_score_file_extension_derived() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let mut score = make_score("sc1", "s1", Some("Violino"));
        score.file_path = "/tmp/Canon - Violino.musx".to_string();
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].file_extension, "musx");
    }

    // ── Categories ──

    #[test]
    fn test_category_crud() {
        let db = make_db();
        let cat = Category {
            id: "c1".to_string(),
            name: "Harpa Cristã".to_string(),
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
    fn test_songs_by_category() {
        let db = make_db();

        let cat = Category {
            id: "c1".to_string(),
            name: "Hinos".to_string(),
        };
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

        let cat1 = Category { id: "c1".to_string(), name: "Hinos".to_string() };
        let cat2 = Category { id: "c2".to_string(), name: "Clássicas".to_string() };
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

        let cat = Category { id: "c1".to_string(), name: "Hinos".to_string() };
        db.insert_category(&cat).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()]).unwrap();
        db.delete_category("c1").unwrap();

        // Song should still exist but without category
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

        // s1 has a draft score
        let mut draft_score = make_score("sc1", "s1", Some("Violino"));
        draft_score.status = ScoreStatus::Draft;
        db.insert_score(&draft_score).unwrap();

        // s2 has only a main score
        db.insert_score(&make_score("sc2", "s2", Some("Piano"))).unwrap();

        let drafts = db.get_songs_with_drafts().unwrap();
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].name, "Canon");
    }

    // ── Update Song ──

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
        let cat1 = Category { id: "c1".to_string(), name: "Hinos".to_string() };
        let cat2 = Category { id: "c2".to_string(), name: "Clássicas".to_string() };
        db.insert_category(&cat1).unwrap();
        db.insert_category(&cat2).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()]).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 1);

        // Update to have both categories
        let song = make_song("s1", "Canon");
        db.update_song(&song, &["c1".to_string(), "c2".to_string()]).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 2);
    }

    // ── Update Score ──

    #[test]
    fn test_update_score() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score("sc1", "s1", Some("Violino"))).unwrap();

        db.update_score("sc1", Some("Violino 1".to_string()), "/new/path.musx", now()).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].name, Some("Violino 1".to_string()));
        assert_eq!(songs[0].scores[0].file_path, "/new/path.musx");
    }

    // ── Get Score File Path ──

    #[test]
    fn test_get_score_file_path() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let mut score = make_score("sc1", "s1", Some("Violino"));
        score.file_path = "/music/Canon - Violino.musx".to_string();
        db.insert_score(&score).unwrap();

        let path = db.get_score_file_path("sc1").unwrap();
        assert_eq!(path, "/music/Canon - Violino.musx");
    }

    #[test]
    fn test_get_score_file_path_not_found() {
        let db = make_db();
        let result = db.get_score_file_path("nonexistent");
        assert!(result.is_err());
    }
}
