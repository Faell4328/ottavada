use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use tracing::{info, warn};
use url::Url;

use crate::domain::errors::AppError;

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

fn select_update_body(
    language: &str,
    fallback: Option<String>,
    translations: &std::collections::HashMap<String, String>,
) -> Option<String> {
    let language = language
        .split('-')
        .next()
        .unwrap_or(language)
        .to_lowercase();
    translations
        .get(&language)
        .cloned()
        .filter(|body| !body.trim().is_empty())
        .or(fallback)
}

#[derive(Debug, serde::Deserialize)]
struct ReleaseNotes {
    version: String,
    #[serde(rename = "pub_date")]
    pub_date: Option<String>,
    #[serde(rename = "notes_i18n")]
    notes_i18n: Option<std::collections::HashMap<String, String>>,
    notes: Option<String>,
}

async fn fetch_release_notes(endpoint: &str) -> Option<ReleaseNotes> {
    let response = reqwest::Client::new().get(endpoint).send().await.ok()?;
    response.json::<ReleaseNotes>().await.ok()
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckResult {
    pub configured: bool,
    pub update: Option<UpdateInfo>,
}

fn configured_endpoint() -> Option<String> {
    option_env!("TAURI_UPDATER_ENDPOINT").and_then(|endpoint| {
        let trimmed = endpoint.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn configured_pubkey() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_PUBKEY").and_then(|pubkey| {
        if pubkey.trim().is_empty() {
            None
        } else {
            Some(pubkey)
        }
    })
}

fn configure_updater(
    app: &AppHandle,
) -> Result<Option<(tauri_plugin_updater::Updater, String)>, AppError> {
    let Some(endpoint) = configured_endpoint() else {
        warn!("Update not configured: missing endpoint");
        return Ok(None);
    };

    let Some(pubkey) = configured_pubkey() else {
        warn!("Update not configured: missing public key");
        return Ok(None);
    };

    let endpoint_url = Url::parse(&endpoint)
        .map_err(|err| AppError::Generic(format!("Invalid update endpoint: {}", err)))?;

    let updater = app
        .updater_builder()
        .pubkey(pubkey)
        .endpoints(vec![endpoint_url])
        .map_err(|err| AppError::Generic(format!("Error configuring update: {}", err)))?
        .build()
        .map_err(|err| AppError::Generic(format!("Error starting updater: {}", err)))?;

    Ok(Some((updater, endpoint)))
}

#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    language: String,
) -> Result<UpdateCheckResult, AppError> {
    let Some((updater, _endpoint)) = configure_updater(&app)? else {
        return Ok(UpdateCheckResult {
            configured: false,
            update: None,
        });
    };

    info!("Checking for software update");
    let update = updater
        .check()
        .await
        .map_err(|err| AppError::Generic(format!("Error checking for update: {}", err)))?;

    let release_notes = match configured_endpoint() {
        Some(endpoint) => fetch_release_notes(&endpoint).await,
        None => None,
    };

    let update = update.map(|update| {
        let (notes_i18n, fallback_body, version, date) = match &release_notes {
            Some(notes) => (
                notes.notes_i18n.clone().unwrap_or_default(),
                notes.notes.clone().or(update.body),
                notes.version.clone(),
                notes
                    .pub_date
                    .clone()
                    .or_else(|| update.date.map(|d| d.to_string())),
            ),
            None => (
                std::collections::HashMap::new(),
                update.body,
                update.version,
                update.date.map(|d| d.to_string()),
            ),
        };
        let body = select_update_body(&language, fallback_body, &notes_i18n);
        UpdateInfo {
            current_version: update.current_version,
            version,
            date,
            body,
        }
    });

    Ok(UpdateCheckResult {
        configured: true,
        update,
    })
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), AppError> {
    let Some((updater, _)) = configure_updater(&app)? else {
        return Err(AppError::Generic(
            "Update not configured in the application".to_string(),
        ));
    };

    info!("Starting update installation");
    let Some(update) = updater
        .check()
        .await
        .map_err(|err| AppError::Generic(format!("Error checking for update: {}", err)))?
    else {
        return Ok(());
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| AppError::Generic(format!("Error installing update: {}", err)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn translations() -> std::collections::HashMap<String, String> {
        let mut map = std::collections::HashMap::new();
        map.insert("en".into(), "English notes".into());
        map.insert("pt".into(), "Notas em português".into());
        map.insert("es".into(), " ".into());
        map
    }

    #[test]
    fn selects_translation_for_language() {
        let result = select_update_body("pt-BR", Some("fallback".into()), &translations());
        assert_eq!(result.as_deref(), Some("Notas em português"));
    }

    #[test]
    fn falls_back_to_body_when_language_missing() {
        let result = select_update_body("de", Some("fallback".into()), &translations());
        assert_eq!(result.as_deref(), Some("fallback"));
    }

    #[test]
    fn falls_back_to_body_when_translation_empty() {
        let result = select_update_body("es", Some("fallback".into()), &translations());
        assert_eq!(result.as_deref(), Some("fallback"));
    }

    #[test]
    fn uses_body_when_no_translations() {
        let empty = std::collections::HashMap::new();
        let result = select_update_body("pt", Some("only body".into()), &empty);
        assert_eq!(result.as_deref(), Some("only body"));
    }
}
