use std::collections::{HashMap, HashSet};
use std::fs;

use rusqlite::params;
use serde::Serialize;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::domain::models::ScoreStatus;
use crate::infrastructure::database::{ChangedFieldRecord, Database};
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::ensure_actions_cloud_dir;
use crate::services::msgpack_zstd::{
    compress_zstd_with_threads, read_zstd_msgpack, serialize_msgpack_named, write_atomic,
    ZSTD_LEVEL_BALANCED,
};

const EVENTS_FILE_NAME: &str = "events.msgpack.zst";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EventsFileSummary {
    pub output_path: String,
    pub payload_size: u64,
    pub file_size: u64,
    pub events_count: usize,
}

#[derive(Debug, Serialize, serde::Deserialize)]
struct EventsMessagePack {
    events: Vec<EventMessagePack>,
}

#[derive(Debug, Serialize, serde::Deserialize, Clone)]
struct EventMessagePack {
    id: String,
    timestamp: i64,
    #[serde(rename = "type")]
    event_type: String,
    entity: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Vec<EventDataMessagePack>>,
}

#[derive(Debug, Serialize, serde::Deserialize, Clone)]
struct EventDataMessagePack {
    field: String,
    #[serde(rename = "value", skip_serializing_if = "Option::is_none")]
    value: Option<String>,
}

#[derive(Debug)]
struct PlannedEvent {
    sort_index: (usize, usize),
    event: EventMessagePack,
}

#[derive(Debug, Default)]
struct ScoreChangeSummary {
    sort_index: usize,
    timestamp: i64,
    event_id: String,
    change_type: String,
}

#[derive(Debug, Clone)]
struct SongRelationRecord {
    id: String,
    foreign_id: String,
}

pub fn generate_events_msgpack(
    db: &Database,
    store: &SystemStore,
) -> Result<EventsFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let changed_fields = db.get_changed_fields_ordered()?;
    let actions_dir = ensure_actions_cloud_dir(store.app_data_dir())?;
    let output_path = actions_dir.join(EVENTS_FILE_NAME);

    let events = build_events_payload(db, &changed_fields)?;

    if events.is_empty() {
        if !output_path.exists() {
            let payload = EventsMessagePack { events: Vec::new() };
            let msgpack_bytes = serialize_msgpack_named(&payload, "events.msgpack")?;
            let compressed_bytes = compress_zstd_with_threads(
                &msgpack_bytes,
                ZSTD_LEVEL_BALANCED,
                "events.msgpack",
            )?;

            write_atomic(&output_path, &compressed_bytes, "events.msgpack")?;

            let file_size = fs::metadata(&output_path)
                .map_err(|e| {
                    AppError::Generic(format!("Error getting events.msgpack metadata: {}", e))
                })?
                .len();

            return Ok(EventsFileSummary {
                output_path: output_path.to_string_lossy().to_string(),
                payload_size: msgpack_bytes.len() as u64,
                file_size,
                events_count: 0,
            });
        }

        let file_size = fs::metadata(&output_path)
            .map_err(|e| {
                AppError::Generic(format!("Error getting events.msgpack metadata: {}", e))
            })?
            .len();

        return Ok(EventsFileSummary {
            output_path: output_path.to_string_lossy().to_string(),
            payload_size: 0,
            file_size,
            events_count: 0,
        });
    }

    let mut payload = if output_path.exists() {
        read_zstd_msgpack::<EventsMessagePack>(&output_path, "events.msgpack")?
    } else {
        EventsMessagePack { events: Vec::new() }
    };

    payload.events.extend(events);

    let msgpack_bytes = serialize_msgpack_named(&payload, "events.msgpack")?;

    let payload_size = msgpack_bytes.len() as u64;

    let compressed_bytes =
        compress_zstd_with_threads(&msgpack_bytes, ZSTD_LEVEL_BALANCED, "events.msgpack")?;

    if output_path.exists() {
        let existing_bytes = fs::read(&output_path).map_err(|e| {
            AppError::Generic(format!(
                "Error reading current events.msgpack for comparison: {}",
                e
            ))
        })?;

        if existing_bytes == compressed_bytes {
            let file_size = existing_bytes.len() as u64;
            return Ok(EventsFileSummary {
                output_path: output_path.to_string_lossy().to_string(),
                payload_size,
                file_size,
                events_count: payload.events.len(),
            });
        }
    }

    write_atomic(&output_path, &compressed_bytes, "events.msgpack")?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| {
            AppError::Generic(format!("Error getting events.msgpack metadata: {}", e))
        })?
        .len();

    Ok(EventsFileSummary {
        output_path: output_path.to_string_lossy().to_string(),
        payload_size,
        file_size,
        events_count: payload.events.len(),
    })
}

fn build_events_payload(
    db: &Database,
    changed_fields: &[ChangedFieldRecord],
) -> Result<Vec<EventMessagePack>, AppError> {
    let mut planned_events = Vec::<PlannedEvent>::with_capacity(changed_fields.len());
    let mut score_changes: HashMap<String, ScoreChangeSummary> = HashMap::new();
    let mut handled_score_ids: HashSet<String> = HashSet::new();

    for (index, change) in changed_fields.iter().enumerate() {
        if change.entity == "scores" {
            let entry = score_changes
                .entry(change.entity_id.clone())
                .or_insert_with(ScoreChangeSummary::default);

            if change.timestamp > entry.timestamp
                || (change.timestamp == entry.timestamp && index >= entry.sort_index)
            {
                entry.sort_index = index;
                entry.timestamp = change.timestamp;
                entry.event_id = change.id.clone();
                entry.change_type = change.change_type.clone();
            }

            continue;
        }

        if change.entity == "songs" && change.field.as_deref() == Some("status") {
            let song_events = build_song_status_events(db, change)?;

            for (event_index, event) in song_events.iter().enumerate() {
                planned_events.push(PlannedEvent {
                    sort_index: (index, event_index),
                    event: event.clone(),
                });
            }

            if let Ok(scores) = db.get_scores_for_song(&change.entity_id) {
                for score in scores {
                    handled_score_ids.insert(score.id);
                }
            }

            continue;
        }

        planned_events.push(PlannedEvent {
            sort_index: (index, 0),
            event: EventMessagePack {
                id: change.id.clone(),
                timestamp: change.timestamp,
                event_type: change.change_type.clone(),
                entity: change.entity.clone(),
                entity_id: change.entity_id.clone(),
                data: change.field.as_ref().map(|field| {
                    vec![EventDataMessagePack {
                        field: field.clone(),
                        value: change.value.clone(),
                    }]
                }),
            },
        });
    }

    for (score_id, change) in score_changes {
        if handled_score_ids.contains(&score_id) {
            continue;
        }

        let (event_type, data) = build_score_event(db, &score_id, &change.change_type)?;

        planned_events.push(PlannedEvent {
            sort_index: (change.sort_index, 0),
            event: EventMessagePack {
                id: change.event_id,
                timestamp: change.timestamp,
                event_type,
                entity: "scores".to_string(),
                entity_id: score_id,
                data,
            },
        });
    }

    planned_events.sort_by(|left, right| {
        left.sort_index
            .cmp(&right.sort_index)
            .then(left.event.timestamp.cmp(&right.event.timestamp))
            .then(left.event.id.cmp(&right.event.id))
    });

    Ok(planned_events
        .into_iter()
        .map(|planned| planned.event)
        .collect())
}

fn build_song_status_events(
    db: &Database,
    change: &ChangedFieldRecord,
) -> Result<Vec<EventMessagePack>, AppError> {
    let song = db.get_song_by_id(&change.entity_id)?;
    let scores = db.get_scores_for_song(&change.entity_id)?;
    let category_relations = get_song_category_relations(db, &change.entity_id)?;
    let composer_relations = get_song_named_relations(db, &change.entity_id, "composerSongs", "composerId")?;
    let arranger_relations = get_song_named_relations(db, &change.entity_id, "arrangerSongs", "arrangerId")?;

    match song.status {
        ScoreStatus::Main => {
            let mut events = Vec::with_capacity(
                scores.len()
                    + category_relations.len()
                    + composer_relations.len()
                    + arranger_relations.len()
                    + 1,
            );
            events.push(build_song_insert_event(
                change,
                song.name,
                song.composer,
                song.arranger,
            ));

            for relation in category_relations {
                events.push(build_relation_insert_event(
                    change.timestamp,
                    &change.id,
                    "categoriesSongs",
                    &relation.id,
                    &[("categoryId", relation.foreign_id), ("songId", change.entity_id.clone())],
                ));
            }

            for relation in composer_relations {
                events.push(build_relation_insert_event(
                    change.timestamp,
                    &change.id,
                    "composerSongs",
                    &relation.id,
                    &[("composerId", relation.foreign_id), ("songId", change.entity_id.clone())],
                ));
            }

            for relation in arranger_relations {
                events.push(build_relation_insert_event(
                    change.timestamp,
                    &change.id,
                    "arrangerSongs",
                    &relation.id,
                    &[("arrangerId", relation.foreign_id), ("songId", change.entity_id.clone())],
                ));
            }

            for score in scores {
                if score.status == ScoreStatus::Main {
                    events.push(build_score_insert_event(
                        change.timestamp,
                        &change.entity_id,
                        &change.id,
                        &score,
                    ));
                }
            }

            Ok(events)
        }
        ScoreStatus::Draft | ScoreStatus::NotFound | ScoreStatus::Ignored => {
            let mut events = Vec::with_capacity(
                scores.len()
                    + category_relations.len()
                    + composer_relations.len()
                    + arranger_relations.len()
                    + 1,
            );
            for relation in category_relations {
                events.push(build_relation_delete_event(
                    change.timestamp,
                    &change.id,
                    "categoriesSongs",
                    &relation.id,
                ));
            }

            for relation in composer_relations {
                events.push(build_relation_delete_event(
                    change.timestamp,
                    &change.id,
                    "composerSongs",
                    &relation.id,
                ));
            }

            for relation in arranger_relations {
                events.push(build_relation_delete_event(
                    change.timestamp,
                    &change.id,
                    "arrangerSongs",
                    &relation.id,
                ));
            }

            events.push(EventMessagePack {
                id: change.id.clone(),
                timestamp: change.timestamp,
                event_type: "delete".to_string(),
                entity: "songs".to_string(),
                entity_id: change.entity_id.clone(),
                data: None,
            });

            for score in scores {
                events.push(build_score_delete_event(
                    change.timestamp,
                    &change.id,
                    &score.id,
                ));
            }

            Ok(events)
        }
    }
}

fn get_song_category_relations(
    db: &Database,
    song_id: &str,
) -> Result<Vec<SongRelationRecord>, AppError> {
    let conn = db.lock_conn();
    let mut stmt = conn.prepare(
        "SELECT id, categoryId FROM categoriesSongs WHERE songId = ?1 ORDER BY categoryId ASC, id ASC",
    )?;
    let rows = stmt.query_map(params![song_id], |row| {
        Ok(SongRelationRecord {
            id: row.get(0)?,
            foreign_id: row.get(1)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

fn get_song_named_relations(
    db: &Database,
    song_id: &str,
    table_name: &str,
    foreign_key_name: &str,
) -> Result<Vec<SongRelationRecord>, AppError> {
    let conn = db.lock_conn();
    let sql = format!(
        "SELECT id, {} FROM {} WHERE songId = ?1 ORDER BY {} ASC, id ASC",
        foreign_key_name, table_name, foreign_key_name
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![song_id], |row| {
        Ok(SongRelationRecord {
            id: row.get(0)?,
            foreign_id: row.get(1)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

fn build_relation_insert_event(
    timestamp: i64,
    source_event_id: &str,
    entity: &str,
    relation_id: &str,
    fields: &[(&str, String)],
) -> EventMessagePack {
    EventMessagePack {
        id: format!("{}:{}", source_event_id, relation_id),
        timestamp,
        event_type: "insert".to_string(),
        entity: entity.to_string(),
        entity_id: relation_id.to_string(),
        data: Some(
            fields
                .iter()
                .map(|(field, value)| EventDataMessagePack {
                    field: (*field).to_string(),
                    value: Some(value.clone()),
                })
                .collect(),
        ),
    }
}

fn build_relation_delete_event(
    timestamp: i64,
    source_event_id: &str,
    entity: &str,
    relation_id: &str,
) -> EventMessagePack {
    EventMessagePack {
        id: format!("{}:{}", source_event_id, relation_id),
        timestamp,
        event_type: "delete".to_string(),
        entity: entity.to_string(),
        entity_id: relation_id.to_string(),
        data: None,
    }
}

fn build_song_insert_event(
    change: &ChangedFieldRecord,
    song_name: String,
    composer: Option<String>,
    arranger: Option<String>,
) -> EventMessagePack {
    let mut data = Vec::with_capacity(3);
    data.push(EventDataMessagePack {
        field: "name".to_string(),
        value: Some(song_name),
    });

    if let Some(composer) = composer {
        data.push(EventDataMessagePack {
            field: "composer".to_string(),
            value: Some(composer),
        });
    }

    if let Some(arranger) = arranger {
        data.push(EventDataMessagePack {
            field: "arranger".to_string(),
            value: Some(arranger),
        });
    }

    EventMessagePack {
        id: change.id.clone(),
        timestamp: change.timestamp,
        event_type: "insert".to_string(),
        entity: "songs".to_string(),
        entity_id: change.entity_id.clone(),
        data: Some(data),
    }
}

fn build_score_insert_event(
    timestamp: i64,
    song_id: &str,
    source_event_id: &str,
    score: &crate::domain::models::ScoreListItem,
) -> EventMessagePack {
    let mut data = Vec::with_capacity(4);
    data.push(EventDataMessagePack {
        field: "songId".to_string(),
        value: Some(song_id.to_string()),
    });
    data.push(EventDataMessagePack {
        field: "name".to_string(),
        value: score.name.clone(),
    });
    data.push(EventDataMessagePack {
        field: "status".to_string(),
        value: Some("main".to_string()),
    });
    data.push(EventDataMessagePack {
        field: "extension".to_string(),
        value: Some(score.file_extension.trim_start_matches('.').to_string()),
    });

    EventMessagePack {
        id: format!("{}:{}", source_event_id, score.id),
        timestamp,
        event_type: "insert".to_string(),
        entity: "scores".to_string(),
        entity_id: score.id.clone(),
        data: Some(data),
    }
}

fn build_score_delete_event(
    timestamp: i64,
    source_event_id: &str,
    score_id: &str,
) -> EventMessagePack {
    EventMessagePack {
        id: format!("{}:{}", source_event_id, score_id),
        timestamp,
        event_type: "delete".to_string(),
        entity: "scores".to_string(),
        entity_id: score_id.to_string(),
        data: None,
    }
}

fn build_score_event(
    db: &Database,
    score_id: &str,
    change_type: &str,
) -> Result<(String, Option<Vec<EventDataMessagePack>>), AppError> {
    if change_type.eq_ignore_ascii_case("delete") {
        return Ok(("delete".to_string(), None));
    }

    let song_id = match db.get_song_id_for_score(score_id) {
        Ok(song_id) => song_id,
        Err(_) => return Ok(("delete".to_string(), None)),
    };

    let scores = db.get_scores_for_song(&song_id)?;
    let Some(score) = scores.into_iter().find(|score| score.id == score_id) else {
        return Ok(("delete".to_string(), None));
    };

    if score.status != ScoreStatus::Main {
        return Ok(("delete".to_string(), None));
    }

    let mut data = Vec::with_capacity(4);
    data.push(EventDataMessagePack {
        field: "songId".to_string(),
        value: Some(song_id),
    });
    data.push(EventDataMessagePack {
        field: "name".to_string(),
        value: score.name.clone(),
    });
    data.push(EventDataMessagePack {
        field: "status".to_string(),
        value: Some("main".to_string()),
    });
    data.push(EventDataMessagePack {
        field: "extension".to_string(),
        value: Some(score.file_extension.trim_start_matches('.').to_string()),
    });

    Ok(("insert".to_string(), Some(data)))
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::fs;

    use serde::Serialize;
    use rusqlite::params;
    use tempfile::tempdir;

    use crate::domain::models::ScoreStatus;
    use crate::domain::models::{Category, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;
    use crate::services::msgpack_zstd::{compress_zstd_with_threads, serialize_msgpack_named, write_atomic, ZSTD_LEVEL_BALANCED};

    use super::{EventDataMessagePack, EventMessagePack, EventsMessagePack, generate_events_msgpack};

    fn write_zstd_msgpack<T: Serialize>(path: &Path, payload: &T) {
        let serialized = serialize_msgpack_named(payload, "events test payload").expect("serialize payload");
        let compressed = compress_zstd_with_threads(&serialized, ZSTD_LEVEL_BALANCED, "events test payload")
            .expect("compress payload");
        write_atomic(path, &compressed, "events test payload").expect("write payload");
    }

    #[test]
    fn generates_events_msgpack_file() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let category = Category {
            id: "cat-1".to_string(),
            name: "Teste".to_string(),
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_category(&category).expect("insert category");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: None,
            arranger: None,
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: crate::domain::models::ScoreStatus::Main,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_song(&song, &[category.id.clone()])
            .expect("insert song");

        let summary = generate_events_msgpack(&db, &store).expect("generate events");

        assert!(summary.events_count > 0);
        assert!(summary.file_size > 0);
        assert!(std::path::Path::new(&summary.output_path).ends_with(
            std::path::Path::new("cloud")
                .join("actions")
                .join("events.msgpack.zst")
        ));
    }

    #[test]
    fn translates_main_score_status_into_insert_event() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");

        conn.execute(
            "INSERT INTO songs (id, name, composer, arranger, path, is_favorite, last_score_file_modified_at)
             VALUES (?1, ?2, NULL, NULL, ?3, 0, 0)",
            params!["song-1", "TEST MUSIC", "/music/song-1"],
        )
        .expect("insert song");

        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), ?9)",
            params![
                "score-1",
                "song-1",
                "flauta",
                "server",
                "/tmp",
                "score-1.musx",
                "musx",
                0,
                "main",
            ],
        )
        .expect("insert score");

        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-draft",
                "update",
                "scores",
                "score-1",
                "status",
                "draft",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert main status event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 1);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file (insert relation)");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");
        assert_eq!(payload["events"][0]["type"], "insert");
        assert_eq!(payload["events"][0]["entity"], "scores");
        assert_eq!(payload["events"][0]["data"][0]["field"], "songId");
        assert_eq!(payload["events"][0]["data"][0]["value"], "song-1");
        assert_eq!(payload["events"][0]["data"][2]["field"], "status");
        assert_eq!(payload["events"][0]["data"][2]["value"], "main");
    }

    #[test]
    fn translates_song_status_draft_into_delete_event() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: None,
            arranger: None,
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: ScoreStatus::Draft,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-draft-song",
                "update",
                "songs",
                "song-1",
                "status",
                "draft",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert draft song event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 2);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"][0]["type"], "delete");
        assert_eq!(payload["events"][0]["entity"], "categoriesSongs");
        assert!(payload["events"][0]["data"].is_null());
    }

    #[test]
    fn generates_delete_event_when_song_is_updated_to_draft() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
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
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        drop(conn);

        db.update_song_status_for_song("song-1", ScoreStatus::Draft, "server-1")
            .expect("update song status");

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 2);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"][0]["type"], "delete");
        assert_eq!(payload["events"][0]["entity"], "categoriesSongs");
    }

    #[test]
    fn translates_song_status_not_found_into_delete_event() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: None,
            arranger: None,
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: ScoreStatus::NotFound,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), ?9)",
            params![
                "score-1",
                "song-1",
                Some("Flauta".to_string()),
                "server-1",
                dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
                "flauta.musx",
                "musx",
                0,
                "main",
            ],
        )
        .expect("insert score");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-not-found-song",
                "update",
                "songs",
                "song-1",
                "status",
                "not_found",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert not_found song event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 3);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"][0]["type"], "delete");
        assert_eq!(payload["events"][0]["entity"], "categoriesSongs");
        assert_eq!(payload["events"][1]["type"], "delete");
        assert_eq!(payload["events"][1]["entity"], "songs");
    }

    #[test]
    fn generates_insert_event_when_song_is_restored_to_main() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: None,
            arranger: None,
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: ScoreStatus::Draft,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), ?9)",
            params![
                "score-1",
                "song-1",
                Some("Flauta".to_string()),
                "server-1",
                dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
                "flauta.musx",
                "musx",
                0,
                "main",
            ],
        )
        .expect("insert score");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        drop(conn);

        db.update_song_status_for_song("song-1", ScoreStatus::Main, "server-1")
            .expect("update song status");

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 3);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"][0]["type"], "insert");
        assert_eq!(payload["events"][0]["entity"], "songs");
        assert_eq!(payload["events"][0]["entityId"], "song-1");
        assert_eq!(payload["events"][0]["data"][0]["field"], "name");
        assert_eq!(payload["events"][0]["data"][0]["value"], "Test Music");
        assert_eq!(payload["events"][1]["type"], "insert");
        assert_eq!(payload["events"][1]["entity"], "categoriesSongs");
    }

    #[test]
    fn translates_song_status_main_into_relation_insert_events() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: Some("Composer".to_string()),
            arranger: Some("Arranger".to_string()),
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: ScoreStatus::Main,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };

        let conn = db.conn.lock().expect("lock db");
        conn.execute("INSERT INTO categories (id, name) VALUES (?1, ?2)", params!["cat-1", "Choir"])
            .expect("insert category");
        conn.execute("INSERT INTO composer (id, name) VALUES (?1, ?2)", params!["composer-1", "Composer"])
            .expect("insert composer");
        conn.execute("INSERT INTO arranger (id, name) VALUES (?1, ?2)", params!["arranger-1", "Arranger"])
            .expect("insert arranger");
        drop(conn);

        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("INSERT INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)", params!["rel-cat-1", "cat-1", "song-1"])
            .expect("insert category relation");
        conn.execute("INSERT INTO composerSongs (id, composerId, songId) VALUES (?1, ?2, ?3)", params!["rel-composer-1", "composer-1", "song-1"])
            .expect("insert composer relation");
        conn.execute("INSERT INTO arrangerSongs (id, arrangerId, songId) VALUES (?1, ?2, ?3)", params!["rel-arranger-1", "arranger-1", "song-1"])
            .expect("insert arranger relation");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-main",
                "update",
                "songs",
                "song-1",
                "status",
                "main",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert main status event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 5);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"][1]["entity"], "categoriesSongs");
    }

    #[test]
    fn translates_song_status_draft_into_relation_delete_events() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: Some("Composer".to_string()),
            arranger: Some("Arranger".to_string()),
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: ScoreStatus::Draft,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };

        let conn = db.conn.lock().expect("lock db");
        conn.execute("INSERT INTO categories (id, name) VALUES (?1, ?2)", params!["cat-1", "Choir"])
            .expect("insert category");
        conn.execute("INSERT INTO composer (id, name) VALUES (?1, ?2)", params!["composer-1", "Composer"])
            .expect("insert composer");
        conn.execute("INSERT INTO arranger (id, name) VALUES (?1, ?2)", params!["arranger-1", "Arranger"])
            .expect("insert arranger");
        drop(conn);

        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("INSERT INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)", params!["rel-cat-1", "cat-1", "song-1"])
            .expect("insert category relation");
        conn.execute("INSERT INTO composerSongs (id, composerId, songId) VALUES (?1, ?2, ?3)", params!["rel-composer-1", "composer-1", "song-1"])
            .expect("insert composer relation");
        conn.execute("INSERT INTO arrangerSongs (id, arrangerId, songId) VALUES (?1, ?2, ?3)", params!["rel-arranger-1", "arranger-1", "song-1"])
            .expect("insert arranger relation");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-draft",
                "update",
                "songs",
                "song-1",
                "status",
                "draft",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert draft status event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 5);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"][0]["entity"], "categoriesSongs");
        assert_eq!(payload["events"][1]["entity"], "categoriesSongs");
        assert_eq!(payload["events"][2]["entity"], "composerSongs");
    }

    #[test]
    fn appends_new_events_without_dropping_existing_history() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let events_dir = dir.path().join("cloud").join("actions");
        std::fs::create_dir_all(&events_dir).expect("create events dir");

        let existing_payload = EventsMessagePack {
            events: vec![EventMessagePack {
                id: "evt-old".to_string(),
                timestamp: 10,
                event_type: "insert".to_string(),
                entity: "songs".to_string(),
                entity_id: "song-1".to_string(),
                data: Some(vec![EventDataMessagePack {
                    field: "name".to_string(),
                    value: Some("Old Music".to_string()),
                }]),
            }],
        };
        write_zstd_msgpack(&events_dir.join("events.msgpack.zst"), &existing_payload);

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: None,
            arranger: None,
            path: dir
                .path()
                .join("songs")
                .join("song-1")
                .to_string_lossy()
                .to_string(),
            is_favorite: false,
            status: ScoreStatus::Draft,
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        };
        db.insert_song(&song, &[]).expect("insert song");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-new",
                "update",
                "songs",
                "song-1",
                "status",
                "draft",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert draft event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 3);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("events.msgpack.zst"),
        )
        .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value =
            rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(payload["events"].as_array().expect("events array").len(), 3);
        assert_eq!(payload["events"][0]["id"], "evt-old");
        assert_eq!(payload["events"][1]["type"], "delete");
        assert_eq!(payload["events"][1]["entity"], "categoriesSongs");
    }

    #[test]
    fn keeps_existing_events_file_when_there_are_no_events() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let events_dir = dir.path().join("cloud").join("actions");
        std::fs::create_dir_all(&events_dir).expect("create events dir");
        let events_file = events_dir.join("events.msgpack.zst");
        std::fs::write(&events_file, b"stale").expect("write stale events");
        let before = std::fs::read(&events_file).expect("read stale events before");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");

        assert_eq!(summary.events_count, 0);
        assert_eq!(summary.payload_size, 0);
        assert!(events_file.exists());
        assert_eq!(std::fs::read(&events_file).expect("read stale events after"), before);
    }
}
