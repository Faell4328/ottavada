use std::path::PathBuf;
use std::process::Command;

use crate::domain::errors::AppError;
use crate::domain::models::{AppSettings, OperationGuard};
use crate::infrastructure::store::SystemStore;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub fn get_settings(store: &SystemStore) -> Result<AppSettings, AppError> {
    store.get_app_settings()
}

pub fn require_server_settings(store: &SystemStore) -> Result<AppSettings, AppError> {
    let settings = get_settings(store)?;
    settings.require_server_only()?;
    Ok(settings)
}

pub async fn run_blocking_with_store<T, F>(
    app_data_dir: PathBuf,
    error_context: &'static str,
    task: F,
) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(SystemStore) -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let store = SystemStore::new(app_data_dir);
        task(store)
    })
    .await
    .map_err(|e| AppError::Generic(format!("{}: {}", error_context, e)))?
}

pub fn configure_no_window_command(cmd: Command) -> Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = cmd;
        // CREATE_NO_WINDOW = 0x08000000
        cmd.creation_flags(0x08000000);
        return cmd;
    }

    #[cfg(not(target_os = "windows"))]
    {
        cmd
    }
}
