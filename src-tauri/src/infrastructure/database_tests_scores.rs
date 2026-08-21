#[cfg(test)]
mod tests {
    use crate::domain::models::*;
    use crate::infrastructure::database::Database;

    fn make_db() -> Database {
        Database::new_in_memory().expect("failed to create in-memory db")
    }

    fn now() -> chrono::NaiveDateTime {
        chrono::Utc::now().naive_utc()
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

    fn make_score(_db: &Database, id: &str, song_id: &str, name: Option<&str>) -> Score {
        let base_path = "/tmp/music".to_string();
        Score {
            id: id.to_string(),
            song_id: song_id.to_string(),
            name: name.map(|s| s.to_string()),
            file_path: base_path,
            file_name: format!("{}.pdf", name.unwrap_or("test")),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        }
    }

    fn count_changed_field_for_entity(db: &Database, entity: &str) -> i64 {
        let conn = db.lock_conn();
        conn.query_row(
            "SELECT COUNT(*) FROM changes WHERE entity = ?1",
            [entity],
            |row| row.get(0),
        )
        .unwrap()
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
            file_path: "/tmp/music".to_string(),
            file_name: "viola.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        let score_b = Score {
            id: "sc-b".to_string(),
            song_id: "s1".to_string(),
            name: Some("clarinete".to_string()),
            file_path: "/tmp/music".to_string(),
            file_name: "clarinete.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        let score_c = Score {
            id: "sc-c".to_string(),
            song_id: "s1".to_string(),
            name: None,
            file_path: "/tmp/music".to_string(),
            file_name: "Flauta.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        db.insert_score(&score_a).unwrap();
        db.insert_score(&score_b).unwrap();
        db.insert_score(&score_c).unwrap();

        let songs = db.get_all_songs().unwrap();
        let ordered_ids: Vec<&str> = songs[0]
            .scores
            .iter()
            .map(|score| score.id.as_str())
            .collect();

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
    fn test_get_library_summary_counts_includes_main_and_draft() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_song(&make_song("s2", "Ave Maria"), &[]).unwrap();

        let mut main_score = make_score(&db, "sc1", "s1", Some("Violino"));
        main_score.status = ScoreStatus::Main;
        db.insert_score(&main_score).unwrap();

        let mut draft_score = make_score(&db, "sc2", "s1", Some("Piano"));
        draft_score.status = ScoreStatus::Draft;
        db.insert_score(&draft_score).unwrap();

        let mut second_draft_score = make_score(&db, "sc3", "s2", Some("Trompete"));
        second_draft_score.status = ScoreStatus::Draft;
        db.insert_score(&second_draft_score).unwrap();

        let summary = db.get_library_summary_counts().unwrap();

        assert_eq!(summary.main.scores_count, 1);
        assert_eq!(summary.main.songs_count, 1);
        assert_eq!(summary.draft.scores_count, 2);
        assert_eq!(summary.draft.songs_count, 2);
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
            file_path: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
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
            file_path: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };
        db.insert_score(&score).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert!(songs[0].scores[0]
            .file_path
            .contains("Canon - Violino.musx"));
        assert!(songs[0].scores[0].file_path.contains("music"));
    }

    #[test]
    fn test_update_score_name() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.update_score_name("sc1", Some("Violino 1".to_string()))
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores[0].name, Some("Violino 1".to_string()));
        assert_eq!(songs[0].scores[0].status, ScoreStatus::Main);
    }

    #[test]
    fn test_insert_score_marks_song_backup_as_processing_and_stale() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        {
            let conn = db.lock_conn();
            conn.execute(
                "INSERT INTO backupQueue (songId, status)
                 VALUES (?1, ?2)",
                rusqlite::params!["s1", "ok"],
            )
            .unwrap();
        }

        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        let conn = db.lock_conn();
        let backup = conn
            .query_row(
                "SELECT status FROM backupQueue WHERE songId = ?1",
                ["s1"],
                |row| Ok(row.get::<_, String>(0)?),
            )
            .unwrap();

        assert_eq!(backup, "processing");
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
    fn test_delete_score_missing() {
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

        let conn = db.lock_conn();
        let backup = conn
            .query_row(
                "SELECT status FROM backupQueue WHERE songId = ?1",
                ["s1"],
                |row| Ok(row.get::<_, String>(0)?),
            )
            .unwrap();

        assert_eq!(backup, "processing");
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
            file_path: dir_id,
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };
        db.insert_score(&score).unwrap();

        let path = db.get_score_file_path("sc1").unwrap();
        assert!(path.contains("Canon - Violino.musx"));
        assert!(path.contains("music"));
    }

    #[test]
    fn test_get_score_file_path_missing() {
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
            file_path: legacy_full_path.clone(),
            file_name: "Canon - Violino.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
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
        let conn = db.lock_conn();
        conn.execute(
            "INSERT INTO scores (id, song_id, name, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                "sc1",
                "s1",
                "Violino",
                legacy_full_path,
                "Canon - Violino.musx",
                "musx",
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

        let conn = db.lock_conn();
        let status_events: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changes WHERE entity = 'scores' AND field = 'status'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(status_events > 0);
    }

    #[test]
    fn test_song_status_is_derived_from_score_statuses() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();
        db.insert_score(&make_score(&db, "sc2", "s1", Some("Piano")))
            .unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None)
            .unwrap();
        db.update_score_status("sc2", ScoreStatus::Draft, "test-computer", None)
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].status, ScoreStatus::Draft);

        db.update_score_status("sc1", ScoreStatus::Main, "test-computer", None)
            .unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].status, ScoreStatus::Main);
    }

    #[test]
    fn test_update_score_status_draft_creates_changed_field_event() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None)
            .unwrap();

        let conn = db.lock_conn();
        let draft_events: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changes
                 WHERE entity = 'scores' AND field = 'status' AND value = 'main' AND type = 'update'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(draft_events, 1);
    }

    #[test]
    fn test_update_score_status_ignored_does_not_create_pending_change() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.clear_changed_fields().unwrap();

        db.update_score_status("sc1", ScoreStatus::Ignored, "test-computer", None)
            .unwrap();

        let conn = db.lock_conn();
        let ignored_events: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changes WHERE entity = 'scores' AND field = 'status' AND value = 'ignored' AND type = 'update'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(ignored_events, 0);

        let previous_main_events: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changes WHERE entity = 'scores' AND field = 'status' AND value = 'main' AND type = 'update'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(previous_main_events, 1);
    }

    #[test]
    fn test_update_score_status_main_marks_song_backup_processing() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
        db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
            .unwrap();

        db.update_score_status("sc1", ScoreStatus::Draft, "test-computer", None)
            .unwrap();

        {
            let conn = db.lock_conn();
            conn.execute(
                "UPDATE backupQueue SET status = 'ok' WHERE songId = ?1",
                ["s1"],
            )
            .unwrap();
        }

        db.update_score_status("sc1", ScoreStatus::Main, "test-computer", None)
            .unwrap();

        let conn = db.lock_conn();
        let status: String = conn
            .query_row(
                "SELECT status FROM backupQueue WHERE songId = ?1",
                ["s1"],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(status, "processing");
    }

    #[test]
    fn test_update_score_status_non_main_marks_song_backup_processing() {
        let statuses = [ScoreStatus::Draft, ScoreStatus::Ignored];

        for status in statuses {
            let db = make_db();
            db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();
            db.insert_score(&make_score(&db, "sc1", "s1", Some("Violino")))
                .unwrap();

            {
                let conn = db.lock_conn();
                conn.execute(
                    "UPDATE backupQueue SET status = 'ok' WHERE songId = ?1",
                    ["s1"],
                )
                .unwrap();
            }

            db.update_score_status("sc1", status.clone(), "test-computer", None)
                .unwrap();

            let conn = db.lock_conn();
            let backup: String = conn
                .query_row(
                    "SELECT status FROM backupQueue WHERE songId = ?1",
                    ["s1"],
                    |row| row.get(0),
                )
                .unwrap();

            assert_eq!(backup, "processing");
        }
    }

    #[test]
    fn test_update_song_status_for_song_draft_keeps_ignored_scores_unchanged() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let mut main_score = make_score(&db, "sc1", "s1", Some("Violino"));
        main_score.status = ScoreStatus::Main;
        db.insert_score(&main_score).unwrap();

        let mut ignored_score = make_score(&db, "sc2", "s1", Some("Piano"));
        ignored_score.status = ScoreStatus::Ignored;
        db.insert_score(&ignored_score).unwrap();

        db.update_song_status_for_song("s1", ScoreStatus::Draft, "test-computer")
            .unwrap();

        let conn = db.lock_conn();
        let main_status: String = conn
            .query_row("SELECT status FROM scores WHERE id = ?1", ["sc1"], |row| {
                row.get(0)
            })
            .unwrap();
        let ignored_status: String = conn
            .query_row("SELECT status FROM scores WHERE id = ?1", ["sc2"], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(main_status, ScoreStatus::Draft.as_str());
        assert_eq!(ignored_status, ScoreStatus::Ignored.as_str());
    }

    #[test]
    fn test_song_becomes_not_found_when_last_active_score_is_removed() {
        let db = make_db();
        db.insert_song(&make_song("s1", "Canon"), &[]).unwrap();

        let score = make_score(&db, "sc1", "s1", Some("Violino"));
        db.insert_score(&score).unwrap();

        db.delete_score("sc1").unwrap();

        let conn = db.lock_conn();
        let song_status: String = conn
            .query_row("SELECT status FROM songs WHERE id = ?1", ["s1"], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(song_status, ScoreStatus::NotFound.as_str());
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
            file_path: dir1,
            file_name: "Canon - Violino.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        let score2 = Score {
            id: "sc2".to_string(),
            song_id: "s1".to_string(),
            name: Some("Piano".to_string()),
            file_path: dir2,
            file_name: "Canon - Piano.pdf".to_string(),
            file_size: 2048,
            file_modified_at: now(),
            status: ScoreStatus::Main,
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
            file_path: dir_id.clone(),
            file_name: "Canon.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        let score2 = Score {
            id: "sc2".to_string(),
            song_id: "s1".to_string(),
            name: Some("Piano".to_string()),
            file_path: dir_id,
            file_name: "Canon.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        db.insert_score(&score1).unwrap();
        let result = db.insert_score(&score2);
        assert!(result.is_err());
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
            file_path: dir1,
            file_name: "Canon.pdf".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        let score2 = Score {
            id: "sc2".to_string(),
            song_id: "s1".to_string(),
            name: Some("Violino v2".to_string()),
            file_path: dir2,
            file_name: "Canon.pdf".to_string(),
            file_size: 2048,
            file_modified_at: now(),
            status: ScoreStatus::Main,
        };

        db.insert_score(&score1).unwrap();
        db.insert_score(&score2).unwrap();

        let songs = db.get_all_songs().unwrap();
        assert_eq!(songs[0].scores.len(), 2);
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

        {
            let conn = db.lock_conn();
            conn.execute("DELETE FROM songs WHERE id = 's1'", [])
                .unwrap();
        }

        let metadata = db.get_all_scores_with_metadata().unwrap();
        assert!(metadata.is_empty());
    }
}
