use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tracing::{error, info};

use crate::domain::errors::AppError;
use crate::domain::models::{
    AppSettings, ComputerType, GoogleDriveMode, LibrarySummary, RcloneConfig,
};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::commands::rclone_commands::terminate_running_rclone_processes;

#[tauri::command]
pub fn get_settings(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<AppSettings, AppError> {
    info!("Buscando configurações");
    let mut settings = store.get_app_settings()?;

    if settings.library_summary.is_none() {
        settings.library_summary = Some(db.get_library_summary_counts()?);
        store.save_app_settings(&settings)?;
    }

    Ok(settings)
}

#[tauri::command]
pub fn refresh_library_summary_cache(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<LibrarySummary, AppError> {
    let mut settings = store.get_app_settings()?;
    let summary = db.get_library_summary_counts()?;
    settings.library_summary = Some(summary.clone());
    store.save_app_settings(&settings)?;
    Ok(summary)
}

#[tauri::command]
pub fn save_settings(store: State<'_, SystemStore>, settings: AppSettings) -> Result<(), AppError> {
    info!(
        "Salvando configurações para computador: {}",
        settings.computer_id
    );
    match store.save_app_settings(&settings) {
        Ok(_) => {
            info!("Configurações salvas com sucesso");
            Ok(())
        }
        Err(e) => {
            error!("Erro ao salvar configurações: {:?}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn is_first_run(store: State<'_, SystemStore>) -> Result<bool, AppError> {
    let settings = store.get_app_settings()?;
    let is_first = !settings.first_run_completed;
    info!("Verificando primeira execução: {}", is_first);
    Ok(is_first)
}

#[tauri::command]
pub fn generate_computer_id() -> String {
    let id = uuid::Uuid::new_v4().to_string();
    info!("ID do computador gerado: {}", id);
    id
}

#[tauri::command]
pub fn complete_first_run(
    store: State<'_, SystemStore>,
    computer_id: String,
    computer_name: String,
    computer_type: String,
    rclone_config_json: String,
) -> Result<(), AppError> {
    info!(
        "Completando primeira execução para: {} ({}) - Tipo: {}",
        computer_name, computer_id, computer_type
    );
    let mut settings = store.get_app_settings()?;

    settings.computer_id = computer_id;
    settings.computer_name = Some(computer_name);
    settings.computer_type = ComputerType::from_str(&computer_type);

    info!("Configurando Rclone");
    let rclone_config: RcloneConfig = serde_json::from_str(&rclone_config_json)
        .map_err(|e| AppError::Generic(format!("Configuração rclone inválida: {}", e)))?;

    settings.rclone_config = Some(rclone_config);
    settings.google_drive_mode = GoogleDriveMode::Local;
    info!("Rclone configurado");

    settings.first_run_completed = true;
    store.save_app_settings(&settings)
}

#[tauri::command]
pub fn is_initial_scan_completed(scan_flag: State<'_, Arc<AtomicBool>>) -> bool {
    scan_flag.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn toggle_computer_type(store: State<'_, SystemStore>) -> Result<String, AppError> {
    info!("Alternando tipo de computador");
    let mut settings = store.get_app_settings()?;

    let new_type = match settings.computer_type {
        ComputerType::Server => ComputerType::Client,
        ComputerType::Client => ComputerType::Server,
    };

    info!(
        "Alternar tipo de computador de {} para {}",
        settings.computer_type.as_str(),
        new_type.as_str()
    );

    settings.computer_type = new_type.clone();
    store.save_app_settings(&settings)?;

    info!("Tipo de computador alterado com sucesso");
    Ok(new_type.as_str().to_string())
}

#[tauri::command]
pub fn has_pending_changes(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<bool, AppError> {
    let latest_change = db.get_latest_changed_field_timestamp()?.unwrap_or(0);
    if latest_change == 0 {
        return Ok(false);
    }

    let settings = store.get_app_settings()?;
    let last_applied = settings.last_change_timestamp.unwrap_or(0);
    Ok(latest_change > last_applied)
}

#[tauri::command]
pub fn exit_application(app: AppHandle) {
    terminate_running_rclone_processes();
    app.exit(0);
}

#[tauri::command]
pub fn mark_local_changes_as_applied(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<(), AppError> {
    let latest_change = db.get_latest_changed_field_timestamp()?.unwrap_or(0);
    let mut settings = store.get_app_settings()?;
    settings.last_change_timestamp = Some(latest_change);
    store.save_app_settings(&settings)
}
