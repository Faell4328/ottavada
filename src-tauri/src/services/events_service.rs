use std::fs;

use serde::Serialize;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::{ensure_actions_cloud_dir, ensure_cloud_root_dir};
use crate::services::backup_songs_service::list_draft_not_found_scores_with_previous_main;
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
    #[serde(rename = "computerId")]
    computer_id: String,
    #[serde(rename = "origin")]
    origin: String,
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
    #[serde(rename = "oldValue", skip_serializing_if = "Option::is_none")]
    old_value: Option<String>,
    #[serde(rename = "newValue", skip_serializing_if = "Option::is_none")]
    new_value: Option<String>,
}

pub fn generate_events_msgpack(
    db: &Database,
    store: &SystemStore,
) -> Result<EventsFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let changed_fields = db.get_changed_fields_ordered()?;
    let actions_dir = ensure_actions_cloud_dir(store.app_data_dir())?;
    let cloud_root_dir = ensure_cloud_root_dir(store.app_data_dir())?;
    let previous_main_versions =
        list_draft_not_found_scores_with_previous_main(db, store.app_data_dir(), &cloud_root_dir)?;

    let mut events = Vec::with_capacity(changed_fields.len());
    for change in changed_fields.iter() {
        let Some(status_override) = normalize_score_status_for_client(change, &previous_main_versions)
        else {
            continue;
        };

        let data = change.field.as_ref().map(|field| {
            vec![EventDataMessagePack {
                field: field.clone(),
                old_value: None,
                new_value: status_override.clone().or_else(|| change.value.clone()),
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

    let origin = settings.computer_type.as_store_str().to_string();

    let payload = EventsMessagePack {
        computer_id: settings.computer_id,
        origin,
        events,
    };

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

fn normalize_score_status_for_client(
    change: &crate::infrastructure::database::ChangedFieldRecord,
    previous_main_versions: &crate::services::backup_songs_service::DraftNotFoundMainVersionSummary,
) -> Option<Option<String>> {
    if change.entity != "scores" || change.field.as_deref() != Some("status") {
        return Some(None);
    }

    if !matches!(change.value.as_deref(), Some("draft") | Some("not_found")) {
        return Some(None);
    }

    if previous_main_versions.without_previous_main.contains(&change.entity_id) {
        // Sem versão main anterior na nuvem, cliente deve ver not_found.
        return Some(Some("not_found".to_string()));
    }

    // Com versão main anterior, o cliente deve continuar vendo main.
    Some(Some("main".to_string()))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::fs::File;

    use rusqlite::params;
    use tar::Builder;
    use tempfile::tempdir;

    use crate::domain::models::{Category, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::generate_events_msgpack;
    use crate::services::backup_songs_service::list_draft_not_found_scores_with_previous_main;

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
    fn skips_not_found_status_events_when_generating_events_file() {
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

        create_tar_zst_with_entry(
            &dir.path().join("cloud").join("songs").join("song-1.tar.zst"),
            "score-1.musx",
            b"v1",
        );

        drop(conn);

        let preserved_versions = list_draft_not_found_scores_with_previous_main(
            &db,
            dir.path(),
            &dir.path().join("cloud"),
        )
        .expect("list preserved versions");
        assert!(preserved_versions.has_previous_main("score-1"));

        let summary = generate_events_msgpack(&db, &store).expect("generate events");

        assert_eq!(summary.events_count, 3);

        let raw = fs::read(dir.path().join("cloud").join("actions").join("events.msgpack.zst"))
            .expect("read events file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: serde_json::Value = rmp_serde::from_read(&mut decoder).expect("decode msgpack");
        assert_eq!(payload["events"][0]["data"][0]["newValue"], "main");
    }

    #[test]
    fn converts_draft_or_not_found_to_not_found_when_no_previous_main_exists() {
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
        assert_eq!(payload["events"][0]["data"][0]["newValue"], "not_found");
    }

    fn create_tar_zst_with_entry(archive_path: &std::path::Path, file_name: &str, content: &[u8]) {
        if let Some(parent) = archive_path.parent() {
            fs::create_dir_all(parent).expect("create archive dir");
        }

        let output = File::create(archive_path).expect("create archive file");
        let encoder = zstd::stream::Encoder::new(output, 5).expect("encoder");
        let mut tar = Builder::new(encoder);

        let mut header = tar::Header::new_gnu();
        header.set_path(file_name).expect("set path");
        header.set_size(content.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();

        tar.append(&header, content).expect("append entry");
        let encoder = tar.into_inner().expect("finish tar");
        encoder.finish().expect("finish zstd");
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
