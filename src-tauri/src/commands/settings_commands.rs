use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;
use tracing::{error, info};

use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, ComputerType, GoogleDriveMode, RcloneConfig};
use crate::infrastructure::store::SystemStore;

#[tauri::command]
pub fn get_settings(store: State<'_, SystemStore>) -> Result<AppSettings, AppError> {
    info!("Buscando configurações");
    store.get_app_settings()
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

    if rclone_config.remote.trim().is_empty() {
        return Err(AppError::Generic(
            "Campo 'remote' do rclone é obrigatório".to_string(),
        ));
    }

    if rclone_config.path.trim().is_empty() {
        return Err(AppError::Generic(
            "Campo 'path' do rclone é obrigatório".to_string(),
        ));
    }

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
