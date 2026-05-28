use std::time::Duration;

use chrono::Utc;
use serde::Serialize;
use tracing::{error, info};

use crate::domain::errors::AppError;
use crate::domain::models::AppSettings;
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;

const TELEMETRY_INTERVAL_SECONDS: u64 = 300;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TelemetrySummaryCounts {
    pub music_count: u64,
    pub music_main: u64,
    pub music_draft: u64,
    pub scores_count: u64,
    pub scores_main: u64,
    pub scores_draft: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TelemetryErrorPayload {
    pub id: String,
    pub date: String,
    pub message: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize)]
#[allow(non_snake_case)]
pub struct TelemetryPayload {
    pub computerId: String,
    pub organizationName: String,
    pub computerName: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub appVersion: String,
    pub os: String,
    pub arch: String,
    pub musicCount: u64,
    pub musicMain: u64,
    pub musicDraft: u64,
    pub scoresCount: u64,
    pub scoresMain: u64,
    pub scoresDraft: u64,
    pub errors: Vec<TelemetryErrorPayload>,
}

fn telemetry_endpoint() -> Option<String> {
    option_env!("TELEMETRY_ENDPOINT")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn telemetry_token() -> Option<String> {
    option_env!("TELEMETRY_API_TOKEN")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn current_architecture() -> String {
    if cfg!(target_pointer_width = "64") {
        "x64".to_string()
    } else {
        "x32".to_string()
    }
}

fn current_os() -> String {
    std::env::consts::OS.to_string()
}

fn build_payload(
    settings: &AppSettings,
    counts: TelemetrySummaryCounts,
    errors: Vec<TelemetryErrorPayload>,
) -> TelemetryPayload {
    TelemetryPayload {
        computerId: settings.computer_id.clone(),
        organizationName: settings.organization_name.clone().unwrap_or_default(),
        computerName: settings.computer_name.clone().unwrap_or_default(),
        r#type: settings.computer_type.as_store_str().to_string(),
        appVersion: env!("CARGO_PKG_VERSION").to_string(),
        os: current_os(),
        arch: current_architecture(),
        musicCount: counts.music_count,
        musicMain: counts.music_main,
        musicDraft: counts.music_draft,
        scoresCount: counts.scores_count,
        scoresMain: counts.scores_main,
        scoresDraft: counts.scores_draft,
        errors,
    }
}

fn record_telemetry_failure(db: &Database, computer_id: &str, now: i64, error: &AppError) {
    let _ = db.record_telemetry_error(computer_id, &error.to_string(), now);
}

pub fn send_telemetry_once(db: &Database, store: &SystemStore) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;
    let now = Utc::now().timestamp();
    db.prune_telemetry_errors_older_than_week(now).map_err(|error| {
        record_telemetry_failure(db, &settings.computer_id, now, &error);
        error
    })?;

    let endpoint = telemetry_endpoint().ok_or_else(|| {
        let error = AppError::Generic("TELEMETRY_ENDPOINT não configurado".to_string());
        record_telemetry_failure(db, &settings.computer_id, now, &error);
        error
    })?;
    let token = telemetry_token().ok_or_else(|| {
        let error = AppError::Generic("TELEMETRY_API_TOKEN não configurado".to_string());
        record_telemetry_failure(db, &settings.computer_id, now, &error);
        error
    })?;

    let counts = db.get_telemetry_summary_counts().map_err(|error| {
        record_telemetry_failure(db, &settings.computer_id, now, &error);
        error
    })?;
    let errors = db.list_telemetry_errors().map_err(|error| {
        record_telemetry_failure(db, &settings.computer_id, now, &error);
        error
    })?;
    let payload = build_payload(&settings, counts, errors);

    let client = reqwest::blocking::Client::new();
    let response = client.post(endpoint).header("Token", token).json(&payload).send();

    let response = match response {
        Ok(response) => response,
        Err(error) => {
            let error = AppError::Generic(format!("Erro ao enviar telemetria: {}", error));
            record_telemetry_failure(db, &settings.computer_id, now, &error);
            return Err(error);
        }
    };

    if !response.status().is_success() {
        let error = AppError::Generic(format!(
            "Servidor de telemetria respondeu com status {}",
            response.status()
        ));
        record_telemetry_failure(db, &settings.computer_id, now, &error);
        return Err(error);
    }

    db.clear_telemetry_errors()?;
    info!("Telemetria enviada com sucesso");
    Ok(())
}

pub fn spawn_telemetry_worker(db: Database, store_path: std::path::PathBuf) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(TELEMETRY_INTERVAL_SECONDS));
            let store = SystemStore::new(store_path.clone());

            if let Err(error) = send_telemetry_once(&db, &store) {
                error!("Falha ao enviar telemetria: {}", error);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_payload_uses_documented_fields() {
        use serde_json::Value;

        let settings = AppSettings {
            computer_id: "comp-1".to_string(),
            computer_name: Some("Maestro".to_string()),
            organization_name: Some("Orquestra".to_string()),
            computer_type: crate::domain::models::ComputerType::Server,
            ..AppSettings::default()
        };

        let payload = build_payload(
            &settings,
            TelemetrySummaryCounts {
                music_count: 10,
                music_main: 7,
                music_draft: 2,
                scores_count: 30,
                scores_main: 20,
                scores_draft: 5,
            },
            vec![TelemetryErrorPayload {
                id: "err-1".to_string(),
                date: "2026-04-15".to_string(),
                message: "falha".to_string(),
                timestamp: 1_710_684_000,
            }],
        );

        let json = serde_json::to_value(&payload).expect("payload should serialize");

        assert_eq!(json["computerId"], Value::String("comp-1".to_string()));
        assert!(json.get("uuid").is_none());
        assert_eq!(payload.computerName, "Maestro");
        assert_eq!(payload.organizationName, "Orquestra");
        assert_eq!(payload.r#type, "server");
        assert_eq!(payload.scoresDraft, 5);
        assert_eq!(payload.errors.len(), 1);
    }
}