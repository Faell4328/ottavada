use rusqlite::params;
use std::collections::HashMap;
use std::path::Path;

use crate::domain::models::ScoreStatus;
use crate::infrastructure::database::{ChangedFieldRecord, Database};

pub fn build_report_items(
    db: &Database,
    changed_files: &[String],
    added_files: &[String],
    deleted_files: &[String],
    recovered_files: &[String],
    failed_files: &[(String, String)],
    changed_fields: &[ChangedFieldRecord],
) -> Vec<String> {
    let mut items = Vec::new();
    let mut category_names_by_id: HashMap<String, String> = HashMap::new();
    let mut status_changes_by_score_id: HashMap<String, Vec<&ChangedFieldRecord>> = HashMap::new();
    let mut status_change_order: Vec<String> = Vec::new();

    for change in changed_fields {
        if change.entity == "categories" && change.change_type == "insert" {
            if let (Some(field), Some(value)) = (change.field.as_deref(), change.value.as_ref()) {
                if field == "name" {
                    category_names_by_id.insert(change.entity_id.clone(), value.clone());
                }
            }
        }

        if change.entity == "scores"
            && change.change_type == "update"
            && change.field.as_deref() == Some("status")
        {
            if !status_changes_by_score_id.contains_key(&change.entity_id) {
                status_change_order.push(change.entity_id.clone());
            }

            status_changes_by_score_id
                .entry(change.entity_id.clone())
                .or_default()
                .push(change);
        }
    }

    for item in added_files {
        items.push(format!("Score added: {}", item));
    }

    for item in changed_files {
        items.push(format!("Score changed: {}", item));
    }

    for item in deleted_files {
        items.push(format!("The score {} was deleted.", item));
    }

    for item in recovered_files {
        items.push(format!("Score recovered: {}", item));
    }

    for (path, error) in failed_files {
        items.push(format!("Failed to process {}: {}", path, error));
    }

    for change in changed_fields {
        if change.entity == "scores"
            && change.change_type == "update"
            && change.field.as_deref() == Some("status")
        {
            continue;
        }

        if let Some(item) = describe_database_change(db, &category_names_by_id, change) {
            items.push(item);
        }
    }

    for score_id in status_change_order {
        if let Some(changes) = status_changes_by_score_id.get(&score_id) {
            if let Some(item) = describe_score_status_change_summary(db, changes) {
                items.push(item);
            }
        }
    }

    items
}

pub fn describe_database_change(
    db: &Database,
    category_names_by_id: &HashMap<String, String>,
    change: &ChangedFieldRecord,
) -> Option<String> {
    match change.entity.as_str() {
        "songs" => describe_song_change(db, change),
        "categoriesSongs" => describe_song_category_change(db, category_names_by_id, change),
        "categories" => describe_category_change(change),
        "scores" => describe_score_change(db, change),
        _ => None,
    }
}

pub fn describe_song_category_change(
    db: &Database,
    category_names_by_id: &HashMap<String, String>,
    change: &ChangedFieldRecord,
) -> Option<String> {
    if change.field.as_deref() != Some("categoryId") {
        return None;
    }

    let conn = db.conn.lock().ok()?;
    let category_id = change.value.clone()?;

    let category_name = conn
        .query_row(
            "SELECT name FROM categories WHERE id = ?1",
            params![category_id],
            |row| row.get::<_, String>(0),
        )
        .or_else(|_| {
            category_names_by_id
                .get(&category_id)
                .cloned()
                .ok_or(rusqlite::Error::QueryReturnedNoRows)
        })
        .unwrap_or_else(|_| category_id.clone());

    let song_name = match change.change_type.as_str() {
        "insert" => conn
            .query_row(
                "SELECT s.name
                 FROM categoriesSongs cs
                 JOIN songs s ON s.id = cs.songId
                 WHERE cs.id = ?1",
                params![change.entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| change.entity_id.clone()),
        "delete" => conn
            .query_row(
                "SELECT name FROM songs WHERE id = ?1",
                params![change.entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| change.entity_id.clone()),
        _ => change.entity_id.clone(),
    };

    match change.change_type.as_str() {
        "insert" => Some(format!(
            "The category {} was added to the song {}.",
            category_name, song_name
        )),
        "delete" => Some(format!(
            "The category {} was removed from the song {}.",
            category_name, song_name
        )),
        _ => None,
    }
}

pub fn describe_song_change(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let song = db.get_song_by_id(&change.entity_id).ok();
    let song_name = song
        .as_ref()
        .map(|song| song.name.clone())
        .unwrap_or_else(|| change.entity_id.clone());

    match (change.change_type.as_str(), change.field.as_deref()) {
        ("insert", Some("name")) => Some(format!(
            "Song created: {}",
            change.value.clone().unwrap_or(song_name)
        )),
        ("delete", Some("name")) => Some(format!(
            "The song {} was deleted.",
            change.value.clone().unwrap_or(song_name)
        )),
        ("update", Some("name")) => Some(format!(
            "The song {} had its name changed.",
            change.value.clone().unwrap_or(song_name)
        )),
        ("update", Some("status")) => {
            let previous_status_label = match change.value.as_deref() {
                Some("draft") => "draft",
                Some("main") => "main",
                Some("not_found") => "not_found",
                Some(other) => other,
                None => "draft",
            };

            match song.as_ref().map(|song| song.status.as_str()) {
                Some("main") => Some(format!(
                    "The song {} went from {} and returned to main.",
                    song_name, previous_status_label
                )),
                Some("draft") => Some(format!(
                    "The song {} went from {} and went to draft.",
                    song_name, previous_status_label
                )),
                Some("not_found") => Some(format!(
                    "The song {} went from {} and went to not_found.",
                    song_name, previous_status_label
                )),
                _ => Some(format!(
                    "The song {} had its status changed.",
                    song_name
                )),
            }
        }
        ("insert", Some("composer")) => change.value.as_ref().map(|value| {
            format!(
                "The composer {} was added to the song {}.",
                value, song_name
            )
        }),
        (_, Some("composer")) => match (
            change.value.clone(),
            song.as_ref().and_then(|song| song.composer.clone()),
        ) {
            (Some(value), Some(current_value)) if current_value == value => Some(format!(
                "The composer {} was changed in the song {}.",
                value, song_name
            )),
            (Some(value), None) => Some(format!(
                "The composer {} was deleted from the song {}.",
                value, song_name
            )),
            (Some(value), Some(current_value)) if current_value != value => Some(format!(
                "The composer {} was changed in the song {}.",
                current_value, song_name
            )),
            _ => None,
        },
        ("insert", Some("arranger")) => change.value.as_ref().map(|value| {
            format!(
                "The arranger {} was added to the song {}.",
                value, song_name
            )
        }),
        (_, Some("arranger")) => match (
            change.value.clone(),
            song.as_ref().and_then(|song| song.arranger.clone()),
        ) {
            (Some(value), Some(current_value)) if current_value == value => Some(format!(
                "The arranger {} was changed in the song {}.",
                value, song_name
            )),
            (Some(value), None) => Some(format!(
                "The arranger {} was deleted from the song {}.",
                value, song_name
            )),
            (Some(value), Some(current_value)) if current_value != value => Some(format!(
                "The arranger {} was changed in the song {}.",
                current_value, song_name
            )),
            _ => None,
        },
        _ => None,
    }
}

pub fn describe_category_change(change: &ChangedFieldRecord) -> Option<String> {
    match (change.change_type.as_str(), change.field.as_deref()) {
        ("insert", Some("name")) => Some(format!(
            "Category created: {}",
            change
                .value
                .clone()
                .unwrap_or_else(|| change.entity_id.clone())
        )),
        ("delete", Some("name")) => Some(format!(
            "The category {} was deleted.",
            change
                .value
                .clone()
                .unwrap_or_else(|| change.entity_id.clone())
        )),
        _ => None,
    }
}

pub fn describe_score_change(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let score_song_name = db
        .get_song_id_for_score(&change.entity_id)
        .ok()
        .and_then(|song_id| db.get_song_list_item_by_id(&song_id).ok())
        .map(|song| song.name)
        .unwrap_or_default();

    match (change.change_type.as_str(), change.field.as_deref()) {
        ("insert", Some("name")) => describe_score_added(db, change),
        ("delete", Some("file_name")) => Some(format!(
            "The score {} was deleted.",
            change
                .value
                .clone()
                .unwrap_or_else(|| change.entity_id.clone())
        )),
        ("update", Some("name")) => {
            let score_name = change
                .value
                .clone()
                .unwrap_or_else(|| change.entity_id.clone());
            if score_song_name.is_empty() {
                Some(format!("The score {} had its name changed.", score_name))
            } else {
                Some(format!(
                    "The score {} had its name changed in the song {}.",
                    score_name, score_song_name
                ))
            }
        }
        ("update", Some("extension")) => {
            let conn = db.conn.lock().ok()?;
            let result = conn
                .query_row(
                    "SELECT s.file_name, s.name, songs.name
                     FROM scores s
                     JOIN songs ON songs.id = s.song_id
                     WHERE s.id = ?1",
                    params![change.entity_id],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, Option<String>>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    },
                )
                .ok()?;

            let score_name_with_extension = resolve_score_display_name_with_extension(
                &result.0,
                &result.2,
                result.1.as_deref(),
            );

            Some(format!(
                "The score {} had its extension changed in the song {}.",
                score_name_with_extension, result.2
            ))
        }
        ("update", Some("status")) => describe_score_status_change(db, change),
        _ => None,
    }
}

pub fn resolve_score_display_name(
    file_name: &str,
    song_name: &str,
    score_name: Option<&str>,
) -> String {
    if let Some(score_name) = score_name.map(str::trim).filter(|value| !value.is_empty()) {
        return score_name.to_string();
    }

    let file_stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name)
        .trim();

    if file_stem.is_empty() {
        return "No Instrument".to_string();
    }

    let normalized_song_score_name = normalize_score_name(song_name);
    let normalized_file_stem = normalize_score_name(file_stem);

    if normalized_file_stem.eq_ignore_ascii_case(&normalized_song_score_name) {
        return "No Instrument".to_string();
    }

    if file_stem
        .to_ascii_lowercase()
        .starts_with(&song_name.to_ascii_lowercase())
    {
        if let Some(score_suffix) = file_stem.strip_prefix(song_name) {
            let score_suffix = score_suffix.trim_start_matches(" - ").trim();
            if !score_suffix.is_empty() {
                return score_suffix.to_string();
            }
        }

        return "No Instrument".to_string();
    }

    file_stem.to_string()
}

pub fn normalize_score_name(value: &str) -> String {
    value
        .trim()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_start_matches(|character: char| character.is_ascii_digit())
        .trim_start()
        .to_string()
}

pub fn describe_score_status_change(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let conn = db.conn.lock().ok()?;

    let result = conn
        .query_row(
            "SELECT s.file_path, s.file_name, s.name, songs.name, s.status
             FROM scores s
             JOIN songs ON songs.id = s.song_id
             WHERE s.id = ?1",
            params![change.entity_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .ok()?;

    let song_name = result.3;
    let previous_status_label = match change.value.as_deref() {
        Some("ignored") => "ignored",
        Some("draft") => "draft",
        Some("main") => "main",
        Some(other) => other,
        None => "draft",
    };

    let current_status = result.4.as_str();
    let current_status_label = match current_status {
        "ignored" => "ignored",
        "draft" => "draft",
        "main" => "main",
        other => other,
    };

    let score_name_with_extension = resolve_score_display_name_with_extension(
        &result.1,
        &song_name,
        result.2.as_deref(),
    );

    if current_status == "main" {
        Some(format!(
            "The score {} went from {} and returned to main in the song {}.",
            score_name_with_extension, previous_status_label, song_name
        ))
    } else {
        Some(format!(
            "The score {} went from {} and went to {} in the song {}.",
            score_name_with_extension, previous_status_label, current_status_label, song_name
        ))
    }
}

pub fn resolve_score_display_name_with_extension(
    file_name: &str,
    song_name: &str,
    score_name: Option<&str>,
) -> String {
    let score_name = resolve_score_display_name(file_name, song_name, score_name);
    let file_extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value))
        .unwrap_or_default();

    format!("{}{}", score_name, file_extension)
}

pub fn build_score_change_report_item(song_name: &str, score_name: &Option<String>, full_path: &str) -> String {
    let file_name = Path::new(full_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(full_path);
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value))
        .unwrap_or_default();

    let display_name = score_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            Path::new(file_name)
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or(file_name)
        });

    format!("{}{} in the song {}", display_name, extension, song_name)
}

pub fn describe_score_status_change_summary(
    db: &Database,
    changes: &[&ChangedFieldRecord],
) -> Option<String> {
    let first_change = changes.first()?;
    describe_score_status_change(db, first_change)
}

pub fn describe_score_added(db: &Database, change: &ChangedFieldRecord) -> Option<String> {
    let conn = db.conn.lock().ok()?;

    let result = conn
        .query_row(
            "SELECT s.name, s.file_name, songs.name, s.status
             FROM scores s
             JOIN songs ON songs.id = s.song_id
             WHERE s.id = ?1",
            params![change.entity_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .ok()?;

    if ScoreStatus::from_str(&result.3) == ScoreStatus::Ignored {
        return None;
    }

    let score_name = resolve_score_display_name(&result.1, &result.2, result.0.as_deref());
    let score_extension = Path::new(&result.1)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value))
        .unwrap_or_default();

    Some(format!(
        "Score added: {}{} in the song {}.",
        score_name, score_extension, result.2
    ))
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;
    use crate::domain::models::{Score, Song};
    use crate::infrastructure::database::{ChangedFieldRecord, Database};

    fn now() -> chrono::NaiveDateTime {
        chrono::Local::now().naive_local()
    }

    #[test]
    fn describes_recovered_draft_score_without_instrument_uses_file_name() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: None,
            host_id: "server-1".to_string(),
            file_path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            file_name: "CANON.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Draft,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("status".to_string()),
            value: Some("main".to_string()),
            timestamp: 0,
        };

        let text = describe_score_change(&db, &change).expect("description");

        assert!(text.contains("No Instrument.musx"));
        assert!(!text.contains("CANON.musx"));
    }

    #[test]
    fn describes_recovered_score_from_ignored_as_ignored() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            file_name: "CANON - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute(
                "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "prev-status",
                    "update",
                    "scores",
                    "score-1",
                    "status",
                    "ignored",
                    10i64,
                ],
            )
            .expect("insert previous status");
        }

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("status".to_string()),
            value: Some("main".to_string()),
            timestamp: 20,
        };

        let text = describe_score_change(&db, &change).expect("description");

        assert!(text.contains("went from main"));
        assert!(text.contains("returned to main"));
    }

    #[test]
    fn describes_score_status_change_from_ignored_to_draft() {
        let text = describe_score_status_change_for_previous_and_current_status("ignored", "draft");

        assert!(text.contains("ignored"));
        assert!(text.contains("draft"));
        assert!(text.contains("went to draft"));
    }

    #[test]
    fn describes_score_status_change_from_draft_to_ignored() {
        let text = describe_score_status_change_for_previous_and_current_status("draft", "ignored");

        assert!(text.contains("draft"));
        assert!(text.contains("ignored"));
        assert!(text.contains("went to ignored"));
    }

    #[test]
    fn describes_score_status_change_from_main_to_ignored() {
        let text = describe_score_status_change_for_previous_and_current_status("main", "ignored");

        assert!(text.contains("main"));
        assert!(text.contains("ignored"));
        assert!(text.contains("went to ignored"));
    }

    fn describe_score_status_change_for_previous_and_current_status(
        previous_status: &str,
        current_status: &str,
    ) -> String {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "CANON".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            file_name: "CANON - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::from_str(current_status),
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute(
                "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "prev-status",
                    "update",
                    "scores",
                    "score-1",
                    "status",
                    previous_status,
                    10i64,
                ],
            )
            .expect("insert previous status");
        }

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("status".to_string()),
            value: Some(previous_status.to_string()),
            timestamp: 20,
        };

        describe_score_change(&db, &change).expect("description")
    }

    #[test]
    fn describes_inserted_score_as_added() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        let song_dir = dir.path().join("songs").join("song-1");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("name".to_string()),
            value: Some("Flute2".to_string()),
            timestamp: 0,
        };

        let text = describe_score_change(&db, &change).expect("description");

        assert_eq!(
            text,
            "Score added: Flute2.musx in the song 08 H.C. CRISTO, O FIEL AMIGO."
        );
    }

    #[test]
    fn describes_score_extension_change_uses_database_score_name() {
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "277 H.C. SAVED YOU ARE CLEAN YOU ARE".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-1".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Score".to_string()),
            host_id: "server-1".to_string(),
            file_path: "/music/song-1".to_string(),
            file_name: "H.C. SAVED YOU ARE CLEAN YOU ARE.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Main,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "update".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-1".to_string(),
            field: Some("extension".to_string()),
            value: Some("musx".to_string()),
            timestamp: 0,
        };

        let text = describe_score_change(&db, &change).expect("description");

        assert_eq!(
            text,
            "The score Score.musx had its extension changed in the song 277 H.C. SAVED YOU ARE CLEAN YOU ARE."
        );
    }

    #[test]
    fn does_not_describe_ignored_score_as_added() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new_in_memory().expect("db");

        let song_dir = dir.path().join("songs").join("song-1");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
                composer: None,
                arranger: None,
                path: song_dir.to_string_lossy().to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        db.insert_score(&Score {
            id: "score-ignored".to_string(),
            song_id: "song-1".to_string(),
            name: Some("Flute2".to_string()),
            host_id: "server-1".to_string(),
            file_path: song_dir.to_string_lossy().to_string(),
            file_name: "08 H.C. CRISTO, O FIEL AMIGO - Flute2.musx".to_string(),
            file_size: 1024,
            file_modified_at: now(),
            updated_at: now(),
            status: ScoreStatus::Ignored,
            updated_by: "server-1".to_string(),
        })
        .expect("insert score");

        let change = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "scores".to_string(),
            entity_id: "score-ignored".to_string(),
            field: Some("name".to_string()),
            value: Some("Flute2".to_string()),
            timestamp: 0,
        };

        assert_eq!(describe_score_change(&db, &change), None);
    }

    #[test]
    fn describes_composer_and_arranger_changes_with_terminal_punctuation() {
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Behold Our God".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let composer_added = ChangedFieldRecord {
            id: "change-1".to_string(),
            change_type: "insert".to_string(),
            entity: "songs".to_string(),
            entity_id: "song-1".to_string(),
            field: Some("composer".to_string()),
            value: Some("Neusom".to_string()),
            timestamp: 0,
        };

        let arranger_added = ChangedFieldRecord {
            id: "change-2".to_string(),
            change_type: "insert".to_string(),
            entity: "songs".to_string(),
            entity_id: "song-1".to_string(),
            field: Some("arranger".to_string()),
            value: Some("Maria".to_string()),
            timestamp: 0,
        };

        assert_eq!(
            describe_song_change(&db, &composer_added),
            Some("The composer Neusom was added to the song Behold Our God.".to_string())
        );
        assert_eq!(
            describe_song_change(&db, &arranger_added),
            Some("The arranger Maria was added to the song Behold Our God.".to_string())
        );
    }

    #[test]
    fn describes_song_status_change() {
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "Behold Our God".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let status_changed = ChangedFieldRecord {
            id: "change-3".to_string(),
            change_type: "update".to_string(),
            entity: "songs".to_string(),
            entity_id: "song-1".to_string(),
            field: Some("status".to_string()),
            value: Some("draft".to_string()),
            timestamp: 0,
        };

        assert_eq!(
            describe_song_change(&db, &status_changed),
            Some("The song Behold Our God went from draft and returned to main.".to_string())
        );
    }

    #[test]
    fn describes_song_status_change_from_not_found_to_main() {
        let db = Database::new_in_memory().expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "00 - TESTE".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let status_changed = ChangedFieldRecord {
            id: "change-4".to_string(),
            change_type: "update".to_string(),
            entity: "songs".to_string(),
            entity_id: "song-1".to_string(),
            field: Some("status".to_string()),
            value: Some("not_found".to_string()),
            timestamp: 0,
        };

        assert_eq!(
            describe_song_change(&db, &status_changed),
            Some("The song 00 - TESTE went from not_found and returned to main.".to_string())
        );
    }

    #[test]
    fn category_song_report_uses_category_name_from_pending_changes() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("scan.db")).expect("db");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
                composer: None,
                arranger: None,
                path: dir
                    .path()
                    .join("songs")
                    .join("song-1")
                    .to_string_lossy()
                    .to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let category_id = "category-1".to_string();
        let relation_id = "relation-1".to_string();

        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute("PRAGMA foreign_keys = OFF", [])
                .expect("disable foreign keys for test");
            conn.execute(
                "INSERT INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                rusqlite::params![&relation_id, &category_id, "song-1"],
            )
            .expect("insert relation");
        }

        let changed_fields = vec![
            ChangedFieldRecord {
                id: "cat-event-1".to_string(),
                change_type: "insert".to_string(),
                entity: "categories".to_string(),
                entity_id: category_id.clone(),
                field: Some("name".to_string()),
                value: Some("Choir".to_string()),
                timestamp: 1,
            },
            ChangedFieldRecord {
                id: "rel-event-1".to_string(),
                change_type: "insert".to_string(),
                entity: "categoriesSongs".to_string(),
                entity_id: relation_id,
                field: Some("categoryId".to_string()),
                value: Some(category_id),
                timestamp: 2,
            },
        ];

        let report_items = build_report_items(&db, &[], &[], &[], &[], &[], &changed_fields);

        assert!(report_items.iter().any(|item| item.contains("Choir")));
        assert!(report_items.iter().all(|item| !item.contains("category-1")));
    }

    #[test]
    fn category_song_report_ignores_song_id_relation_events() {
        let db = Database::new_in_memory().expect("db");
        db.insert_category(&crate::domain::models::Category {
            id: "category-1".to_string(),
            name: "Choir".to_string(),
            updated_at: now(),
            updated_by: "server-1".to_string(),
        })
        .expect("insert category");

        db.insert_song(
            &Song {
                id: "song-1".to_string(),
                name: "08 H.C. CRISTO, O FIEL AMIGO".to_string(),
                composer: None,
                arranger: None,
                path: "/music/song-1".to_string(),
                is_favorite: false,
                status: ScoreStatus::Main,
                updated_at: now(),
                updated_by: "server-1".to_string(),
            },
            &[],
        )
        .expect("insert song");

        let changed_fields = vec![ChangedFieldRecord {
            id: "rel-event-1".to_string(),
            change_type: "insert".to_string(),
            entity: "categoriesSongs".to_string(),
            entity_id: "relation-1".to_string(),
            field: Some("songId".to_string()),
            value: Some("song-1".to_string()),
            timestamp: 2,
        }];

        let report_items = build_report_items(&db, &[], &[], &[], &[], &[], &changed_fields);

        assert!(report_items.is_empty());
    }
}
