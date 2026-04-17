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

    #[test]
    fn records_telemetry_errors_in_the_local_queue() {
        let db = make_db();

        db.record_telemetry_error("server-1", "Falha ao enviar telemetria", 1_710_684_000)
            .expect("record telemetry error");

        let errors = db.list_telemetry_errors().expect("list telemetry errors");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].id.len(), 36);
        assert_eq!(errors[0].message, "Falha ao enviar telemetria");
        assert_eq!(errors[0].timestamp, 1_710_684_000);
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
        db.insert_category(&make_category("c2", "Clássicas")).unwrap();

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
    fn test_update_song_category_ids_are_deduplicated_for_changed_field_generation() {
        let db = make_db();
        db.insert_category(&make_category("c1", "Hinos")).unwrap();
        db.insert_category(&make_category("c2", "Clássicas")).unwrap();
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

    // ── Scores ──

    #[test]
    fn test_insert_score_and_list() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino 1")))
            .unwrap();
        db.insert_score(&make_score(&db, "sc2", "s1", Some("Piano")))
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].scores.len(), 2);
    }

    #[test]
    fn test_scores_are_returned_in_alphabetical_order() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let score_a = Score {
            id: "sc-a".to_string(),
            song_id: "s1".to_string(),
            name: Some("Viola".to_string()),
            host_id: "test-computer".to_string(),
            file_path: "/tmp/music".to_string(),
            file_name: "viola.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        let score_b = Score {
            id: "sc-b".to_string(),
            song_id: "s1".to_string(),
            name: Some("clarinete".to_string()),
            host_id: "test-computer".to_string(),
            file_path: "/tmp/music".to_string(),
            file_name: "clarinete.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        let score_c = Score {
            id: "sc-c".to_string(),
            song_id: "s1".to_string(),
            name: None,
            host_id: "test-computer".to_string(),
            file_path: "/tmp/music".to_string(),
            file_name: "Flauta.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };

        db.insert_score(&score_a).unwrap();
        db.insert_score(&score_b).unwrap();
        db.insert_score(&score_c).unwrap();

        let songs = db.get_all_songs().unwrap();
        let ordered_ids: Vec<&str> = songs[0].scores.iter().map(|score| score.id.as_str()).collect();

        assert_eq!(ordered_ids, vec!["sc-b", "sc-c", "sc-a"]);
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
    fn test_get_library_summary_counts_includes_pending_and_not_found() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Ave Maria"), &[]).unwrap();

        let mut main_score = make_score(&db, "sc1", "s1", Some("Violino"));
        main_score.status = ScoreStatus::Main;
        db.insert_score(&main_score).unwrap();

        let mut pending_score = make_score(&db, "sc2", "s1", Some("Piano"));
        pending_score.status = ScoreStatus::Pending;
        db.insert_score(&pending_score).unwrap();

        let mut not_found_score = make_score(&db, "sc3", "s2", Some("Trompete"));
        not_found_score.status = ScoreStatus::NotFound;
        db.insert_score(&not_found_score).unwrap();

        let summary = db.get_library_summary_counts().unwrap();

        assert_eq!(summary.main.scores_count, 1);
        assert_eq!(summary.main.songs_count, 1);
        assert_eq!(summary.pending.scores_count, 1);
        assert_eq!(summary.pending.songs_count, 1);
        assert_eq!(summary.not_found.scores_count, 1);
        assert_eq!(summary.not_found.songs_count, 1);
    }

    #[test]
    fn test_score_file_extension_derived() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = "/tmp/music".to_string();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: dir_id,
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

        let dir_id = "/home/user/music".to_string();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs[0].scores[0]
            .file_path
            .contains("Canon - Violino.musx"));
        assert!(songs[0].scores[0].file_path.contains("music"));
    }

    #[test]
    fn test_update_score() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "UPDATE backupSongs
                 SET status = ?1,
                     last_backup_at = ?2,
                     error_message = NULL
                 WHERE song_id = ?3",
                rusqlite::params!["ok", 123_i64, "s1"],
            )
            .unwrap();
        }

        let new_dir_id = "/new/path".to_string();
        db.update_score(
            "sc1",
            Some("Violino 1".to_string()),
            &new_dir_id,
            "score.musx",
            2048,
            now(),
            now(),
            "test-computer",
        )
        .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].name, Some("Violino 1".to_string()));
        assert!(songs[0].scores[0].file_path.contains("score.musx"));
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Main);

        let conn = db.conn.lock().unwrap();
        let backup = conn
            .query_row(
                "SELECT status, last_backup_at FROM backupSongs WHERE song_id = ?1",
                ["s1"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(backup.0, "processing");
        assert_eq!(backup.1, None);
    }

    #[test]
    fn test_insert_score_marks_song_backup_as_processing_and_stale() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO backupSongs (id, song_id, status, last_backup_at, error_message)
                 VALUES (?1, ?2, ?3, ?4, NULL)",
                rusqlite::params!["b1", "s1", "ok", 123_i64],
            )
            .unwrap();
        }

        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        let conn = db.conn.lock().unwrap();
        let backup = conn
            .query_row(
                "SELECT status, last_backup_at FROM backupSongs WHERE song_id = ?1",
                ["s1"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(backup.0, "processing");
        assert!(backup.1.is_none());
    }

    #[test]
    fn test_delete_score() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.delete_score("sc1").unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores.len(), 0);

        let score_events = count_changed_field_for_entity(&db, "scores");
        assert!(score_events > 0);
    }

    #[test]
    fn test_delete_score_not_found() {
        let db = make_db();
        let result = db.delete_score("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_score_marks_song_backup_as_processing_and_stale() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.delete_score("sc1").unwrap();

        let conn = db.conn.lock().unwrap();
        let backup = conn
            .query_row(
                "SELECT status, last_backup_at FROM backupSongs WHERE song_id = ?1",
                ["s1"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(backup.0, "processing");
        assert!(backup.1.is_none());
    }

    #[test]
    fn test_get_score_file_path() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = "/music/scores".to_string();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: dir_id,
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

    #[test]
    fn test_get_score_file_path_accepts_legacy_full_path_storage() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let legacy_full_path = "/music/scores/Canon - Violino.musx".to_string();
        let score = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: legacy_full_path.clone(),
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "test-computer".to_string(),
        };
        db.insert_score(&score).unwrap();

        let resolved = db.get_score_file_path("sc1").unwrap();
        assert_eq!(resolved, legacy_full_path);
    }

    #[test]
    fn test_song_listing_uses_legacy_full_path_without_duplication() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let legacy_full_path = "/music/scores/Canon - Violino.musx";
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                "sc1",
                "s1",
                "Violino",
                "test-computer",
                legacy_full_path,
                "Canon - Violino.musx",
                1024u64,
                datetime_utils::format_datetime(now()),
                "main"
            ],
        )
        .unwrap();
        drop(conn);

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].scores.len(), 1);
        assert_eq!(songs[0].scores[0].file_path, legacy_full_path);
    }

    // ── Score Status ──

    #[test]
    fn test_update_score_status() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None)
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Draft);
    }

    #[test]
    fn test_update_score_status_with_metadata() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        let new_modified_at = now();
        db.update_score_status(
            "sc1",
            ScoreStatus::Draft,
            "test-computer",
            Some((4096, new_modified_at)),
        )
        .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Draft);

        let conn = db.conn.lock().unwrap();
        let status_events: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changedField WHERE entity = 'scores' AND field = 'status'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(status_events > 0);
    }

        #[test]
        fn test_update_score_status_not_found_creates_changed_field_event() {
            let db = make_db();
            db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
            db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
                .unwrap();

            db.update_score_status("sc1", ScoreStatus::NotFound, "test-computer", None)
                .unwrap();

            let conn = db.conn.lock().unwrap();
            let not_found_events: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM changedField
                     WHERE entity = 'scores' AND field = 'status' AND newValue = 'not_found'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();

            assert_eq!(not_found_events, 1);
        }

    #[test]
    fn test_update_score_status_draft_creates_changed_field_event() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None)
            .unwrap();

        let conn = db.conn.lock().unwrap();
        let draft_events: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changedField
                 WHERE entity = 'scores' AND field = 'status' AND newValue = 'draft'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(draft_events, 1);
    }

    #[test]
    fn test_get_previous_status_before_latest_not_found() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None)
            .unwrap();
        db.update_score_status("sc1", ScoreStatus::NotFound, "test-computer", None)
            .unwrap();

        let previous_status = db
            .get_previous_status_before_latest_not_found("sc1")
            .unwrap();

        assert_eq!(previous_status, Some(ScoreStatus::Draft));
    }

    // ── Score Metadata for Scanning ──

    #[test]
    fn test_get_all_scores_with_metadata() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();
        db.insert_score(&make_score(&db, "sc2", "s1", Some("Piano")))
            .unwrap();

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

        let dir1 = "/music/classical".to_string();
        let dir2 = "/music/hymns".to_string();

        let score1 = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: dir1,
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
            file_path: dir2,
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

        let paths: Vec<&str> = songs[0]
            .scores
            .iter()
            .map(|s| s.file_path.as_str())
            .collect();
        assert!(paths.iter().any(|p| p.contains("classical")));
        assert!(paths.iter().any(|p| p.contains("hymns")));
    }

    #[test]
    fn test_unique_constraint_directory_file_name() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let dir_id = "/music".to_string();
        let score1 = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: dir_id.clone(),
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
            file_path: dir_id,
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

        let dir1 = "/music/v1".to_string();
        let dir2 = "/music/v2".to_string();

        let score1 = Score {
            id: "sc1".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino".to_string()),
            host_id: "test-computer".to_string(),
            file_path: dir1,
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
            file_path: dir2,
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
        assert_eq!(categories.len(), 2);
        assert!(categories.iter().any(|c| c.id == "c1" && c.name == "Harpa Cristã"));
        assert!(categories
            .iter()
            .any(|c| c.id == "default-category" && c.name == "Sem categoria"));

        db.delete_category("c1").unwrap();
        let categories = db.get_all_categories().unwrap();
        assert_eq!(categories.len(), 1);
        assert_eq!(categories[0].id, "default-category");
        assert_eq!(categories[0].name, "Sem categoria");
    }

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
        let cat2 = make_category("c2", "Clássicas");
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

    // ── Songs with Drafts ──

    #[test]
    fn test_get_songs_with_drafts() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Moonlight"), &[]).unwrap();

        let mut draft_score = make_score(&db, "sc1", "s1", Some("Violino"));
        draft_score.status = ScoreStatus::Draft;
        db.insert_score(&draft_score).unwrap();

        db.insert_score(&make_score(&db, "sc2", "s2", Some("Piano")))
            .unwrap();

        let drafts = db.get_songs_with_drafts().unwrap();
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].name, "Canon");
    }

    // ── Cascade Delete ──

    #[test]
    fn test_song_delete_cascades_to_scores() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        // Deletar a música diretamente via SQL
        {
            let conn = db.conn.lock().unwrap();
            conn.execute("DELETE FROM songs WHERE id = 's1'", [])
                .unwrap();
        }

        let metadata = db.get_all_scores_with_metadata().unwrap();
        assert!(metadata.is_empty());
    }
}
