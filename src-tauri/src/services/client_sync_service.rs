use std::collections::HashMap;
use std::fs;
use std::path::Path;

use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use tracing::warn;

use crate::domain::errors::AppError;
use crate::domain::models::ComputerType;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::msgpack_zstd::read_zstd_msgpack;

const CLOUD_DIR_NAME: &str = "cloud";
const LEGACY_CLOUD_DIR_NAME: &str = "nuvem";
const EVENTS_FILE_NAME: &str = "events.msgpack.zst";
const SNAPSHOT_FILE_NAME: &str = "snapshot.msgpack.zst";
const ACTIONS_DIR_NAME: &str = "actions";

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
    #[serde(default)]
    categories: Vec<SnapshotCategory>,
    #[serde(default, rename = "categoriesSongs")]
    categories_songs: Vec<SnapshotCategorySong>,
    #[serde(default)]
    composers: Vec<SnapshotNamedEntity>,
    #[serde(default, rename = "composerSongs")]
    composer_songs: Vec<SnapshotNamedRelation>,
    #[serde(default)]
    arrangers: Vec<SnapshotNamedEntity>,
    #[serde(default, rename = "arrangerSongs")]
    arranger_songs: Vec<SnapshotNamedRelation>,
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
    #[serde(default)]
    composer: Option<String>,
    #[serde(default)]
    arranger: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default, rename = "categoriesId")]
    categories_id: Vec<String>,
    #[serde(default)]
    scores: Vec<SnapshotScore>,
}

#[derive(Debug, Deserialize)]
struct SnapshotScore {
    id: String,
    #[serde(rename = "songId", default)]
    song_id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(rename = "fileExtension", alias = "extension", default)]
    file_extension: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(rename = "updatedAt", default)]
    updated_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct SnapshotCategorySong {
    id: String,
    #[serde(rename = "categoryId")]
    category_id: String,
    #[serde(rename = "songId")]
    song_id: String,
}

#[derive(Debug, Deserialize)]
struct SnapshotNamedEntity {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct SnapshotNamedRelation {
    id: String,
    #[serde(rename = "composerId", default)]
    composer_id: Option<String>,
    #[serde(rename = "arrangerId", default)]
    arranger_id: Option<String>,
    #[serde(rename = "songId")]
    song_id: String,
}

#[derive(Debug, Deserialize)]
struct EventsMessagePack {
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
    #[serde(rename = "value", alias = "oldValue", alias = "newValue")]
    value: Option<String>,
}

#[derive(Default)]
struct PendingCategorySong {
    category_id: Option<String>,
    song_id: Option<String>,
}

#[derive(Default)]
struct PendingNamedRelation {
    relation_id: Option<String>,
    foreign_id: Option<String>,
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
            "Server change synchronization available only for client".to_string(),
        ));
    }

    let cloud_dir = resolve_cloud_dir(store.app_data_dir())?;
    let actions_dir = cloud_dir.join(ACTIONS_DIR_NAME);
    let snapshot_path = actions_dir.join(SNAPSHOT_FILE_NAME);
    let events_path = actions_dir.join(EVENTS_FILE_NAME);

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

            // Avoids reapplying old events when a snapshot reset happens.
            settings.last_change_timestamp =
                Some(known_change_timestamp.max(snapshot_payload.generated_at));
        }
    }

    let mut events_applied = 0usize;

    if events_path.exists() {
        let events_payload: EventsMessagePack = read_zstd_msgpack(&events_path, "events.msgpack")?;

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

pub fn has_pending_server_changes(db: &Database, store: &SystemStore) -> Result<bool, AppError> {
    let settings = store.get_app_settings()?;
    let last_snapshot_timestamp = settings.last_snapshot_timestamp.unwrap_or(0);
    let last_change_timestamp = settings.last_change_timestamp.unwrap_or(0);

    let latest_change = db.get_latest_changed_field_timestamp()?.unwrap_or(0);
    if latest_change > last_change_timestamp {
        return Ok(true);
    }

    let actions_dir = resolve_cloud_dir(store.app_data_dir())?.join(ACTIONS_DIR_NAME);

    match read_snapshot_generated_at(&actions_dir.join(SNAPSHOT_FILE_NAME)) {
        Ok(Some(snapshot_generated_at)) if snapshot_generated_at > last_snapshot_timestamp => {
            return Ok(true);
        }
        Ok(_) => {}
        Err(err) => {
            warn!(
                "Failed to read local snapshot to validate changes: {}",
                err
            );
            return Ok(true);
        }
    }

    match read_events_last_timestamp(&actions_dir.join(EVENTS_FILE_NAME)) {
        Ok(Some(events_last_timestamp)) if events_last_timestamp > last_change_timestamp => {
            return Ok(true);
        }
        Ok(_) => {}
        Err(err) => {
            warn!("Failed to read local events to validate changes: {}", err);
            return Ok(true);
        }
    }

    Ok(false)
}

fn apply_snapshot(db: &Database, payload: &SnapshotMessagePack) -> Result<(), AppError> {
    {
        let mut conn = db.lock_conn();
        let tx = conn.transaction()?;

        let composer_name_by_id: HashMap<String, String> = payload
            .composers
            .iter()
            .map(|entity| (entity.id.clone(), entity.name.clone()))
            .collect();
        let arranger_name_by_id: HashMap<String, String> = payload
            .arrangers
            .iter()
            .map(|entity| (entity.id.clone(), entity.name.clone()))
            .collect();

        let mut composer_name_by_song_id: HashMap<String, String> = HashMap::new();
        for relation in &payload.composer_songs {
            if let Some(composer_id) = relation.composer_id.as_ref() {
                if let Some(name) = composer_name_by_id.get(composer_id) {
                    composer_name_by_song_id.insert(relation.song_id.clone(), name.clone());
                }
            }
        }

        let mut arranger_name_by_song_id: HashMap<String, String> = HashMap::new();
        for relation in &payload.arranger_songs {
            if let Some(arranger_id) = relation.arranger_id.as_ref() {
                if let Some(name) = arranger_name_by_id.get(arranger_id) {
                    arranger_name_by_song_id.insert(relation.song_id.clone(), name.clone());
                }
            }
        }

        tx.execute_batch(
            "
            DELETE FROM changedField;
            DELETE FROM songsBackup;
            DELETE FROM composerSongs;
            DELETE FROM arrangerSongs;
            DELETE FROM categoriesSongs;
            DELETE FROM scores;
            DELETE FROM songs;
            DELETE FROM composer;
            DELETE FROM arranger;
            DELETE FROM categories;
        ",
        )?;

        for category in &payload.categories {
            tx.execute(
                "INSERT INTO categories (id, name) VALUES (?1, ?2)",
                params![category.id, category.name],
            )?;
        }

        for composer in &payload.composers {
            tx.execute(
                "INSERT INTO composer (id, name) VALUES (?1, ?2)",
                params![composer.id, composer.name],
            )?;
        }

        for arranger in &payload.arrangers {
            tx.execute(
                "INSERT INTO arranger (id, name) VALUES (?1, ?2)",
                params![arranger.id, arranger.name],
            )?;
        }

        for song in &payload.songs {
            let last_score_file_modified_at = song
                .scores
                .iter()
                .filter_map(|score| score.updated_at)
                .max()
                .unwrap_or(payload.generated_at);
            let song_path = if song
                .path
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .is_some()
            {
                song.path.clone().unwrap()
            } else {
                song_stored_path(&song.id)
            };

            let composer_name = composer_name_by_song_id.get(&song.id).cloned().or_else(|| {
                song.composer
                    .as_ref()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty())
            });
            let arranger_name = arranger_name_by_song_id.get(&song.id).cloned().or_else(|| {
                song.arranger
                    .as_ref()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty())
            });

            tx.execute(
                "INSERT INTO songs (id, name, composer, arranger, path, is_favorite, last_score_file_modified_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
                params![
                    song.id,
                    song.name,
                    composer_name,
                    arranger_name,
                    song_path,
                    last_score_file_modified_at,
                ],
            )?;

            let snapshot_category_relations: Vec<&SnapshotCategorySong> = payload
                .categories_songs
                .iter()
                .filter(|relation| relation.song_id == song.id)
                .collect();

            if snapshot_category_relations.is_empty() {
                for category_id in &song.categories_id {
                    tx.execute(
                        "INSERT OR IGNORE INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                        params![uuid::Uuid::new_v4().to_string(), category_id, song.id],
                    )?;
                }
            } else {
                for relation in snapshot_category_relations {
                    tx.execute(
                        "INSERT OR IGNORE INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                        params![relation.id.clone(), relation.category_id.clone(), song.id],
                    )?;
                }
            }

            for score in &song.scores {
                let score_song_id = score.song_id.as_ref().unwrap_or(&song.id);
                let file_extension = normalize_extension(score.file_extension.as_deref())
                    .unwrap_or_else(|| "score".to_string());
                let score_status = score.status.clone().unwrap_or_else(|| "main".to_string());
                let score_updated_at = score.updated_at.unwrap_or(payload.generated_at);

                tx.execute(
                    "INSERT INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, datetime(?8, 'unixepoch'), ?9)",
                    params![
                        score.id,
                        score_song_id,
                        score.name,
                        "server",
                        cloud_score_stored_path(score_song_id),
                        score_stored_file_name(&score.id, &file_extension),
                        file_extension,
                        score_updated_at,
                        score_status,
                    ],
                )?;
            }
        }

        for relation in &payload.composer_songs {
            if let Some(composer_id) = relation.composer_id.as_ref() {
                tx.execute(
                    "INSERT INTO composerSongs (id, composerId, songId) VALUES (?1, ?2, ?3)",
                    params![relation.id, composer_id, relation.song_id],
                )?;
            }
        }

        for relation in &payload.arranger_songs {
            if let Some(arranger_id) = relation.arranger_id.as_ref() {
                tx.execute(
                    "INSERT INTO arrangerSongs (id, arrangerId, songId) VALUES (?1, ?2, ?3)",
                    params![relation.id, arranger_id, relation.song_id],
                )?;
            }
        }

        tx.commit()?;
    }

    db.ensure_default_category()?;
    Ok(())
}

fn apply_events(db: &Database, events: &[EventMessagePack]) -> Result<(), AppError> {
    let mut conn = db.lock_conn();
    let tx = conn.transaction()?;

    let mut pending_category_songs: HashMap<String, PendingCategorySong> = HashMap::new();
    let mut pending_composer_songs: HashMap<String, PendingNamedRelation> = HashMap::new();
    let mut pending_arranger_songs: HashMap<String, PendingNamedRelation> = HashMap::new();
    let mut pending_scores: HashMap<String, PendingScore> = HashMap::new();

    for event in events {
        apply_event(
            &tx,
            event,
            &mut pending_category_songs,
            &mut pending_composer_songs,
            &mut pending_arranger_songs,
            &mut pending_scores,
        )?;
    }

    tx.commit()?;
    Ok(())
}

fn apply_event(
    tx: &rusqlite::Transaction<'_>,
    event: &EventMessagePack,
    pending_category_songs: &mut HashMap<String, PendingCategorySong>,
    pending_composer_songs: &mut HashMap<String, PendingNamedRelation>,
    pending_arranger_songs: &mut HashMap<String, PendingNamedRelation>,
    pending_scores: &mut HashMap<String, PendingScore>,
) -> Result<(), AppError> {
    if event.event_type == "delete" {
        return apply_delete_event(
            tx,
            event,
            pending_category_songs,
            pending_composer_songs,
            pending_arranger_songs,
            pending_scores,
        );
    }

    let data_items = match &event.data {
        Some(data) if !data.is_empty() => data,
        _ => return Ok(()),
    };

    for item in data_items {
        apply_upsert_field_event(
            tx,
            event,
            item,
            pending_category_songs,
            pending_composer_songs,
            pending_arranger_songs,
            pending_scores,
        )?;
    }

    Ok(())
}

fn apply_delete_event(
    tx: &rusqlite::Transaction<'_>,
    event: &EventMessagePack,
    pending_category_songs: &mut HashMap<String, PendingCategorySong>,
    pending_composer_songs: &mut HashMap<String, PendingNamedRelation>,
    pending_arranger_songs: &mut HashMap<String, PendingNamedRelation>,
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
                            if let Some(category_id) = item.value.as_ref() {
                                tx.execute(
                                    "DELETE FROM categoriesSongs WHERE categoryId = ?1",
                                    params![category_id],
                                )?;
                            }
                        }
                    }
                }
            }

            pending_category_songs.remove(&event.entity_id);
        }
        "composerSongs" => {
            tx.execute(
                "DELETE FROM composerSongs WHERE id = ?1",
                params![event.entity_id],
            )?;
            pending_composer_songs.remove(&event.entity_id);
        }
        "arrangerSongs" => {
            tx.execute(
                "DELETE FROM arrangerSongs WHERE id = ?1",
                params![event.entity_id],
            )?;
            pending_arranger_songs.remove(&event.entity_id);
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
    pending_composer_songs: &mut HashMap<String, PendingNamedRelation>,
    pending_arranger_songs: &mut HashMap<String, PendingNamedRelation>,
    pending_scores: &mut HashMap<String, PendingScore>,
) -> Result<(), AppError> {
    match event.entity.as_str() {
        "songs" => {
            ensure_song_exists(tx, &event.entity_id, event.timestamp)?;

            match item.field.as_str() {
                "name" => {
                    tx.execute(
                        "UPDATE songs SET name = COALESCE(?1, name) WHERE id = ?2",
                        params![item.value.clone(), event.entity_id],
                    )?;
                }
                "composer" => {
                    tx.execute(
                        "UPDATE songs SET composer = ?1 WHERE id = ?2",
                        params![item.value.clone(), event.entity_id],
                    )?;
                }
                "arranger" => {
                    tx.execute(
                        "UPDATE songs SET arranger = ?1 WHERE id = ?2",
                        params![item.value.clone(), event.entity_id],
                    )?;
                }
                _ => {}
            }
        }
        "categories" => {
            if item.field == "name" {
                let name = item.value.clone().unwrap_or_default();
                tx.execute(
                    "INSERT INTO categories (id, name) VALUES (?1, ?2)
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name",
                    params![event.entity_id, name],
                )?;
            }
        }
        "scores" => match item.field.as_str() {
            "songId" => {
                let song_id = item
                    .value
                    .clone()
                    .ok_or_else(|| AppError::Generic("Score event without songId".to_string()))?;

                ensure_song_exists(tx, &song_id, event.timestamp)?;
                ensure_score_exists(tx, &event.entity_id, &song_id, event.timestamp)?;

                tx.execute(
                    "UPDATE scores SET song_id = ?1, file_path = ?2 WHERE id = ?3",
                    params![
                        song_id,
                        cloud_score_stored_path(&song_id),
                        event.entity_id
                    ],
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
                            params![
                                format!("{}.{}", event.entity_id, extension),
                                event.entity_id
                            ],
                        )?;
                    }
                }
            }
            "name" => {
                if score_exists(tx, &event.entity_id)? {
                    tx.execute(
                        "UPDATE scores SET name = ?1 WHERE id = ?2",
                        params![item.value.clone(), event.entity_id],
                    )?;
                } else {
                    let pending = pending_scores.entry(event.entity_id.clone()).or_default();
                    pending.name = item.value.clone();
                }
            }
            "status" => {
                if score_exists(tx, &event.entity_id)? {
                    tx.execute(
                        "UPDATE scores SET status = COALESCE(?1, status) WHERE id = ?2",
                        params![item.value.clone(), event.entity_id],
                    )?;
                } else {
                    let pending = pending_scores.entry(event.entity_id.clone()).or_default();
                    pending.status = item.value.clone();
                }
            }
            "extension" => {
                let Some(extension) = normalize_extension(item.value.as_deref()) else {
                    return Ok(());
                };

                if score_exists(tx, &event.entity_id)? {
                    tx.execute(
                        "UPDATE scores SET file_name = ?1 WHERE id = ?2",
                        params![
                            score_stored_file_name(&event.entity_id, &extension),
                            event.entity_id
                        ],
                    )?;
                } else {
                    let pending = pending_scores.entry(event.entity_id.clone()).or_default();
                    pending.extension = Some(extension);
                }
            }
            // "file" is an event without detailed payload in the current design.
            "file" => {}
            _ => {}
        },
        "categoriesSongs" => {
            let entry = pending_category_songs
                .entry(event.entity_id.clone())
                .or_default();

            if item.field == "categoryId" {
                entry.category_id = item.value.clone();
            }
            if item.field == "songId" {
                entry.song_id = item.value.clone();
            }

            if let (Some(category_id), Some(song_id)) =
                (entry.category_id.clone(), entry.song_id.clone())
            {
                ensure_category_exists(tx, &category_id)?;
                ensure_song_exists(tx, &song_id, event.timestamp)?;

                tx.execute(
                    "INSERT OR IGNORE INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
                    params![event.entity_id, category_id, song_id],
                )?;
            }
        }
        "composerSongs" => {
            let entry = pending_composer_songs
                .entry(event.entity_id.clone())
                .or_default();

            if item.field == "composerId" {
                entry.foreign_id = item.value.clone();
            }
            if item.field == "songId" {
                entry.song_id = item.value.clone();
            }

            if let (Some(composer_id), Some(song_id)) = (entry.foreign_id.clone(), entry.song_id.clone()) {
                ensure_song_exists(tx, &song_id, event.timestamp)?;
                tx.execute(
                    "INSERT OR IGNORE INTO composerSongs (id, composerId, songId) VALUES (?1, ?2, ?3)",
                    params![event.entity_id, composer_id, song_id],
                )?;
            }
        }
        "arrangerSongs" => {
            let entry = pending_arranger_songs
                .entry(event.entity_id.clone())
                .or_default();

            if item.field == "arrangerId" {
                entry.foreign_id = item.value.clone();
            }
            if item.field == "songId" {
                entry.song_id = item.value.clone();
            }

            if let (Some(arranger_id), Some(song_id)) = (entry.foreign_id.clone(), entry.song_id.clone()) {
                ensure_song_exists(tx, &song_id, event.timestamp)?;
                tx.execute(
                    "INSERT OR IGNORE INTO arrangerSongs (id, arrangerId, songId) VALUES (?1, ?2, ?3)",
                    params![event.entity_id, arranger_id, song_id],
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
        "INSERT OR IGNORE INTO songs (id, name, composer, arranger, path, is_favorite, last_score_file_modified_at)
         VALUES (?1, '', NULL, NULL, ?3, 0, ?2)",
        params![song_id, timestamp, song_stored_path(song_id)],
    )?;
    Ok(())
}

fn ensure_category_exists(
    tx: &rusqlite::Transaction<'_>,
    category_id: &str,
) -> Result<(), AppError> {
    tx.execute(
        "INSERT OR IGNORE INTO categories (id, name) VALUES (?1, ?2)",
        params![category_id, category_fallback_name(category_id)],
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
        "INSERT OR IGNORE INTO scores (id, song_id, name, host_id, file_path, file_name, file_extension, file_size, file_modified_at, status)
         VALUES (?1, ?2, NULL, 'server', ?3, ?4, ?5, 0, datetime(?6, 'unixepoch'), 'main')",
        params![
            score_id,
            song_id,
            cloud_score_stored_path(song_id),
            score_stored_file_name(score_id, "score"),
            "score",
            timestamp,
        ],
    )?;
    Ok(())
}

fn cloud_score_stored_path(song_id: &str) -> String {
    format!("/cloud/songs/{}", song_id)
}

fn score_stored_file_name(score_id: &str, extension: &str) -> String {
    format!("{}.{}", score_id, extension)
}

fn song_stored_path(song_id: &str) -> String {
    format!("/songs/{}", song_id)
}

fn category_fallback_name(category_id: &str) -> String {
    format!("Category {}", category_id)
}

fn normalize_extension(raw_extension: Option<&str>) -> Option<String> {
    raw_extension
        .map(str::trim)
        .map(|value| value.trim_start_matches('.'))
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase())
}

fn read_snapshot_generated_at(path: &Path) -> Result<Option<i64>, AppError> {
    if !path.exists() {
        return Ok(None);
    }

    let snapshot_payload: SnapshotMessagePack = read_zstd_msgpack(path, "snapshot.msgpack")?;
    Ok(Some(snapshot_payload.generated_at))
}

fn read_events_last_timestamp(path: &Path) -> Result<Option<i64>, AppError> {
    if !path.exists() {
        return Ok(None);
    }

    let events_payload: EventsMessagePack = read_zstd_msgpack(path, "events.msgpack")?;
    Ok(events_payload
        .events
        .into_iter()
        .map(|event| event.timestamp)
        .max())
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
                "Error migrating legacy directory '{}' to '{}': {}",
                legacy_dir.display(),
                cloud_dir.display(),
                e
            ))
        })?;
    }

    fs::create_dir_all(&cloud_dir)
        .map_err(|e| AppError::Generic(format!("Error creating cloud directory: {}", e)))?;

    Ok(cloud_dir)
}

#[cfg(test)]
mod tests {
    use rusqlite::params;
    use tempfile::tempdir;

    use crate::domain::models::{AppSettings, ComputerType};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::{apply_server_changes_for_client, has_pending_server_changes};

    #[derive(serde::Serialize)]
    struct SnapshotTestPayload {
        #[serde(rename = "generatedAt")]
        generated_at: i64,
        categories: Vec<SnapshotCategoryTestPayload>,
        #[serde(rename = "categoriesSongs")]
        categories_songs: Vec<SnapshotCategorySongTestPayload>,
        composers: Vec<SnapshotNamedEntityTestPayload>,
        #[serde(rename = "composerSongs")]
        composer_songs: Vec<SnapshotNamedRelationTestPayload>,
        arrangers: Vec<SnapshotNamedEntityTestPayload>,
        #[serde(rename = "arrangerSongs")]
        arranger_songs: Vec<SnapshotNamedRelationTestPayload>,
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
        scores: Vec<SnapshotScoreTestPayload>,
    }

    #[derive(serde::Serialize)]
    struct SnapshotScoreTestPayload {
        id: String,
        #[serde(rename = "songId")]
        song_id: String,
        name: Option<String>,
        #[serde(rename = "fileExtension")]
        file_extension: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<String>,
    }

    #[derive(serde::Serialize)]
    struct SnapshotCategorySongTestPayload {
        id: String,
        #[serde(rename = "categoryId")]
        category_id: String,
        #[serde(rename = "songId")]
        song_id: String,
    }

    #[derive(serde::Serialize)]
    struct SnapshotNamedEntityTestPayload {
        id: String,
        name: String,
    }

    #[derive(serde::Serialize)]
    struct SnapshotNamedRelationTestPayload {
        id: String,
        #[serde(rename = "composerId", skip_serializing_if = "Option::is_none")]
        composer_id: Option<String>,
        #[serde(rename = "arrangerId", skip_serializing_if = "Option::is_none")]
        arranger_id: Option<String>,
        #[serde(rename = "songId")]
        song_id: String,
    }

    #[derive(serde::Serialize)]
    struct EventsTestPayload {
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
        value: Option<String>,
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
        std::fs::create_dir_all(cloud_dir.join("actions")).expect("create dirs");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 100,
            categories: vec![SnapshotCategoryTestPayload {
                id: "cat-1".to_string(),
                name: "Harpa".to_string(),
            }],
            categories_songs: vec![SnapshotCategorySongTestPayload {
                id: "cat-song-1".to_string(),
                category_id: "cat-1".to_string(),
                song_id: "song-1".to_string(),
            }],
            composers: Vec::new(),
            composer_songs: Vec::new(),
            arrangers: Vec::new(),
            arranger_songs: Vec::new(),
            songs: vec![SnapshotSongTestPayload {
                id: "song-1".to_string(),
                name: "Music 1".to_string(),
                scores: vec![SnapshotScoreTestPayload {
                    id: "score-1".to_string(),
                    song_id: "song-1".to_string(),
                    name: Some("Flauta".to_string()),
                    file_extension: ".musx".to_string(),
                    status: None,
                }],
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("snapshot.msgpack.zst"),
            &snapshot_payload,
        );

        let events_payload = EventsTestPayload {
            events: vec![EventTestPayload {
                id: "evt-1".to_string(),
                timestamp: 120,
                event_type: "update".to_string(),
                entity: "songs".to_string(),
                entity_id: "song-1".to_string(),
                data: Some(vec![EventDataTestPayload {
                    field: "name".to_string(),
                    value: Some("Updated Music 1".to_string()),
                }]),
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("events.msgpack.zst"),
            &events_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");

        assert!(summary.snapshot_applied);
        assert_eq!(summary.events_applied, 1);
        assert_eq!(summary.last_snapshot_timestamp, 100);
        assert_eq!(summary.last_change_timestamp, 120);

        let songs = db.get_all_songs().expect("get songs");
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].name, "Updated Music 1");
        assert_eq!(songs[0].scores.len(), 1);
        assert_eq!(songs[0].scores[0].file_extension, "musx");
        assert_eq!(songs[0].category_ids, vec!["cat-1".to_string()]);

        let categories = db.get_all_categories().expect("get categories");
        assert_eq!(categories.len(), 2);
        assert!(categories.iter().any(|category| category.name == "Harpa"));
        assert!(categories
            .iter()
            .any(|category| category.name == "Uncategorized"));
    }

    #[test]
    fn applies_composer_and_arranger_relation_events() {
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
        std::fs::create_dir_all(cloud_dir.join("actions")).expect("create dirs");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 100,
            categories: Vec::new(),
            categories_songs: Vec::new(),
            composers: vec![SnapshotNamedEntityTestPayload {
                id: "composer-1".to_string(),
                name: "Composer".to_string(),
            }],
            composer_songs: Vec::new(),
            arrangers: vec![SnapshotNamedEntityTestPayload {
                id: "arranger-1".to_string(),
                name: "Arranger".to_string(),
            }],
            arranger_songs: Vec::new(),
            songs: vec![SnapshotSongTestPayload {
                id: "song-1".to_string(),
                name: "Music 1".to_string(),
                scores: Vec::new(),
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("snapshot.msgpack.zst"),
            &snapshot_payload,
        );

        let events_payload = EventsTestPayload {
            events: vec![
                EventTestPayload {
                    id: "evt-1".to_string(),
                    timestamp: 120,
                    event_type: "insert".to_string(),
                    entity: "composerSongs".to_string(),
                    entity_id: "composer-relation-1".to_string(),
                    data: Some(vec![
                        EventDataTestPayload {
                            field: "composerId".to_string(),
                            value: Some("composer-1".to_string()),
                        },
                        EventDataTestPayload {
                            field: "songId".to_string(),
                            value: Some("song-1".to_string()),
                        },
                    ]),
                },
                EventTestPayload {
                    id: "evt-2".to_string(),
                    timestamp: 121,
                    event_type: "insert".to_string(),
                    entity: "arrangerSongs".to_string(),
                    entity_id: "arranger-relation-1".to_string(),
                    data: Some(vec![
                        EventDataTestPayload {
                            field: "arrangerId".to_string(),
                            value: Some("arranger-1".to_string()),
                        },
                        EventDataTestPayload {
                            field: "songId".to_string(),
                            value: Some("song-1".to_string()),
                        },
                    ]),
                },
            ],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("events.msgpack.zst"),
            &events_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");

        assert!(summary.snapshot_applied);
        assert_eq!(summary.events_applied, 2);

        let conn = db.conn.lock().expect("lock db");
        let composer_relations: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM composerSongs WHERE id = ?1",
                params!["composer-relation-1"],
                |row| row.get(0),
            )
            .expect("count composer relations");
        let arranger_relations: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM arrangerSongs WHERE id = ?1",
                params!["arranger-relation-1"],
                |row| row.get(0),
            )
            .expect("count arranger relations");

        assert_eq!(composer_relations, 1);
        assert_eq!(arranger_relations, 1);
    }

    #[test]
    fn removes_category_relations_when_snapshot_no_longer_contains_them() {
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

        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "INSERT INTO categories (id, name) VALUES (?1, ?2)",
            params!["cat-1", "Harpa"],
        )
        .expect("insert category");
        conn.execute(
            "INSERT INTO songs (id, name, composer, arranger, path, is_favorite, last_score_file_modified_at)
             VALUES (?1, ?2, NULL, NULL, ?3, 0, 0)",
            params!["song-1", "Music 1", "/songs/song-1"],
        )
        .expect("insert song");
        conn.execute(
            "INSERT INTO categoriesSongs (id, categoryId, songId) VALUES (?1, ?2, ?3)",
            params!["cat-song-1", "cat-1", "song-1"],
        )
        .expect("insert category relation");
        drop(conn);

        let cloud_dir = dir.path().join("cloud");
        std::fs::create_dir_all(cloud_dir.join("actions")).expect("create dirs");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 100,
            categories: vec![SnapshotCategoryTestPayload {
                id: "cat-1".to_string(),
                name: "Harpa".to_string(),
            }],
            categories_songs: vec![],
            composers: Vec::new(),
            composer_songs: Vec::new(),
            arrangers: Vec::new(),
            arranger_songs: Vec::new(),
            songs: vec![SnapshotSongTestPayload {
                id: "song-1".to_string(),
                name: "Music 1".to_string(),
                scores: vec![],
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("snapshot.msgpack.zst"),
            &snapshot_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");

        assert!(summary.snapshot_applied);

        let song = db.get_song_list_item_by_id("song-1").expect("get song");
        assert_eq!(song.category_ids.len(), 1);
        assert!(!song
            .category_ids
            .iter()
            .any(|category_id| category_id == "cat-1"));
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
        std::fs::create_dir_all(cloud_dir.join("actions")).expect("create dirs");

        let events_payload = EventsTestPayload {
            events: vec![
                EventTestPayload {
                    id: "e1".to_string(),
                    timestamp: 100,
                    event_type: "insert".to_string(),
                    entity: "scores".to_string(),
                    entity_id: "score-10".to_string(),
                    data: Some(vec![EventDataTestPayload {
                        field: "name".to_string(),
                        value: Some("Tuba".to_string()),
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
                        value: Some("main".to_string()),
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
                        value: Some("pdf".to_string()),
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
                        value: Some("Buscai".to_string()),
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
                        value: Some("song-10".to_string()),
                    }]),
                },
            ],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("events.msgpack.zst"),
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
        std::fs::create_dir_all(cloud_dir.join("actions")).expect("create dirs");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 100,
            categories: vec![SnapshotCategoryTestPayload {
                id: "cat-1".to_string(),
                name: "Harpa".to_string(),
            }],
            categories_songs: vec![SnapshotCategorySongTestPayload {
                id: "cat-song-1".to_string(),
                category_id: "cat-1".to_string(),
                song_id: "song-1".to_string(),
            }],
            composers: Vec::new(),
            composer_songs: Vec::new(),
            arrangers: Vec::new(),
            arranger_songs: Vec::new(),
            songs: vec![SnapshotSongTestPayload {
                id: "song-1".to_string(),
                name: "Snapshot Music".to_string(),
                scores: vec![],
            }],
        };

        write_zstd_msgpack(
            &cloud_dir.join("actions").join("snapshot.msgpack.zst"),
            &snapshot_payload,
        );

        let summary = apply_server_changes_for_client(&db, &store).expect("sync client");

        assert!(summary.snapshot_applied);
        assert_eq!(summary.last_snapshot_timestamp, 100);
        assert_eq!(summary.last_change_timestamp, 100);

        let songs = db.get_all_songs().expect("get songs");
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].name, "Snapshot Music");
    }

    #[test]
    fn detects_pending_changes_when_actions_files_are_newer_than_store() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "server-4".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: ComputerType::Server,
            first_run_completed: true,
            last_snapshot_timestamp: Some(10),
            last_change_timestamp: Some(10),
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let actions_dir = dir.path().join("cloud").join("actions");
        std::fs::create_dir_all(&actions_dir).expect("create actions dir");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 25,
            categories: vec![],
            categories_songs: vec![],
            composers: vec![],
            composer_songs: vec![],
            arrangers: vec![],
            arranger_songs: vec![],
            songs: vec![],
        };
        write_zstd_msgpack(&actions_dir.join("snapshot.msgpack.zst"), &snapshot_payload);

        assert!(has_pending_server_changes(&db, &store).expect("inspect pending changes"));
    }

    #[test]
    fn ignores_actions_files_when_their_timestamps_match_the_store() {
        let dir = tempdir().expect("temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new(&db_path).expect("db init");
        let store = SystemStore::new(dir.path().to_path_buf());

        let settings = AppSettings {
            computer_id: "server-5".to_string(),
            computer_name: Some("Server".to_string()),
            computer_type: ComputerType::Server,
            first_run_completed: true,
            last_snapshot_timestamp: Some(25),
            last_change_timestamp: Some(25),
            ..Default::default()
        };
        store.save_app_settings(&settings).expect("save settings");

        let actions_dir = dir.path().join("cloud").join("actions");
        std::fs::create_dir_all(&actions_dir).expect("create actions dir");

        let snapshot_payload = SnapshotTestPayload {
            generated_at: 25,
            categories: vec![],
            categories_songs: vec![],
            composers: vec![],
            composer_songs: vec![],
            arrangers: vec![],
            arranger_songs: vec![],
            songs: vec![],
        };
        write_zstd_msgpack(&actions_dir.join("snapshot.msgpack.zst"), &snapshot_payload);

        let events_payload = EventsTestPayload { events: vec![] };
        write_zstd_msgpack(&actions_dir.join("events.msgpack.zst"), &events_payload);

        assert!(!has_pending_server_changes(&db, &store).expect("inspect pending changes"));
    }

    fn write_zstd_msgpack<T: serde::Serialize>(path: &std::path::Path, payload: &T) {
        let bytes = rmp_serde::to_vec_named(payload).expect("serialize msgpack");
        let compressed = zstd::stream::encode_all(bytes.as_slice(), 3).expect("zstd encode");
        std::fs::write(path, compressed).expect("write file");
    }
}
