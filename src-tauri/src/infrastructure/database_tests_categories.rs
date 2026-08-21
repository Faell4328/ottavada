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
        }
    }

    fn make_category(id: &str, name: &str) -> Category {
        Category {
            id: id.to_string(),
            name: name.to_string(),
        }
    }

    // ── Categories ──

    #[test]
    fn test_category_crud() {
        let db = make_db();
        let cat = make_category("c1", "Christian Harp");
        let cat2 = make_category("c2", "Acordes");
        db.insert_category(&cat).unwrap();
        db.insert_category(&cat2).unwrap();

        let categories = db.get_all_categories().unwrap();
        assert_eq!(categories.len(), 3);
        assert_eq!(categories[0].id, "default-category");
        assert_eq!(categories[0].name, "Uncategorized");
        assert_eq!(categories[1].name, "Acordes");
        assert_eq!(categories[2].name, "Christian Harp");

        db.delete_category("c1").unwrap();
        db.delete_category("c2").unwrap();
        let categories = db.get_all_categories().unwrap();
        assert_eq!(categories.len(), 1);
        assert_eq!(categories[0].id, "default-category");
        assert_eq!(categories[0].name, "Uncategorized");
    }

    #[test]
    fn test_update_category_renames_category() {
        let db = make_db();
        let cat = make_category("c1", "Christian Harp");
        db.insert_category(&cat).unwrap();

        db.update_category("c1", "Choir").unwrap();

        let categories = db.get_all_categories().unwrap();
        assert!(categories.iter().any(|c| c.id == "c1" && c.name == "Choir"));

        let conn = db.lock_conn();
        let change_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changes WHERE entity = 'categories' AND entityId = ?1 AND field = 'name' AND value = 'Choir'",
                ["c1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(change_count, 1);
    }

    #[test]
    fn test_update_default_category_is_rejected() {
        let db = make_db();

        let result = db.update_category("default-category", "Outra");

        assert!(result.is_err());
    }

    // ── Composer / Arranger ──

    #[test]
    fn test_update_composer_renames_matching_songs() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Ave Maria"), &[]).unwrap();

        db.update_composer("Bach", "Pachelbel").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs
            .iter()
            .all(|song| song.composer.as_deref() == Some("Pachelbel")));
    }

    #[test]
    fn test_delete_composer_clears_matching_songs() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Ave Maria"), &[]).unwrap();

        db.delete_composer("Bach").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs.iter().all(|song| song.composer.is_none()));
    }

    #[test]
    fn test_update_arranger_renames_matching_songs() {
        let db = make_db();

        let mut song1 = make_song("s1", "Canon");
        song1.arranger = Some("Ana".to_string());
        let mut song2 = make_song("s2", "Ave Maria");
        song2.arranger = Some("Ana".to_string());

        db.insert_song(&song1, &[]).unwrap();
        db.insert_song(&song2, &[]).unwrap();

        db.update_arranger("Ana", "Bruno").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs
            .iter()
            .all(|song| song.arranger.as_deref() == Some("Bruno")));
    }

    #[test]
    fn test_delete_arranger_clears_matching_songs() {
        let db = make_db();

        let mut song1 = make_song("s1", "Canon");
        song1.arranger = Some("Ana".to_string());
        let mut song2 = make_song("s2", "Ave Maria");
        song2.arranger = Some("Ana".to_string());

        db.insert_song(&song1, &[]).unwrap();
        db.insert_song(&song2, &[]).unwrap();

        db.delete_arranger("Ana").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs.iter().all(|song| song.arranger.is_none()));
    }

    // ── Songs by Category ──

    #[test]
    fn test_songs_by_category() {
        let db = make_db();

        let cat = make_category("c1", "Hinos");
        db.insert_category(&cat).unwrap();

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()])
            .unwrap();
        db.insert_song(&make_song("s2", "Moonlight"), &[]).unwrap();

        let songs = db.get_songs_by_category("c1").unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].name, "Canon");
    }

    #[test]
    fn test_song_multiple_categories() {
        let db = make_db();

        let cat1 = make_category("c1", "Hinos");
        let cat2 = make_category("c2", "Classics");
        db.insert_category(&cat1).unwrap();
        db.insert_category(&cat2).unwrap();

        db.insert_song(
            &make_song("s1", "Canon"),
            &["c1".to_string(), "c2".to_string()],
        )
        .unwrap();

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

        db.insert_song(&make_song("s1", "Canon"), &["c1".to_string()])
            .unwrap();
        db.delete_category("c1").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 1);
        assert!(songs[0].category_ids.is_empty());
    }
}
