mod commands;
mod domain;
mod infrastructure;
mod services;

use infrastructure::database::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Não foi possível obter diretório de dados");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Não foi possível criar diretório de dados");

            let db_path = app_data_dir.join("score_maestro.db");
            let db = Database::new(&db_path)
                .expect("Não foi possível inicializar o banco de dados");

            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Scores
            commands::score_commands::get_all_scores,
            commands::score_commands::get_favorited_scores,
            commands::score_commands::get_scores_with_drafts,
            commands::score_commands::search_scores,
            commands::score_commands::get_search_suggestions,
            commands::score_commands::toggle_favorite,
            commands::score_commands::scan_directory,
            commands::score_commands::import_indexed_files,
            commands::score_commands::get_scores_by_category,
            commands::score_commands::create_score,
            commands::score_commands::open_file,
            // Versions
            commands::version_commands::get_versions,
            commands::version_commands::promote_draft,
            commands::version_commands::delete_version,
            commands::version_commands::create_draft,
            // Categories
            commands::category_commands::get_categories,
            commands::category_commands::create_category,
            commands::category_commands::delete_category,
            // Settings
            commands::settings_commands::get_settings,
            commands::settings_commands::save_settings,
            commands::settings_commands::is_first_run,
            commands::settings_commands::complete_first_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

