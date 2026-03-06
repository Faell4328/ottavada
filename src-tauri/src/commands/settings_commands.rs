use tauri::State;

use crate::domain::errors::AppError;
use crate::domain::models::AppSettings;
use crate::infrastructure::database::Database;

#[tauri::command]
pub fn get_settings(db: State<'_, Database>) -> Result<AppSettings, AppError> {
    db.get_app_settings()
}

#[tauri::command]
pub fn save_settings(db: State<'_, Database>, settings: AppSettings) -> Result<(), AppError> {
    db.save_app_settings(&settings)
}

#[tauri::command]
pub fn is_first_run(db: State<'_, Database>) -> Result<bool, AppError> {
    let settings = db.get_app_settings()?;
    Ok(!settings.first_run_completed)
}

#[tauri::command]
pub fn complete_first_run(
    db: State<'_, Database>,
    computer_name: String,
    google_drive_mode: String,
    api_key: Option<String>,
) -> Result<(), AppError> {
    let mut settings = db.get_app_settings()?;
    settings.computer_name = Some(computer_name);
    settings.api_key = api_key;
    settings.google_drive_mode = match google_drive_mode.as_str() {
        "api" => crate::domain::models::GoogleDriveMode::Api,
        _ => crate::domain::models::GoogleDriveMode::Local,
    };
    settings.first_run_completed = true;
    db.save_app_settings(&settings)
}
