#[cfg(test)]
mod tests {
    use crate::domain::models::*;
    use crate::infrastructure::database::Database;
    use chrono::Local;

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
            path: format!("/music/{}", id),
            is_favorite: false,
            status: ScoreStatus::Main,
            updated_at: now(),
            updated_by: "test-computer".to_string(),
        }
    }

    fn make_score(_db: &Database, id: &str, song_id: &str, name: Option<&str>) -> Score {
        let base_path = "/tmp/music".to_string();
        Score {
            id: id.to_string(),
            song_id: song_id.to_string(),
            name: name.map(|s| s.to_string()),
            host_id: "test-computer".to_string(),
            file_path: base_path,
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

    fn count_changed_field_for_entity(db: &Database, entity: &str) -> i64 {
        let conn = db.conn.lock().unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM changedField WHERE entity = ?1",
            [entity],
            |row| row.get(0),
        )
        .unwrap()
    }

    // ── Paths ──

    #[test]
    fn test_split_file_path() {
        let (file_path, file_name) =
            crate::services::indexer::split_file_path("/home/user/music/Canon.musx");
        assert_eq!(file_path, "/home/user/music");
        assert_eq!(file_name, "Canon.musx");
    }

    // ── Song CRUD ──

    #[test]
    fn test_insert_and_get_all_songs() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight Sonata"), &[])
            .unwrap();

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
    fn test_get_all_songs_returns_alphabetical_order_case_insensitive() {
        let db = make_db();
        db.insert_song(&make_song("s1", "zeta"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Alpha"), &[]).unwrap();
        db.insert_song(&make_song("s3", "beta"), &[]).unwrap();

        let songs = db.get_all_songs().unwrap();
        let names: Vec<&str> = songs.iter().map(|song| song.name.as_str()).collect();

        assert_eq!(names, vec!["Alpha", "beta", "zeta"]);
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
    fn test_get_song_by_id_missing() {
        let db = make_db();
        let result = db.get_song_by_id("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_song_list_item_by_id() {
        let db = make_db();
        let cat = make_category("c1", "Hinos");
        db.insert_category(&cat).unwrap();
        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()])
            .unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        let item = db.get_song_list_item_by_id("s1").unwrap();
        assert_eq!(item.name, "Canon");
        assert_eq!(item.scores.len(), 1);
        assert_eq!(item.category_ids.len(), 1);
    }

    #[test]
    fn test_get_song_list_item_by_id_missing() {
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

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()])
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 1);

        let song = make_song("s1", "Canon");
        db.update_song(&song, &["c1".to_string(), "c2".to_string()])
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].category_ids.len(), 2);

        let song_events = count_changed_field_for_entity(&db, "songs");
        let relation_events = count_changed_field_for_entity(&db, "categoriesSongs");
        assert!(song_events > 0);
        assert!(relation_events > 0);
    }

    #[test]
    fn test_insert_song_category_ids_are_trimmed_deduplicated_and_blank_filtered() {
        let db = make_db();
        db.insert_category(&make_category("c1", "Hinos")).unwrap();
        db.insert_category(&make_category("c2", "Clássicas"))
            .unwrap();

        let relation_events_before = count_changed_field_for_entity(&db, "categoriesSongs");
        db.insert_song(
            &make_song("s1", "Canon"),
            &[
                "c1".to_string(),
                " c1 ".to_string(),
                "c2".to_string(),
                "c2".to_string(),
                "   ".to_string(),
            ],
        )
        .unwrap();

        let song = db.get_song_list_item_by_id("s1").unwrap();
        assert_eq!(song.category_ids, vec!["c1".to_string(), "c2".to_string()]);

        let relation_events_after = count_changed_field_for_entity(&db, "categoriesSongs");
        assert_eq!(relation_events_after - relation_events_before, 4);
    }

    #[test]
    fn test_insert_song_uses_default_category_when_only_blank_categories_are_sent() {
        let db = make_db();

        db.insert_song(
            &make_song("s1", "Canon"),
            &["".to_string(), "   ".to_string()],
        )
        .unwrap();

        let song = db.get_song_list_item_by_id("s1").unwrap();
        assert_eq!(song.category_ids, vec!["default-category".to_string()]);
    }

    #[test]
    fn test_update_song_removes_default_category_when_a_real_category_is_selected() {
        let db = make_db();

        let cat = make_category("c1", "Hinos");
        db.insert_category(&cat).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        db.update_song(
            &make_song("s1", "Canon"),
            &["default-category".to_string(), "c1".to_string()],
        )
        .unwrap();

        let song = db.get_song_list_item_by_id("s1").unwrap();
        assert_eq!(song.category_ids, vec!["c1".to_string()]);
    }

    #[test]
    fn test_update_song_category_ids_are_deduplicated_for_changed_field_generation() {
        let db = make_db();
        db.insert_category(&make_category("c1", "Hinos")).unwrap();
        db.insert_category(&make_category("c2", "Clássicas"))
            .unwrap();
        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()])
            .unwrap();

        let relation_events_before = count_changed_field_for_entity(&db, "categoriesSongs");
        db.update_song(
            &make_song("s1", "Canon"),
            &[
                "c1".to_string(),
                "c1".to_string(),
                "c2".to_string(),
                " c2 ".to_string(),
                "".to_string(),
            ],
        )
        .unwrap();

        let song = db.get_song_list_item_by_id("s1").unwrap();
        assert_eq!(song.category_ids, vec!["c1".to_string(), "c2".to_string()]);

        let relation_events_after = count_changed_field_for_entity(&db, "categoriesSongs");
        assert_eq!(relation_events_after - relation_events_before, 2);
    }

    // ── Search ──

    #[test]
    fn test_search_songs() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon in D"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight Sonata"), &[])
            .unwrap();

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
}
