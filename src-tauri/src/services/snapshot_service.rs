use std::fs;

use serde::Serialize;
use tracing::warn;

use crate::domain::errors::AppError;
use crate::domain::models::ScoreStatus;
use crate::domain::models::OperationGuard;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::cloud_paths::ensure_actions_cloud_dir;
use crate::services::backup_songs_service::list_draft_not_found_scores_with_previous_main;
use crate::services::msgpack_zstd::{
    compress_zstd_with_threads, serialize_msgpack_named, write_atomic, ZSTD_LEVEL_BALANCED,
};

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
    extension: String,
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

    let cloud_dir = ensure_actions_cloud_dir(store.app_data_dir())?;

    let previous_main_versions =
        list_draft_not_found_scores_with_previous_main(db, store.app_data_dir(), &cloud_dir)?;

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
                    // Para draft/not_found, o snapshot reflete a versão efetivamente disponível
                    // na nuvem (main anterior quando existir; not_found quando não existir).
                    status: match score.status {
                        ScoreStatus::Draft | ScoreStatus::NotFound => {
                            if previous_main_versions.has_previous_main(&score.id) {
                                "main".to_string()
                            } else {
                                "not_found".to_string()
                            }
                        }
                        _ => score.status.as_str().to_string(),
                    },
                    id: score.id.clone(),
                    name: score.name.clone(),
                    extension: score.file_extension.clone(),
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

    let msgpack_bytes = serialize_msgpack_named(&payload, "snapshot.msgpack")?;

    let compressed_bytes = compress_snapshot_with_retry(&msgpack_bytes)?;

    let output_path = cloud_dir.join(SNAPSHOT_FILE_NAME);
    write_atomic(&output_path, &compressed_bytes, "snapshot.msgpack")?;

    let file_size = fs::metadata(&output_path)
        .map_err(|e| {
            AppError::Generic(format!(
                "Erro ao obter metadados de snapshot.msgpack: {}",
                e
            ))
        })?
        .len();

    let cleared_changed_fields = db.clear_changed_fields()?;

    clear_events_artifacts(&cloud_dir)?;

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

fn compress_snapshot_with_retry(msgpack_bytes: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut last_error: Option<AppError> = None;

    for attempt in 1..=2 {
        match compress_zstd_with_threads(msgpack_bytes, ZSTD_LEVEL_BALANCED, "snapshot.msgpack") {
            Ok(compressed) => return Ok(compressed),
            Err(err) => {
                warn!(
                    "Falha ao compactar snapshot.msgpack (tentativa {}): {}",
                    attempt,
                    err
                );
                last_error = Some(err);
            }
        }
    }

    Err(AppError::Generic(format!(
        "Nao foi possivel compactar o arquivo de alteracao snapshot.msgpack: {}",
        last_error
            .map(|e| e.to_string())
            .unwrap_or_else(|| "erro desconhecido".to_string())
    )))
}

fn clear_events_artifacts(cloud_dir: &std::path::Path) -> Result<(), AppError> {
    for entry in fs::read_dir(cloud_dir).map_err(|e| {
        AppError::Generic(format!("Erro ao listar diretório de ações após snapshot: {}", e))
    })? {
        let entry = entry.map_err(|e| {
            AppError::Generic(format!("Erro ao ler entrada de ações após snapshot: {}", e))
        })?;

        let path = entry.path();
        if path.file_name().and_then(|name| name.to_str()) == Some("snapshot.msgpack.zst") {
            continue;
        }

        if path.is_file() {
            fs::remove_file(&path).map_err(|e| {
                AppError::Generic(format!("Erro ao remover arquivo de ações após snapshot: {}", e))
            })?;
        } else if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| {
                AppError::Generic(format!("Erro ao remover diretório de ações após snapshot: {}", e))
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
                "Erro ao remover events legado após snapshot: {}",
                e
            ))
        })?;
    }

    Ok(())
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
            std::path::Path::new("cloud").join("actions").join("snapshot.msgpack.zst")
        ));
        assert!(!events_file.exists());
        assert!(!stale_events_file.exists());
        assert!(!legacy_events_file.exists());

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
