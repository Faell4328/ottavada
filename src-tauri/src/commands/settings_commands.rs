use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tracing::{error, info};

use crate::commands::common::run_blocking_with_store;
use crate::commands::rclone_commands::terminate_running_rclone_processes;
use crate::domain::errors::AppError;
use crate::domain::models::{
    AppContacts, AppSettings, ComputerType, GoogleDriveMode, LibrarySummary, RcloneConfig,
};
use crate::infrastructure::database::Database;
use crate::infrastructure::store::SystemStore;
use crate::services::client_sync_service::has_pending_server_changes;
use crate::services::cloud_paths::{
    clear_server_apply_in_progress, has_server_apply_in_progress, mark_server_apply_in_progress,
};

#[tauri::command]
pub async fn get_settings(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<AppSettings, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao buscar configurações",
        move |store| {
            info!("Buscando configurações");
            let mut settings = store.get_app_settings()?;
            settings.library_summary = Some(db.get_library_summary_counts()?);
            Ok(settings)
        },
    )
    .await
}

#[tauri::command]
pub fn get_app_contacts() -> AppContacts {
    AppContacts::from_env_values(
        option_env!("APP_CONTACT_EMAIL"),
    )
}

#[tauri::command]
pub async fn refresh_library_summary_cache(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
) -> Result<LibrarySummary, AppError> {
    let db = db.inner().clone();
    let app_data_dir = store.app_data_dir().clone();

    run_blocking_with_store(
        app_data_dir,
        "Falha interna ao atualizar resumo da biblioteca",
        move |_store| db.get_library_summary_counts(),
    )
    .await
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

fn open_url_on_system(url: &str) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = crate::commands::common::configure_no_window_command(Command::new("cmd"));
        cmd.args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir o navegador: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir o navegador: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Erro ao abrir o navegador: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_tutorial_site() -> Result<(), AppError> {
    info!("Abrindo site de documentação");
    open_url_on_system("https://ottavada.com/docs")
}

#[tauri::command]
pub fn complete_first_run(
    store: State<'_, SystemStore>,
    computer_id: String,
    computer_name: String,
    organization_name: Option<String>,
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
    settings.organization_name = organization_name;
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
    has_pending_server_changes(&db, &store)
}

#[tauri::command]
pub fn has_server_apply_changes_in_progress(store: State<'_, SystemStore>) -> bool {
    has_server_apply_in_progress(store.app_data_dir())
}

#[tauri::command]
pub fn mark_server_apply_changes_in_progress(
    store: State<'_, SystemStore>,
) -> Result<(), AppError> {
    mark_server_apply_in_progress(store.app_data_dir())
}

#[tauri::command]
pub fn clear_server_apply_changes_in_progress(
    store: State<'_, SystemStore>,
) -> Result<(), AppError> {
    clear_server_apply_in_progress(store.app_data_dir())
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
    mark_local_changes_as_applied_impl(&db, &store)
}

#[tauri::command]
pub fn mark_snapshot_as_uploaded(
    store: State<'_, SystemStore>,
    last_snapshot_timestamp: i64,
    last_change_timestamp: Option<i64>,
) -> Result<(), AppError> {
    let mut settings = store.get_app_settings()?;
    settings.last_snapshot_timestamp = Some(last_snapshot_timestamp);

    if let Some(last_change_timestamp) = last_change_timestamp {
        settings.last_change_timestamp = Some(last_change_timestamp);
    }

    store.save_app_settings(&settings)
}

fn mark_local_changes_as_applied_impl(db: &Database, store: &SystemStore) -> Result<(), AppError> {
    let latest_change = db.get_latest_changed_field_timestamp()?.unwrap_or(0);
    db.clear_changed_fields()?;
    let mut settings = store.get_app_settings()?;
    settings.last_change_timestamp = Some(latest_change);
    store.save_app_settings(&settings)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::domain::models::{AppSettings, Category, ComputerType};
    use crate::infrastructure::database::Database;
    use crate::infrastructure::store::SystemStore;

    use super::mark_local_changes_as_applied_impl;

    #[test]
    fn clears_pending_changes_when_marking_local_changes_as_applied() {
        let dir = tempdir().expect("temp dir");
        let db = Database::new(&dir.path().join("test.db")).expect("db");
        let store = SystemStore::new(dir.path().to_path_buf());

        store
            .save_app_settings(&AppSettings {
                computer_id: "server-1".to_string(),
                computer_name: Some("Servidor".to_string()),
                computer_type: ComputerType::Server,
                first_run_completed: true,
                ..Default::default()
            })
            .expect("save settings");

        db.insert_category(&Category {
            id: "cat-1".to_string(),
            name: "Teste".to_string(),
            updated_at: chrono::Local::now().naive_local(),
            updated_by: "server-1".to_string(),
        })
        .expect("insert category");

        assert!(db.has_pending_changes().expect("pending changes"));

        mark_local_changes_as_applied_impl(&db, &store).expect("mark applied");

        assert!(!db.has_pending_changes().expect("pending changes"));

        let settings = store.get_app_settings().expect("reload settings");
        assert!(settings.last_change_timestamp.is_some());
    }
}
