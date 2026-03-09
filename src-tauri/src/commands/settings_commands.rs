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
pub fn generate_computer_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[tauri::command]
pub fn complete_first_run(
    db: State<'_, Database>,
    computer_id: String,
    computer_name: String,
    _google_drive_mode: String,
    google_service_account_json: Option<String>,
) -> Result<(), AppError> {
    let mut settings = db.get_app_settings()?;
    
    // Set the computer ID
    settings.computer_id = computer_id;
    settings.computer_name = Some(computer_name);
    
    // Parse and validate the service account
    if let Some(json_str) = google_service_account_json {
        let service_account: crate::domain::models::GoogleServiceAccount = 
            serde_json::from_str(&json_str)
                .map_err(|e| AppError::Generic(format!("JSON inválido: {}", e)))?;
        
        // Validate required fields
        service_account.validate()
            .map_err(|e| AppError::Generic(e))?;
        
        settings.google_service_account = Some(service_account);
        settings.google_drive_mode = crate::domain::models::GoogleDriveMode::Api;
    } else {
        settings.google_drive_mode = crate::domain::models::GoogleDriveMode::Local;
    }
    
    settings.first_run_completed = true;
    db.save_app_settings(&settings)
}
