use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;

const CLOUD_DIR_NAME: &str = "cloud";
const EVENTS_DIR_NAME: &str = "events";
const EVENTS_FILE_NAME: &str = "events.msgpack.zst";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EventsFileSummary {
    pub output_path: String,
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

    let events = changed_fields
        .iter()
        .filter(|change| !is_not_found_status_change(change))
        .map(|change| {
            let data = change.field.as_ref().map(|field| {
                vec![EventDataMessagePack {
                    field: field.clone(),
                    old_value: change.old_value.clone(),
                    new_value: change.new_value.clone(),
                }]
            });

            EventMessagePack {
                id: change.id.clone(),
                timestamp: change.timestamp,
                event_type: change.change_type.clone(),
                entity: change.entity.clone(),
                entity_id: change.entity_id.clone(),
                data,
            }
        })
        .collect::<Vec<_>>();

    let origin = settings.computer_type.as_store_str().to_string();

    let payload = EventsMessagePack {
        computer_id: settings.computer_id,
        origin,
        events,
    };

    let msgpack_bytes = rmp_serde::to_vec_named(&payload)
        .map_err(|e| AppError::Generic(format!("Erro ao serializar events.msgpack: {}", e)))?;

    let compressed_bytes = compress_events_payload(&msgpack_bytes)?;

    let events_dir = store
        .app_data_dir()
        .join(CLOUD_DIR_NAME)
        .join(EVENTS_DIR_NAME);
    fs::create_dir_all(&events_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao criar diretório de eventos: {}", e)))?;

    let output_path = events_dir.join(EVENTS_FILE_NAME);
    let temp_path = temp_path_for(&output_path);

    fs::write(&temp_path, &compressed_bytes).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever arquivo temporário de eventos: {}",
            e
        ))
    })?;
    fs::rename(&temp_path, &output_path)
        .map_err(|e| AppError::Generic(format!("Erro ao finalizar events.msgpack: {}", e)))?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| {
            AppError::Generic(format!("Erro ao obter metadados de events.msgpack: {}", e))
        })?
        .len();

    Ok(EventsFileSummary {
        output_path: output_path.to_string_lossy().to_string(),
        file_size,
        events_count: payload.events.len(),
    })
}

fn is_not_found_status_change(change: &crate::infrastructure::database::ChangedFieldRecord) -> bool {
    change.entity == "scores"
        && change.field.as_deref() == Some("status")
        && matches!(change.new_value.as_deref(), Some("not_found") | Some("draft"))
}

fn temp_path_for(path: &PathBuf) -> PathBuf {
    let mut temp = path.clone();
    temp.set_extension("zst.tmp");
    temp
}

fn compress_events_payload(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let level = 10;
    let mut encoder = zstd::stream::Encoder::new(Vec::new(), level).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao iniciar compressão zstd de events.msgpack: {}",
            e
        ))
    })?;

    let worker_count = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1);

    encoder.multithread(worker_count as u32).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao configurar multithread da compressão zstd de events.msgpack: {}",
            e
        ))
    })?;

    std::io::Write::write_all(&mut encoder, data).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever payload de events.msgpack no zstd: {}",
            e
        ))
    })?;

    encoder.finish().map_err(|e| {
        AppError::Generic(format!(
            "Erro ao finalizar compressão zstd de events.msgpack: {}",
            e
        ))
    })
}

#[cfg(test)]
mod tests {
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
        assert!(summary
            .output_path
            .ends_with("/cloud/events/events.msgpack.zst"));
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
            "INSERT INTO changedField (id, origin, type, entity, entityId, field, oldValue, newValue, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                "evt-not-found",
                "server",
                "update",
                "scores",
                "score-1",
                "status",
                "main",
                "not_found",
                chrono::Local::now().timestamp(),
            ],
        )
        .expect("insert not_found event");

        conn.execute(
            "INSERT INTO changedField (id, origin, type, entity, entityId, field, oldValue, newValue, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                "evt-draft",
                "server",
                "update",
                "scores",
                "score-1",
                "status",
                "main",
                "draft",
                chrono::Local::now().timestamp() + 1,
            ],
        )
        .expect("insert draft event");

        conn.execute(
            "INSERT INTO changedField (id, origin, type, entity, entityId, field, oldValue, newValue, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                "evt-song-name",
                "server",
                "update",
                "songs",
                "song-1",
                "name",
                "Old Name",
                "New Name",
                chrono::Local::now().timestamp() + 2,
            ],
        )
        .expect("insert allowed event");
        drop(conn);

        let summary = generate_events_msgpack(&db, &store).expect("generate events");

        assert_eq!(summary.events_count, 1);
    }
}
