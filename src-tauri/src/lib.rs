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
            // Songs
            commands::song_commands::get_all_songs,
            commands::song_commands::get_favorited_songs,
            commands::song_commands::get_songs_with_drafts,
            commands::song_commands::search_songs,
            commands::song_commands::get_search_suggestions,
            commands::song_commands::toggle_favorite,
            commands::song_commands::scan_directory,
            commands::song_commands::import_indexed_files,
            commands::song_commands::get_songs_by_category,
            commands::song_commands::create_song,
            commands::song_commands::update_song,
            // Scores
            commands::score_commands::update_score,
            commands::score_commands::add_score_to_song,
            commands::score_commands::add_scores_to_song,
            commands::score_commands::open_file,
            // Categories
            commands::category_commands::get_categories,
            commands::category_commands::create_category,
            commands::category_commands::delete_category,
            // Settings
            commands::settings_commands::get_settings,
            commands::settings_commands::save_settings,
            commands::settings_commands::is_first_run,
            commands::settings_commands::complete_first_run,
            commands::settings_commands::generate_computer_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

