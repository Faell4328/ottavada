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

#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckResult {
    pub configured: bool,
    pub update: Option<UpdateInfo>,
}

fn configured_endpoint() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_ENDPOINT").and_then(|endpoint| {
        let trimmed = endpoint.trim();
        if trimmed.is_empty() || trimmed == "SUA_URL_AQUI" {
            None
        } else {
            Some(endpoint)
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

fn configure_updater(app: &AppHandle) -> Result<Option<tauri_plugin_updater::Updater>, AppError> {
    let Some(endpoint) = configured_endpoint() else {
        warn!("Atualização não configurada: endpoint ausente");
        return Ok(None);
    };

    let Some(pubkey) = configured_pubkey() else {
        warn!("Atualização não configurada: chave pública ausente");
        return Ok(None);
    };

    let endpoint_url = Url::parse(endpoint)
        .map_err(|err| AppError::Generic(format!("Endpoint de atualização inválido: {}", err)))?;

    let updater = app
        .updater_builder()
        .pubkey(pubkey)
        .endpoints(vec![endpoint_url])
        .map_err(|err| AppError::Generic(format!("Erro ao configurar atualização: {}", err)))?
        .build()
        .map_err(|err| AppError::Generic(format!("Erro ao iniciar updater: {}", err)))?;

    Ok(Some(updater))
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, AppError> {
    let Some(updater) = configure_updater(&app)? else {
        return Ok(UpdateCheckResult {
            configured: false,
            update: None,
        });
    };

    info!("Verificando atualização do software");
    let update = updater
        .check()
        .await
        .map_err(|err| AppError::Generic(format!("Erro ao verificar atualização: {}", err)))?;

    let update = update.map(|update| UpdateInfo {
        current_version: update.current_version,
        version: update.version,
        date: update.date.map(|date| date.to_string()),
        body: update.body,
    });

    Ok(UpdateCheckResult {
        configured: true,
        update,
    })
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), AppError> {
    let Some(updater) = configure_updater(&app)? else {
        return Err(AppError::Generic(
            "Atualização não configurada no aplicativo".to_string(),
        ));
    };

    info!("Iniciando instalação da atualização");
    let Some(update) = updater
        .check()
        .await
        .map_err(|err| AppError::Generic(format!("Erro ao verificar atualização: {}", err)))?
    else {
        return Ok(());
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| AppError::Generic(format!("Erro ao instalar atualização: {}", err)))
}
