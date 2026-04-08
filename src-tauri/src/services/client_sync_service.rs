use std::collections::HashMap;
use std::fs;

use rusqlite::{params, OptionalExtension};
use serde::Deserialize;

use crate::domain::errors::AppError;
use crate::domain::models::ComputerType;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::msgpack_zstd::read_zstd_msgpack;

const CLOUD_DIR_NAME: &str = "cloud";
const LEGACY_CLOUD_DIR_NAME: &str = "nuvem";
const EVENTS_DIR_NAME: &str = "events";
const EVENTS_FILE_NAME: &str = "events.msgpack.zst";
const SNAPSHOT_FILE_NAME: &str = "snapshot.msgpack.zst";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClientSyncSummary {
    pub snapshot_applied: bool,
    pub events_applied: usize,
    pub last_snapshot_timestamp: i64,
    pub last_change_timestamp: i64,
}

#[derive(Debug, Deserialize)]
struct SnapshotMessagePack {
    #[serde(rename = "generatedAt")]
    generated_at: i64,
    categories: Vec<SnapshotCategory>,
    songs: Vec<SnapshotSong>,
}

#[derive(Debug, Deserialize)]
struct SnapshotCategory {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct SnapshotSong {
    id: String,
    name: String,
    composer: Option<String>,
    arranger: Option<String>,
    #[serde(rename = "categoriesId")]
    categories_id: Vec<String>,
    scores: Vec<SnapshotScore>,
}

#[derive(Debug, Deserialize)]
struct SnapshotScore {
    id: String,
    name: Option<String>,
    #[serde(default)]
    extension: Option<String>,
    status: String,
    #[serde(rename = "updatedAt")]
    updated_at: i64,
}

#[derive(Debug, Deserialize)]
struct EventsMessagePack {
    #[serde(rename = "origin")]
    origin: String,
    events: Vec<EventMessagePack>,
}

#[derive(Debug, Deserialize)]
struct EventMessagePack {
    timestamp: i64,
    #[serde(rename = "type")]
    event_type: String,
    entity: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    data: Option<Vec<EventDataMessagePack>>,
}

#[derive(Debug, Deserialize)]
struct EventDataMessagePack {
    field: String,
    #[serde(rename = "oldValue")]
    old_value: Option<String>,
    #[serde(rename = "newValue")]
    new_value: Option<String>,
}

#[derive(Default)]
struct PendingCategorySong {
    category_id: Option<String>,
    song_id: Option<String>,
}

#[derive(Default)]
struct PendingScore {
    name: Option<String>,
    status: Option<String>,
    extension: Option<String>,
}

pub fn apply_server_changes_for_client(
    db: &Database,
    store: &SystemStore,
) -> Result<ClientSyncSummary, AppError> {
    let mut settings = store.get_app_settings()?;
    if settings.computer_type != ComputerType::Client {
        return Err(AppError::Generic(
            "Sincronização de alterações do servidor disponível apenas para cliente".to_string(),
        ));
    }

    let cloud_dir = resolve_cloud_dir(store.app_data_dir())?;
    let snapshot_path = cloud_dir.join(SNAPSHOT_FILE_NAME);
    let events_path = cloud_dir.join(EVENTS_DIR_NAME).join(EVENTS_FILE_NAME);

    let mut snapshot_applied = false;

    if snapshot_path.exists() {
        let snapshot_payload: SnapshotMessagePack =
            read_zstd_msgpack(&snapshot_path, "snapshot.msgpack")?;
        let known_snapshot_timestamp = settings.last_snapshot_timestamp.unwrap_or(0);
        let known_change_timestamp = settings.last_change_timestamp.unwrap_or(0);

        let should_apply_snapshot = snapshot_payload.generated_at > known_snapshot_timestamp
            || known_change_timestamp < snapshot_payload.generated_at;

        if should_apply_snapshot {
            apply_snapshot(db, &snapshot_payload)?;
            settings.last_snapshot_timestamp = Some(snapshot_payload.generated_at);
            snapshot_applied = true;

            // Evita reaplicar eventos antigos em caso de reset por snapshot.
            settings.last_change_timestamp =
                Some(known_change_timestamp.max(snapshot_payload.generated_at));
        }
    }

    let mut events_applied = 0usize;

    if events_path.exists() {
        let events_payload: EventsMessagePack =
            read_zstd_msgpack(&events_path, "events.msgpack")?;
        if events_payload.origin != "server" {
            return Err(AppError::Generic(format!(
                "Arquivo de eventos inválido para cliente: origin='{}'",
                events_payload.origin
            )));
        }

        let known_change_timestamp = settings.last_change_timestamp.unwrap_or(0);

        let fresh_events = events_payload
            .events
            .into_iter()
            .filter(|event| event.timestamp > known_change_timestamp)
            .collect::<Vec<_>>();

        if !fresh_events.is_empty() {
            events_applied = fresh_events.len();
            let max_timestamp = fresh_events
                .iter()
                .map(|event| event.timestamp)
                .max()
                .unwrap_or(known_change_timestamp);

            apply_events(db, &fresh_events)?;
            settings.last_change_timestamp = Some(max_timestamp);
        }
    }

    store.save_app_settings(&settings)?;

    Ok(ClientSyncSummary {
        snapshot_applied,
        events_applied,
        last_snapshot_timestamp: settings.last_snapshot_timestamp.unwrap_or(0),
        last_change_timestamp: settings.last_change_timestamp.unwrap_or(0),
    })
}

fn apply_snapshot(db: &Database, payload: &SnapshotMessagePack) -> Result<(), AppError> {
    {
        let mut conn = db.conn.lock().unwrap();
        let tx = conn.transaction()?;

        tx.execute_batch(
            "
            DELETE FROM changedField;
            DELETE FROM backupSongs;
            DELETE FROM categoriesSongs;
            DELETE FROM scores;
            DELETE FROM songs;
            DELETE FROM categories;
        ",
        )?;

        for category in &payload.categories {
            tx.execute(
                "INSERT INTO categories (id, name) VALUES (?1, ?2)",
                params![category.id, category.name],
            )?;
        }

        for song in &payload.songs {
            let last_score_file_modified_at = song
                .scores
                .iter()
                .map(|score| score.updated_at)
                .max()
                .unwrap_or(payload.generated_at);

            tx.execute(
                "INSERT INTO songs (id, name, composer, arranger, is_favorite, last_score_file_modified_at)
                 VALUES (?1, ?2, ?3, ?4, 0, ?5)",
                params![
                    song.id,
                    song.name,
                    song.composer,
                    song.arranger,
                    last_score_file_modified_at,
                ],
            )?;

            for category_id in &song.categories_id {
                tx.execute(
                    "INSERT OR IGNORE INTO categoriesSongs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                    params![uuid::Uuid::new_v4().to_string(), category_id, song.id],
                )?;
            }

            for score in &song.scores {
                let file_extension = normalize_extension(score.extension.as_deref())
                    .unwrap_or_else(|| "score".to_string());

                tx.execute(
                    "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_size, file_modified_at, status)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, datetime(?7, 'unixepoch'), ?8)",
                    params![
                        score.id,
                        song.id,
                        score.name,
                        "server",
                        format!("/cloud/songs/{}", song.id),
                        format!("{}.{}", score.id, file_extension),
                        score.updated_at,
                        score.status,
                    ],
                )?;
            }
        }

        tx.commit()?;
    }

    db.ensure_default_category()?;
    Ok(())
}

fn apply_events(db: &Database, events: &[EventMessagePack]) -> Result<(), AppError> {
    let mut conn = db.conn.lock().unwrap();
    let tx = conn.transaction()?;

    let mut pending_category_songs: HashMap<String, PendingCategorySong> = HashMap::new();
    let mut pending_scores: HashMap<String, PendingScore> = HashMap::new();

    for event in events {
        apply_event(&tx, event, &mut pending_category_songs, &mut pending_scores)?;
    }

    tx.commit()?;
    Ok(())
}

fn apply_event(
    tx: &rusqlite::Transaction<'_>,
    event: &EventMessagePack,
    pending_category_songs: &mut HashMap<String, PendingCategorySong>,
    pending_scores: &mut HashMap<String, PendingScore>,
) -> Result<(), AppError> {
    if event.event_type == "delete" {
        return apply_delete_event(tx, event, pending_category_songs, pending_scores);
    }

    let data_items = match &event.data {
        Some(data) if !data.is_empty() => data,
        _ => return Ok(()),
    };

    for item in data_items {
        apply_upsert_field_event(tx, event, item, pending_category_songs, pending_scores)?;
    }

    Ok(())
}

fn apply_delete_event(
    tx: &rusqlite::Transaction<'_>,
    event: &EventMessagePack,
    pending_category_songs: &mut HashMap<String, PendingCategorySong>,
    pending_scores: &mut HashMap<String, PendingScore>,
) -> Result<(), AppError> {
    match event.entity.as_str() {
        "songs" => {
            tx.execute("DELETE FROM songs WHERE id = ?1", params![event.entity_id])?;
        }
        "scores" => {
            tx.execute("DELETE FROM scores WHERE id = ?1", params![event.entity_id])?;
            pending_scores.remove(&event.entity_id);
        }
        "categories" => {
            tx.execute(
                "DELETE FROM categories WHERE id = ?1",
                params![event.entity_id],
            )?;
        }
        "categoriesSongs" => {
            let affected = tx.execute(
                "DELETE FROM categoriesSongs WHERE id = ?1",
                params![event.entity_id],
            )?;

            if affected == 0 {
                // Compatibilidade com eventos legados que removem apenas por categoryId.
                if let Some(data_items) = &event.data {
                    for item in data_items {
                        if item.field == "categoryId" {
                            if let Some(category_id) = item.old_value.as_ref().or(item.new_value.as_ref()) {
                                tx.execute(
                                    "DELETE FROM categoriesSongs WHERE category_id = ?1",
                                    params![category_id],
                                )?;
                            }
                        }
                    }
                }
            }

            pending_category_songs.remove(&event.entity_id);
        }
        _ => {}
    }

    Ok(())
}

fn apply_upsert_field_event(
    tx: &rusqlite::Transaction<'_>,
    event: &EventMessagePack,
    item: &EventDataMessagePack,
    pending_category_songs: &mut HashMap<String, PendingCategorySong>,
    pending_scores: &mut HashMap<String, PendingScore>,
) -> Result<(), AppError> {
    match event.entity.as_str() {
        "songs" => {
            ensure_song_exists(tx, &event.entity_id, event.timestamp)?;

            match item.field.as_str() {
                "name" => {
                    tx.execute(
                        "UPDATE songs SET name = COALESCE(?1, name) WHERE id = ?2",
                        params![item.new_value.clone(), event.entity_id],
                    )?;
                }
                "composer" => {
                    tx.execute(
                        "UPDATE songs SET composer = ?1 WHERE id = ?2",
                        params![item.new_value.clone(), event.entity_id],
                    )?;
                }
                "arranger" => {
                    tx.execute(
                        "UPDATE songs SET arranger = ?1 WHERE id = ?2",
                        params![item.new_value.clone(), event.entity_id],
                    )?;
                }
                _ => {}
            }
        }
        "categories" => {
            if item.field == "name" {
                let name = item.new_value.clone().unwrap_or_default();
                tx.execute(
                    "INSERT INTO categories (id, name) VALUES (?1, ?2)
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name",
                    params![event.entity_id, name],
                )?;
            }
        }
        "scores" => match item.field.as_str() {
            "songId" => {
                let song_id = item.new_value.clone().ok_or_else(|| {
                    AppError::Generic("Evento de score sem songId".to_string())
                })?;

                ensure_song_exists(tx, &song_id, event.timestamp)?;
                ensure_score_exists(tx, &event.entity_id, &song_id, event.timestamp)?;

                tx.execute(
                    "UPDATE scores SET song_id = ?1, file_path = ?2 WHERE id = ?3",
                    params![song_id, format!("/cloud/songs/{}", song_id), event.entity_id],
                )?;

                if let Some(pending) = pending_scores.remove(&event.entity_id) {
                    if let Some(name) = pending.name {
                        tx.execute(
                            "UPDATE scores SET name = ?1 WHERE id = ?2",
                            params![name, event.entity_id],
                        )?;
                    }

                    if let Some(status) = pending.status {
                        tx.execute(
                            "UPDATE scores SET status = ?1 WHERE id = ?2",
                            params![status, event.entity_id],
                        )?;
                    }

                    if let Some(extension) = pending.extension {
                        tx.execute(
                            "UPDATE scores SET file_name = ?1 WHERE id = ?2",
                            params![format!("{}.{}", event.entity_id, extension), event.entity_id],
                        )?;
                    }
                }
            }
            "name" => {
                if score_exists(tx, &event.entity_id)? {
                    tx.execute(
                        "UPDATE scores SET name = ?1 WHERE id = ?2",
                        params![item.new_value.clone(), event.entity_id],
                    )?;
                } else {
                    let pending = pending_scores
                        .entry(event.entity_id.clone())
                        .or_default();
                    pending.name = item.new_value.clone();
                }
            }
            "status" => {
                if score_exists(tx, &event.entity_id)? {
                    tx.execute(
                        "UPDATE scores SET status = COALESCE(?1, status) WHERE id = ?2",
                        params![item.new_value.clone(), event.entity_id],
                    )?;
                } else {
                    let pending = pending_scores
                        .entry(event.entity_id.clone())
                        .or_default();
                    pending.status = item.new_value.clone();
                }
            }
            "extension" => {
                let Some(extension) = normalize_extension(item.new_value.as_deref()) else {
                    return Ok(());
                };

                if score_exists(tx, &event.entity_id)? {
                    tx.execute(
                        "UPDATE scores SET file_name = ?1 WHERE id = ?2",
                        params![format!("{}.{}", event.entity_id, extension), event.entity_id],
                    )?;
                } else {
                    let pending = pending_scores
                        .entry(event.entity_id.clone())
                        .or_default();
                    pending.extension = Some(extension);
                }
            }
            // "file" é evento sem payload detalhado no design atual.
            "file" => {}
            _ => {}
        },
        "categoriesSongs" => {
            let entry = pending_category_songs
                .entry(event.entity_id.clone())
                .or_default();

            if item.field == "categoryId" {
                entry.category_id = item.new_value.clone();
            }
            if item.field == "songId" {
                entry.song_id = item.new_value.clone();
            }

            if let (Some(category_id), Some(song_id)) =
                (entry.category_id.clone(), entry.song_id.clone())
            {
                ensure_category_exists(tx, &category_id)?;
                ensure_song_exists(tx, &song_id, event.timestamp)?;

                tx.execute(
                    "INSERT OR IGNORE INTO categoriesSongs (id, category_id, song_id) VALUES (?1, ?2, ?3)",
                    params![event.entity_id, category_id, song_id],
                )?;
            }
        }
        _ => {}
    }

    Ok(())
}

fn ensure_song_exists(
    tx: &rusqlite::Transaction<'_>,
    song_id: &str,
    timestamp: i64,
) -> Result<(), AppError> {
    tx.execute(
        "INSERT OR IGNORE INTO songs (id, name, composer, arranger, is_favorite, last_score_file_modified_at)
         VALUES (?1, '', NULL, NULL, 0, ?2)",
        params![song_id, timestamp],
    )?;
    Ok(())
}

fn ensure_category_exists(tx: &rusqlite::Transaction<'_>, category_id: &str) -> Result<(), AppError> {
    tx.execute(
        "INSERT OR IGNORE INTO categories (id, name) VALUES (?1, ?2)",
        params![category_id, format!("Categoria {}", category_id)],
    )?;
    Ok(())
}

fn ensure_score_exists(
    tx: &rusqlite::Transaction<'_>,
    score_id: &str,
    song_id: &str,
    timestamp: i64,
) -> Result<(), AppError> {
    tx.execute(
        "INSERT OR IGNORE INTO scores (id, song_id, name, host_id, file_path, file_name, file_size, file_modified_at, status)
         VALUES (?1, ?2, NULL, 'server', ?3, ?4, 0, datetime(?5, 'unixepoch'), 'main')",
        params![
            score_id,
            song_id,
            format!("/cloud/songs/{}", song_id),
            format!("{}.score", score_id),
            timestamp,
        ],
    )?;
    Ok(())
}

fn normalize_extension(raw_extension: Option<&str>) -> Option<String> {
    raw_extension
        .map(str::trim)
        .map(|value| value.trim_start_matches('.'))
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase())
}

fn score_exists(tx: &rusqlite::Transaction<'_>, score_id: &str) -> Result<bool, AppError> {
    let exists = tx
        .query_row(
            "SELECT 1 FROM scores WHERE id = ?1 LIMIT 1",
            params![score_id],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    Ok(exists)
}

fn resolve_cloud_dir(app_data_dir: &std::path::Path) -> Result<std::path::PathBuf, AppError> {
    let cloud_dir = app_data_dir.join(CLOUD_DIR_NAME);
    let legacy_dir = app_data_dir.join(LEGACY_CLOUD_DIR_NAME);

    if cloud_dir.exists() {
        return Ok(cloud_dir);
    }

    if legacy_dir.exists() {
        fs::rename(&legacy_dir, &cloud_dir).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao migrar diretório legado '{}' para '{}': {}",
                legacy_dir.display(),
                cloud_dir.display(),
                e
            ))
        })?;
    }

    fs::create_dir_all(&cloud_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao criar diretório cloud: {}", e)))?;

    Ok(cloud_dir)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::domain::models::{AppSettings, ComputerType};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::apply_server_changes_for_client;

    #[derive(serde::Serialize)]
    struct SnapshotTestPayload {
        #[serde(rename = "generatedAt")]
        generated_at: i64,
        categories: Vec<SnapshotCategoryTestPayload>,
        songs: Vec<SnapshotSongTestPayload>,
    }

    #[derive(serde::Serialize)]
    struct SnapshotCategoryTestPayload {
        id: String,
        name: String,
    }

    #[derive(serde::Serialize)]
    struct SnapshotSongTestPayload {
        id: String,
        name: String,
        composer: Option<String>,
        arranger: Option<String>,
        #[serde(rename = "categoriesId")]
        categories_id: Vec<String>,
        scores: Vec<SnapshotScoreTestPayload>,
    }

    #[derive(serde::Serialize)]
    struct SnapshotScoreTestPayload {
        id: String,
        name: Option<String>,
        extension: Option<String>,
        status: String,
        #[serde(rename = "updatedAt")]
        updated_at: i64,
    }

    #[derive(serde::Serialize)]
    struct EventsTestPayload {
        origin: String,
        events: Vec<EventTestPayload>,
    }

    #[derive(serde::Serialize)]
    struct EventTestPayload {
        id: String,
        timestamp: i64,
        #[serde(rename = "type")]
        event_type: String,
        entity: String,
        #[serde(rename = "entityId")]
        entity_id: String,
        data: Option<Vec<EventDataTestPayload>>,
    }

    #[derive(serde::Serialize)]
    struct EventDataTestPayload {
        field: String,
        #[serde(rename = "oldValue")]
        old_value: Option<String>,
        #[serde(rename = "newValue")]
        new_value: Option<String>,
    }

    #[test]
    fn applies_snapshot_and_new_events_for_client() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "client-1".to_string(),
            computer_name: Some("Cliente".to_string()),
            computer_type: ComputerType::Client,
            first_run_completed: true,
            last_snapshot_timestamp: Some(0),
            last_change_timestamp: Some(0),
            ..Default::default()
        };

        store.save_app_settings(&settings).expect("save settings");

        let cloud_dir = dir.path().join("cloud");
        std::fs::create_dir_all(cloud_dir.join("events")).expect("create dirs");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 100,
            categories: vec![SnapshotCategoryTestPayload {
                id: "cat-1".to_string(),
                name: "Harpa".to_string(),
            }],
            songs: vec![SnapshotSongTestPayload {
                id: "song-1".to_string(),
                name: "Musica 1".to_string(),
                composer: None,
                arranger: None,
                categories_id: vec!["cat-1".to_string()],
                scores: vec![SnapshotScoreTestPayload {
                    id: "score-1".to_string(),
                    name: Some("Flauta".to_string()),
                    extension: Some("musx".to_string()),
                    status: "main".to_string(),
                    updated_at: 100,
                }],
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("snapshot.msgpack.zst"),
            &snapshot_payload,
        );

        let events_payload = EventsTestPayload {
            origin: "server".to_string(),
            events: vec![EventTestPayload {
                id: "evt-1".to_string(),
                timestamp: 120,
                event_type: "update".to_string(),
                entity: "songs".to_string(),
                entity_id: "song-1".to_string(),
                data: Some(vec![EventDataTestPayload {
                    field: "name".to_string(),
                    old_value: Some("Musica 1".to_string()),
                    new_value: Some("Musica 1 Atualizada".to_string()),
                }]),
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("events").join("events.msgpack.zst"),
            &events_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");

        assert!(summary.snapshot_applied);
        assert_eq!(summary.events_applied, 1);
        assert_eq!(summary.last_snapshot_timestamp, 100);
        assert_eq!(summary.last_change_timestamp, 120);

        let songs = db.get_all_songs().expect("get songs");
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].name, "Musica 1 Atualizada");
        assert_eq!(songs[0].scores.len(), 1);
        assert_eq!(songs[0].scores[0].file_extension, "musx");

        let categories = db.get_all_categories().expect("get categories");
        assert_eq!(categories.len(), 2);
        assert!(categories.iter().any(|category| category.name == "Harpa"));
        assert!(categories
            .iter()
            .any(|category| category.name == "Sem categoria"));
    }

    #[test]
    fn applies_score_events_out_of_order_without_creating_unknown_songs() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "client-2".to_string(),
            computer_name: Some("Cliente".to_string()),
            computer_type: ComputerType::Client,
            first_run_completed: true,
            last_snapshot_timestamp: Some(0),
            last_change_timestamp: Some(0),
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let cloud_dir = dir.path().join("cloud");
        std::fs::create_dir_all(cloud_dir.join("events")).expect("create dirs");

        let events_payload = EventsTestPayload {
            origin: "server".to_string(),
            events: vec![
                EventTestPayload {
                    id: "e1".to_string(),
                    timestamp: 100,
                    event_type: "insert".to_string(),
                    entity: "scores".to_string(),
                    entity_id: "score-10".to_string(),
                    data: Some(vec![EventDataTestPayload {
                        field: "name".to_string(),
                        old_value: None,
                        new_value: Some("Tuba".to_string()),
                    }]),
                },
                EventTestPayload {
                    id: "e2".to_string(),
                    timestamp: 100,
                    event_type: "insert".to_string(),
                    entity: "scores".to_string(),
                    entity_id: "score-10".to_string(),
                    data: Some(vec![EventDataTestPayload {
                        field: "status".to_string(),
                        old_value: None,
                        new_value: Some("main".to_string()),
                    }]),
                },
                EventTestPayload {
                    id: "e2-1".to_string(),
                    timestamp: 100,
                    event_type: "insert".to_string(),
                    entity: "scores".to_string(),
                    entity_id: "score-10".to_string(),
                    data: Some(vec![EventDataTestPayload {
                        field: "extension".to_string(),
                        old_value: None,
                        new_value: Some("pdf".to_string()),
                    }]),
                },
                EventTestPayload {
                    id: "e3".to_string(),
                    timestamp: 100,
                    event_type: "insert".to_string(),
                    entity: "songs".to_string(),
                    entity_id: "song-10".to_string(),
                    data: Some(vec![EventDataTestPayload {
                        field: "name".to_string(),
                        old_value: None,
                        new_value: Some("Buscai".to_string()),
                    }]),
                },
                EventTestPayload {
                    id: "e4".to_string(),
                    timestamp: 100,
                    event_type: "insert".to_string(),
                    entity: "scores".to_string(),
                    entity_id: "score-10".to_string(),
                    data: Some(vec![EventDataTestPayload {
                        field: "songId".to_string(),
                        old_value: None,
                        new_value: Some("song-10".to_string()),
                    }]),
                },
            ],
        };

        write_zstd_msgpack(
            &cloud_dir.join("events").join("events.msgpack.zst"),
            &events_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");
        assert!(!summary.snapshot_applied);
        assert_eq!(summary.events_applied, 5);

        let songs = db.get_all_songs().expect("get songs");
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].id, "song-10");
        assert_eq!(songs[0].name, "Buscai");
        assert_eq!(songs[0].scores.len(), 1);
        assert_eq!(songs[0].scores[0].id, "score-10");
        assert_eq!(songs[0].scores[0].name.as_deref(), Some("Tuba"));
        assert_eq!(songs[0].scores[0].file_extension, "pdf");
    }

    #[test]
    fn reapplies_snapshot_when_client_is_outdated_even_with_same_snapshot_timestamp() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "client-3".to_string(),
            computer_name: Some("Cliente".to_string()),
            computer_type: ComputerType::Client,
            first_run_completed: true,
            last_snapshot_timestamp: Some(100),
            last_change_timestamp: Some(10),
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let cloud_dir = dir.path().join("cloud");
        std::fs::create_dir_all(cloud_dir.join("events")).expect("create dirs");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 100,
            categories: vec![SnapshotCategoryTestPayload {
                id: "cat-1".to_string(),
                name: "Harpa".to_string(),
            }],
            songs: vec![SnapshotSongTestPayload {
                id: "song-1".to_string(),
                name: "Musica do Snapshot".to_string(),
                composer: None,
                arranger: None,
                categories_id: vec!["cat-1".to_string()],
                scores: vec![],
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("snapshot.msgpack.zst"),
            &snapshot_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");

        assert!(summary.snapshot_applied);
        assert_eq!(summary.last_snapshot_timestamp, 100);
        assert_eq!(summary.last_change_timestamp, 100);

        let songs = db.get_all_songs().expect("get songs");
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].name, "Musica do Snapshot");
    }

    fn write_zstd_msgpack<T: serde::Serialize>(path: &std::path::Path, payload: &T) {
        let bytes = rmp_serde::to_vec_named(payload).expect("serialize msgpack");
        let compressed = zstd::stream::encode_all(bytes.as_slice(), 3).expect("zstd encode");
        std::fs::write(path, compressed).expect("write file");
    }
}
