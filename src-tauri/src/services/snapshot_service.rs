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
const SNAPSHOT_FILE_NAME: &str = "snapshot.msgpack.zst";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SnapshotFileSummary {
    pub output_path: String,
    pub file_size: u64,
    pub generated_at: i64,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    composer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    arranger: Option<String>,
    #[serde(rename = "categoriesId")]
    categories_id: Vec<String>,
    scores: Vec<SnapshotScore>,
}

#[derive(Debug, Serialize)]
struct SnapshotScore {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    status: String,
    #[serde(rename = "updatedAt")]
    updated_at: i64,
}

pub fn generate_snapshot_msgpack(
    db: &Database,
    store: &SystemStore,
) -> Result<SnapshotFileSummary, AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    let generated_at = chrono::Local::now().timestamp();

    let all_songs = db.get_all_songs()?;
    let all_categories = db.get_all_categories()?;

    let songs = all_songs
        .iter()
        .map(|song| SnapshotSong {
            id: song.id.clone(),
            name: song.name.clone(),
            composer: song.composer.clone(),
            arranger: song.arranger.clone(),
            categories_id: song.category_ids.clone(),
            scores: song
                .scores
                .iter()
                .map(|score| SnapshotScore {
                    id: score.id.clone(),
                    name: score.name.clone(),
                    status: score.status.as_str().to_string(),
                    updated_at: score.updated_at.and_utc().timestamp(),
                })
                .collect(),
        })
        .collect::<Vec<_>>();

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
        songs,
    };

    let msgpack_bytes = rmp_serde::to_vec_named(&payload)
        .map_err(|e| AppError::Generic(format!("Erro ao serializar snapshot.msgpack: {}", e)))?;

    let compressed_bytes = compress_snapshot_payload(&msgpack_bytes)?;

    let cloud_dir = store.app_data_dir().join(CLOUD_DIR_NAME);
    fs::create_dir_all(&cloud_dir)
        .map_err(|e| AppError::Generic(format!("Erro ao criar diretório de nuvem: {}", e)))?;

    let output_path = cloud_dir.join(SNAPSHOT_FILE_NAME);
    let temp_path = temp_path_for(&output_path);

    fs::write(&temp_path, &compressed_bytes).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever arquivo temporário de snapshot: {}",
            e
        ))
    })?;

    fs::rename(&temp_path, &output_path)
        .map_err(|e| AppError::Generic(format!("Erro ao finalizar snapshot.msgpack: {}", e)))?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| {
            AppError::Generic(format!(
                "Erro ao obter metadados de snapshot.msgpack: {}",
                e
            ))
        })?
        .len();

    let cleared_changed_fields = db.clear_changed_fields()?;

    let events_path = cloud_dir.join(EVENTS_DIR_NAME).join(EVENTS_FILE_NAME);
    if events_path.exists() {
        fs::remove_file(&events_path).map_err(|e| {
            AppError::Generic(format!(
                "Erro ao remover events.msgpack.zst após snapshot: {}",
                e
            ))
        })?;
    }

    let mut updated_settings = settings;
    updated_settings.last_snapshot_timestamp = Some(generated_at);
    store.save_app_settings(&updated_settings)?;

    Ok(SnapshotFileSummary {
        output_path: output_path.to_string_lossy().to_string(),
        file_size,
        generated_at,
        songs_count: payload.songs.len(),
        scores_count,
        categories_count: payload.categories.len(),
        cleared_changed_fields,
    })
}

fn temp_path_for(path: &PathBuf) -> PathBuf {
    let mut temp = path.clone();
    temp.set_extension("zst.tmp");
    temp
}

fn compress_snapshot_payload(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let level = 10;
    let mut encoder = zstd::stream::Encoder::new(Vec::new(), level).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao iniciar compressão zstd de snapshot.msgpack: {}",
            e
        ))
    })?;

    let worker_count = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1);

    encoder.multithread(worker_count as u32).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao configurar multithread da compressão zstd de snapshot.msgpack: {}",
            e
        ))
    })?;

    std::io::Write::write_all(&mut encoder, data).map_err(|e| {
        AppError::Generic(format!(
            "Erro ao escrever payload de snapshot.msgpack no zstd: {}",
            e
        ))
    })?;

    encoder.finish().map_err(|e| {
        AppError::Generic(format!(
            "Erro ao finalizar compressão zstd de snapshot.msgpack: {}",
            e
        ))
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

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

        let events_dir = dir.path().join("cloud").join("events");
        fs::create_dir_all(&events_dir).expect("create events dir");
        let events_file = events_dir.join("events.msgpack.zst");
        fs::write(&events_file, b"events").expect("write events file");

        let summary = generate_snapshot_msgpack(&db, &store).expect("generate snapshot");

        assert!(summary.file_size > 0);
        assert!(summary.generated_at > 0);
        assert!(summary.output_path.ends_with("/cloud/snapshot.msgpack.zst"));
        assert!(!events_file.exists());

        let changed_fields = db
            .get_changed_fields_ordered()
            .expect("changed fields query");
        assert!(changed_fields.is_empty());

        let updated_settings = store.get_app_settings().expect("settings read");
        assert_eq!(
            updated_settings.last_snapshot_timestamp,
            Some(summary.generated_at)
        );
    }
}
