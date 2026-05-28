use std::fs;

use serde::Serialize;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::{ensure_actions_cloud_dir, ensure_cloud_root_dir};
use crate::services::msgpack_zstd::{
    compress_zstd_with_threads, serialize_msgpack_named, write_atomic, ZSTD_LEVEL_BALANCED,
};

const EVENTS_FILE_NAME: &str = "events.msgpack.zst";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EventsFileSummary {
    pub output_path: String,
    pub payload_size: u64,
    pub file_size: u64,
    pub events_count: usize,
}

#[derive(Debug, Serialize)]
struct EventsMessagePack {
    events: Vec<EventMessagePack>,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
struct EventDataMessagePack {
    field: String,
    #[serde(rename = "value", skip_serializing_if = "Option::is_none")]
    value: Option<String>,
}

pub fn generate_events_msgpack(
    db: &Database,
    store: &SystemStore,
) -> Result<EventsFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let changed_fields = db.get_changed_fields_ordered()?;
    let actions_dir = ensure_actions_cloud_dir(store.app_data_dir())?;
    let _cloud_root_dir = ensure_cloud_root_dir(store.app_data_dir())?;

    let mut events = Vec::with_capacity(changed_fields.len());
    for change in changed_fields.iter() {
        let data = change.field.as_ref().map(|field| {
            vec![EventDataMessagePack {
                field: field.clone(),
                value: change.value.clone(),
            }]
        });

        events.push(EventMessagePack {
            id: change.id.clone(),
            timestamp: change.timestamp,
            event_type: change.change_type.clone(),
            entity: change.entity.clone(),
            entity_id: change.entity_id.clone(),
            data,
        });
    }

    let payload = EventsMessagePack { events };

    let output_path = actions_dir.join(EVENTS_FILE_NAME);

    if payload.events.is_empty() {
        if output_path.exists() {
            fs::remove_file(&output_path).map_err(|e| {
                AppError::Generic(format!(
                    "Erro ao remover events.msgpack sem eventos novos: {}",
                    e
                ))
            })?;
        }

        return Ok(EventsFileSummary {
            output_path: output_path.to_string_lossy().to_string(),
            payload_size: 0,
            file_size: 0,
            events_count: 0,
        });
    }

    let msgpack_bytes = serialize_msgpack_named(&payload, "events.msgpack")?;

    let payload_size = msgpack_bytes.len() as u64;

    let compressed_bytes =
        compress_zstd_with_threads(&msgpack_bytes, ZSTD_LEVEL_BALANCED, "events.msgpack")?;

    if output_path.exists() {
        let existing_bytes = fs::read(&output_path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao ler events.msgpack atual para comparação: {}",
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
            AppError::Generic(format!("Erro ao obter metadados de events.msgpack: {}", e))
        })?
        .len();

    Ok(EventsFileSummary {
        output_path: output_path.to_string_lossy().to_string(),
        payload_size,
        file_size,
        events_count: payload.events.len(),
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use rusqlite::params;
    use tempfile::tempdir;

    use crate::domain::models::{Category, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::generate_events_msgpack;
    #[test]
    fn generates_events_msgpack_file() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Servidor".to_string()),
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
            name: "Musica Teste".to_string(),
            composer: None,
            arranger: None,
            path: dir.path().join("songs").join("song-1").to_string_lossy().to_string(),
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
            std::path::Path::new("cloud").join("actions").join("events.msgpack.zst")
        ));
    }

    #[test]
    fn keeps_score_status_events_as_they_are() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Servidor".to_string()),
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
            params!["song-1", "MUSICA TESTE", "/music/song-1"],
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
                "draft",
            ],
        )
        .expect("insert score");

        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-not-found",
                "update",
                "scores",
                "score-1",
                "status",
                "not_found",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert not_found event");

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
                chrono::Local::now().timestamp() + 1,
            ],
        )
        .expect("insert draft event");

        conn.execute(
            "INSERT INTO changedField (id, type, entity, entityId, field, value, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "evt-song-name",
                "update",
                "songs",
                "song-1",
                "name",
                "New Name",
                chrono::Local::now().timestamp() + 2,
            ],
        )
        .expect("insert allowed event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");

        assert_eq!(summary.events_count, 3);

        let raw = fs::read(dir.path().join("cloud").join("actions").join("events.msgpack.zst"))
            .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value = rmp_serde::from_read(&mut decoder).expect("decode msgpack");
        assert!(payload["events"]
            .as_array()
            .expect("events array")
            .iter()
            .any(|event| event["entity"] == "scores" && event["data"][0]["value"] == "draft"));
    }

    #[test]
    fn keeps_draft_status_events_when_no_archive_exists() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Servidor".to_string()),
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
            params!["song-1", "MUSICA TESTE", "/music/song-1"],
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
                "draft",
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
        .expect("insert draft event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");
        assert_eq!(summary.events_count, 1);

        let raw = fs::read(dir.path().join("cloud").join("actions").join("events.msgpack.zst"))
            .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value = rmp_serde::from_read(&mut decoder).expect("decode msgpack");
        assert_eq!(payload["events"][0]["data"][0]["value"], "draft");
    }

    #[test]
    fn deletes_existing_events_file_when_there_are_no_events() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = crate::domain::models::AppSettings {
            computer_id: "server-1".to_string(),
            computer_name: Some("Servidor".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let events_dir = dir.path().join("cloud").join("actions");
        std::fs::create_dir_all(&events_dir).expect("create events dir");
        let events_file = events_dir.join("events.msgpack.zst");
        std::fs::write(&events_file, b"stale").expect("write stale events");

        let conn = db.conn.lock().expect("lock db");
        conn.execute("DELETE FROM changedField", [])
            .expect("clear changed fields");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");

        assert_eq!(summary.events_count, 0);
        assert_eq!(summary.payload_size, 0);
        assert_eq!(summary.file_size, 0);
        assert!(!events_file.exists());
    }
}
