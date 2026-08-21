use std::collections::HashMap;
use std::fs;

use serde::Serialize;
use tracing::warn;

use crate::domain::errors::AppError;
use crate::domain::models::OperationGuard;
use crate::domain::models::ScoreStatus;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::ensure_actions_cloud_dir;
use crate::services::cloud_paths::ensure_cloud_root_dir;
use crate::services::msgpack_zstd::{
    compress_zstd_with_threads, serialize_msgpack_named, write_atomic,
};

const SNAPSHOT_FILE_NAME: &str = "snapshot.msgpack.zst";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SnapshotFileSummary {
    pub output_path: String,
    pub file_size: u64,
    pub generated_at: i64,
    pub last_change_timestamp: Option<i64>,
    pub songs_count: usize,
    pub scores_count: usize,
    pub categories_count: usize,
    pub cleared_changed_fields: usize,
}

#[derive(Debug, Serialize)]
struct SnapshotMessagePack {
    #[serde(rename = "generatedAt")]
    generated_at: i64,
    categories: Vec<SnapshotCategory>,
    #[serde(rename = "categoriesSongs")]
    categories_songs: Vec<SnapshotCategorySong>,
    composers: Vec<SnapshotNamedEntity>,
    #[serde(rename = "composerSongs")]
    composer_songs: Vec<SnapshotNamedRelation>,
    arrangers: Vec<SnapshotNamedEntity>,
    #[serde(rename = "arrangerSongs")]
    arranger_songs: Vec<SnapshotNamedRelation>,
    songs: Vec<SnapshotSong>,
}

#[derive(Debug, Serialize)]
struct SnapshotCategory {
    id: String,
    name: String,
}

#[derive(Debug, Serialize)]
struct SnapshotSong {
    id: String,
    name: String,
    #[serde(default)]
    is_favorite: bool,
    scores: Vec<SnapshotScore>,
}

#[derive(Debug, Serialize)]
struct SnapshotScore {
    id: String,
    #[serde(rename = "songId")]
    song_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(rename = "fileExtension")]
    file_extension: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
}

#[derive(Debug, Serialize)]
struct SnapshotCategorySong {
    id: String,
    #[serde(rename = "categoryId")]
    category_id: String,
    #[serde(rename = "songId")]
    song_id: String,
}

#[derive(Debug, Serialize)]
struct SnapshotNamedEntity {
    id: String,
    name: String,
}

#[derive(Debug, Serialize)]
struct SnapshotNamedRelation {
    id: String,
    #[serde(rename = "composerId", skip_serializing_if = "Option::is_none")]
    composer_id: Option<String>,
    #[serde(rename = "arrangerId", skip_serializing_if = "Option::is_none")]
    arranger_id: Option<String>,
    #[serde(rename = "songId")]
    song_id: String,
}

pub fn generate_snapshot_msgpack(
    db: &Database,
    store: &SystemStore,
) -> Result<SnapshotFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let generated_at = chrono::Local::now().timestamp();

    let cloud_dir = ensure_actions_cloud_dir(store.app_data_dir())?;
    let _cloud_root_dir = ensure_cloud_root_dir(store.app_data_dir())?;

    let last_change_timestamp = db.get_latest_changed_field_timestamp()?;

    let all_songs = db.get_all_songs()?;
    let all_categories = db.get_all_categories()?;

    let exportable_songs: Vec<_> = all_songs
        .iter()
        .filter(|song| song.status == ScoreStatus::Main)
        .collect();

    let mut category_songs = Vec::new();
    let mut composers_by_name: HashMap<String, String> = HashMap::new();
    let mut composer_entities = Vec::new();
    let mut composer_songs = Vec::new();
    let mut arrangers_by_name: HashMap<String, String> = HashMap::new();
    let mut arranger_entities = Vec::new();
    let mut arranger_songs = Vec::new();

    let songs = exportable_songs
        .iter()
        .map(|song| SnapshotSong {
            id: song.id.clone(),
            name: song.name.clone(),
            is_favorite: song.is_favorite,
            scores: song
                .scores
                .iter()
                .filter(|score| score.status == ScoreStatus::Main)
                .map(|score| SnapshotScore {
                    id: score.id.clone(),
                    song_id: song.id.clone(),
                    name: score.name.clone(),
                    file_extension: if score.file_extension.starts_with('.') {
                        score.file_extension.clone()
                    } else {
                        format!(".{}", score.file_extension.trim_start_matches('.'))
                    },
                    status: None,
                })
                .collect(),
        })
        .collect::<Vec<_>>();

    for song in &exportable_songs {
        for category_id in &song.category_ids {
            category_songs.push(SnapshotCategorySong {
                id: uuid::Uuid::new_v4().to_string(),
                category_id: category_id.clone(),
                song_id: song.id.clone(),
            });
        }

        if let Some(composer_name) = song
            .composer
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            let composer_id = composers_by_name
                .entry(composer_name.to_string())
                .or_insert_with(|| uuid::Uuid::new_v4().to_string())
                .clone();

            if !composer_entities
                .iter()
                .any(|entity: &SnapshotNamedEntity| entity.id == composer_id)
            {
                composer_entities.push(SnapshotNamedEntity {
                    id: composer_id.clone(),
                    name: composer_name.to_string(),
                });
            }

            composer_songs.push(SnapshotNamedRelation {
                id: uuid::Uuid::new_v4().to_string(),
                composer_id: Some(composer_id),
                arranger_id: None,
                song_id: song.id.clone(),
            });
        }

        if let Some(arranger_name) = song
            .arranger
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            let arranger_id = arrangers_by_name
                .entry(arranger_name.to_string())
                .or_insert_with(|| uuid::Uuid::new_v4().to_string())
                .clone();

            if !arranger_entities
                .iter()
                .any(|entity: &SnapshotNamedEntity| entity.id == arranger_id)
            {
                arranger_entities.push(SnapshotNamedEntity {
                    id: arranger_id.clone(),
                    name: arranger_name.to_string(),
                });
            }

            arranger_songs.push(SnapshotNamedRelation {
                id: uuid::Uuid::new_v4().to_string(),
                composer_id: None,
                arranger_id: Some(arranger_id),
                song_id: song.id.clone(),
            });
        }
    }

    category_songs.sort_by(|left, right| left.id.cmp(&right.id));
    composer_entities
        .sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    composer_songs.sort_by(|left, right| left.id.cmp(&right.id));
    arranger_entities
        .sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    arranger_songs.sort_by(|left, right| left.id.cmp(&right.id));

    let categories = all_categories
        .iter()
        .map(|category| SnapshotCategory {
            id: category.id.clone(),
            name: category.name.clone(),
        })
        .collect::<Vec<_>>();

    let scores_count = songs.iter().map(|song| song.scores.len()).sum::<usize>();

    let payload = SnapshotMessagePack {
        generated_at,
        categories,
        categories_songs: category_songs,
        composers: composer_entities,
        composer_songs,
        arrangers: arranger_entities,
        arranger_songs,
        songs,
    };

    let msgpack_bytes = serialize_msgpack_named(&payload, "snapshot.msgpack")?;

    let compressed_bytes = compress_snapshot_with_retry(&msgpack_bytes)?;

    let output_path = cloud_dir.join(SNAPSHOT_FILE_NAME);
    write_atomic(&output_path, &compressed_bytes, "snapshot.msgpack")?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| AppError::Generic(format!("Error getting snapshot.msgpack metadata: {}", e)))?
        .len();

    let cleared_changed_fields =
        db.clear_changed_fields_before(last_change_timestamp.unwrap_or(0))?;

    clear_events_artifacts(&cloud_dir)?;

    Ok(SnapshotFileSummary {
        output_path: output_path.to_string_lossy().to_string(),
        file_size,
        generated_at,
        last_change_timestamp,
        songs_count: payload.songs.len(),
        scores_count,
        categories_count: payload.categories.len(),
        cleared_changed_fields,
    })
}

fn compress_snapshot_with_retry(msgpack_bytes: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut last_error: Option<AppError> = None;

    for attempt in 1..=2 {
        match compress_zstd_with_threads(msgpack_bytes, "snapshot.msgpack") {
            Ok(compressed) => return Ok(compressed),
            Err(err) => {
                warn!(
                    "Failed to compress snapshot.msgpack (attempt {}): {}",
                    attempt, err
                );
                last_error = Some(err);
            }
        }
    }

    Err(AppError::Generic(format!(
        "Could not compress the snapshot.msgpack change file: {}",
        last_error
            .map(|e| e.to_string())
            .unwrap_or_else(|| "unknown error".to_string())
    )))
}

fn clear_events_artifacts(cloud_dir: &std::path::Path) -> Result<(), AppError> {
    for entry in fs::read_dir(cloud_dir).map_err(|e| {
        AppError::Generic(format!(
            "Error listing actions directory after snapshot: {}",
            e
        ))
    })? {
        let entry = entry.map_err(|e| {
            AppError::Generic(format!(
                "Error reading actions directory entry after snapshot: {}",
                e
            ))
        })?;

        let path = entry.path();
        if path.file_name().and_then(|name| name.to_str()) == Some("snapshot.msgpack.zst") {
            continue;
        }

        if path.is_file() {
            fs::remove_file(&path).map_err(|e| {
                AppError::Generic(format!("Error removing actions file after snapshot: {}", e))
            })?;
        } else if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| {
                AppError::Generic(format!(
                    "Error removing actions directory after snapshot: {}",
                    e
                ))
            })?;
        }
    }

    let legacy_events_path = cloud_dir
        .parent()
        .map(|parent| parent.join("events.msgpack.zst"))
        .unwrap_or_else(|| cloud_dir.join("events.msgpack.zst"));
    if legacy_events_path.exists() {
        fs::remove_file(&legacy_events_path).map_err(|e| {
            AppError::Generic(format!(
                "Error removing legacy events file after snapshot: {}",
                e
            ))
        })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::Value;
    use tempfile::tempdir;

    use crate::domain::models::{Category, Song};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::generate_snapshot_msgpack;

    #[test]
    fn generates_snapshot_and_clears_changed_fields() {
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
        };
        db.insert_song(&song, &[category.id.clone()])
            .expect("insert song");

        let latest_change_timestamp = db
            .get_latest_changed_field_timestamp()
            .expect("latest change timestamp")
            .expect("latest change timestamp value");

        let events_dir = dir.path().join("cloud").join("actions");
        fs::create_dir_all(&events_dir).expect("create events dir");
        let events_file = events_dir.join("events.msgpack.zst");
        fs::write(&events_file, b"events").expect("write events file");

        let legacy_events_file = dir.path().join("cloud").join("events.msgpack.zst");
        fs::write(&legacy_events_file, b"legacy events").expect("write legacy events file");

        let stale_events_file = events_dir.join("old-events.msgpack.zst");
        fs::write(&stale_events_file, b"old events").expect("write stale events file");

        let summary = generate_snapshot_msgpack(&db, &store).expect("generate snapshot");

        assert!(summary.file_size > 0);
        assert!(summary.generated_at > 0);
        assert!(std::path::Path::new(&summary.output_path).ends_with(
            std::path::Path::new("cloud")
                .join("actions")
                .join("snapshot.msgpack.zst")
        ));
        assert!(!events_file.exists());
        assert!(!stale_events_file.exists());
        assert!(!legacy_events_file.exists());

        let changed_fields = db
            .get_changed_fields_ordered()
            .expect("changed fields query");
        assert!(changed_fields.is_empty());

        let updated_settings = store.get_app_settings().expect("settings read");
        assert_eq!(updated_settings.last_snapshot_timestamp, Some(0));
        assert_eq!(summary.last_change_timestamp, Some(latest_change_timestamp));
    }

    #[test]
    fn excludes_draft_scores_from_snapshot_even_with_previous_archive_exists() {
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
        };
        db.insert_category(&category).expect("insert category");

        let song = Song {
            id: "song-1".to_string(),
            name: "Test Music".to_string(),
            composer: None,
            arranger: None,
            path: "/music/song-1".to_string(),
            is_favorite: false,
            status: crate::domain::models::ScoreStatus::Main,
        };
        db.insert_song(&song, &[category.id.clone()])
            .expect("insert song");

        conn_execute_draft_score(&db);

        let summary = generate_snapshot_msgpack(&db, &store).expect("generate snapshot");
        assert!(summary.file_size > 0);

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("snapshot.msgpack.zst"),
        )
        .expect("read snapshot file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: Value = rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert!(payload["songs"][0]["scores"]
            .as_array()
            .expect("scores array")
            .is_empty());
    }

    #[test]
    fn excludes_draft_songs_from_snapshot_payload() {
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

        let main_song = Song {
            id: "song-main".to_string(),
            name: "Main Music".to_string(),
            composer: None,
            arranger: None,
            path: "/music/song-main".to_string(),
            is_favorite: false,
            status: crate::domain::models::ScoreStatus::Main,
        };
        db.insert_song(&main_song, &[]).expect("insert main song");

        let draft_song = Song {
            id: "song-draft".to_string(),
            name: "Draft Music".to_string(),
            composer: None,
            arranger: None,
            path: "/music/song-draft".to_string(),
            is_favorite: false,
            status: crate::domain::models::ScoreStatus::Draft,
        };
        db.insert_song(&draft_song, &[]).expect("insert draft song");

        let summary = generate_snapshot_msgpack(&db, &store).expect("generate snapshot");

        let raw = fs::read(
            dir.path()
                .join("cloud")
                .join("actions")
                .join("snapshot.msgpack.zst"),
        )
        .expect("read snapshot file");
        let mut decoder = zstd::stream::read::Decoder::new(raw.as_slice()).expect("decoder");
        let payload: Value = rmp_serde::from_read(&mut decoder).expect("decode msgpack");

        assert_eq!(summary.songs_count, 1);
        assert_eq!(payload["songs"].as_array().expect("songs array").len(), 1);
        assert_eq!(payload["songs"][0]["id"], "song-main");
    }

    fn conn_execute_draft_score(db: &Database) {
        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "INSERT INTO scores (id, song_id, name, file_path, file_name, file_extension, file_size, file_modified_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), ?8)",
            rusqlite::params![
                "score-1",
                "song-1",
                "flauta",
                "/tmp",
                "score-1.musx",
                "musx",
                0,
                "draft",
            ],
        )
        .expect("insert draft score");
    }
}
