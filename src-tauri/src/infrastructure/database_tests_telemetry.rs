#[cfg(test)]
mod tests {
    use crate::infrastructure::database::Database;

    fn make_db() -> Database {
        Database::new_in_memory().expect("failed to create in-memory db")
    }

    #[test]
    fn records_telemetry_errors_in_the_local_queue() {
        let db = make_db();

        db.record_telemetry_error("Failed to send telemetry", 1_710_684_000)
            .expect("record telemetry error");

        let errors = db.list_telemetry_errors().expect("list telemetry errors");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].id.len(), 36);
        assert_eq!(errors[0].message, "Failed to send telemetry");
        assert_eq!(errors[0].timestamp, 1_710_684_000);
    }

    #[test]
    fn telemetry_summary_counts_are_zero_for_an_empty_database() {
        let db = make_db();

        let counts = db.get_telemetry_summary_counts().expect("telemetry counts");

        assert_eq!(counts.music_count, 0);
        assert_eq!(counts.music_main, 0);
        assert_eq!(counts.music_draft, 0);
        assert_eq!(counts.scores_count, 0);
        assert_eq!(counts.scores_main, 0);
        assert_eq!(counts.scores_draft, 0);
    }
}
