mod commands;
mod domain;
mod infrastructure;
mod logger;
mod services;

use infrastructure::database::Database;
use infrastructure::store::SystemStore;
use tauri::Manager;
use tracing::info;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

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

            // Inicializar logger
            logger::init_logger(&app_data_dir)
                .expect("Não foi possível inicializar o logger");

            info!("Aplicação iniciada");
            info!("Diretório de dados: {:?}", app_data_dir);

            // Inicializar banco de dados
            let db_path = app_data_dir.join("score_maestro.db");
            let db = Database::new(&db_path)
                .expect("Não foi possível inicializar o banco de dados");

            // Estado para rastrear se o scan inicial terminou
            let initial_scan_completed = Arc::new(AtomicBool::new(false));

            app.manage(db.clone());
            app.manage(initial_scan_completed.clone());

            // Inicializar store de configurações
            let store = SystemStore::new(app_data_dir.clone());
            app.manage(store);

            // Executar scan inicial em thread separada
            let db_clone = db.clone();
            let app_data_dir_clone = app_data_dir.clone();
            let scan_completed_flag = initial_scan_completed.clone();
            
            std::thread::spawn(move || {
                let store = SystemStore::new(app_data_dir_clone);
                let host_id = match store.get_app_settings() {
                    Ok(settings) => settings.computer_id,
                    Err(e) => {
                        tracing::error!("Erro ao obter settings para scan inicial: {:?}", e);
                        scan_completed_flag.store(true, Ordering::SeqCst);
                        return;
                    }
                };

                services::background_scanner::run_initial_scan(&db_clone, &host_id);
                scan_completed_flag.store(true, Ordering::SeqCst);
                info!("✓ Flag 'initial_scan_completed' setada para true");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Songs
            commands::song_commands::get_all_songs,
            commands::song_commands::get_favorited_songs,
            commands::song_commands::get_songs_with_drafts,
            commands::song_commands::get_songs_with_not_found,
            commands::song_commands::search_songs,
            commands::song_commands::get_search_suggestions,
            commands::song_commands::toggle_favorite,
            commands::song_commands::scan_directory,
            commands::song_commands::import_indexed_files,
            commands::song_commands::import_indexed_files_with_metadata,
            commands::song_commands::get_songs_by_category,
            commands::song_commands::create_song,
            commands::song_commands::create_song_with_categories,
            commands::song_commands::create_song_with_metadata,
            commands::song_commands::update_song,
            commands::song_commands::delete_song,
            // Scores
            commands::score_commands::update_score,
            commands::score_commands::add_score_to_song,
            commands::score_commands::add_scores_to_song,
            commands::score_commands::open_file,
            commands::score_commands::update_score_status,
            commands::score_commands::delete_score,
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
            commands::settings_commands::is_initial_scan_completed,
            commands::settings_commands::toggle_computer_type,
            // Scan
            commands::scan_commands::scan_files_for_changes,
            // Rclone
            commands::rclone_commands::test_rclone_connection,
            commands::rclone_commands::upload_with_rclone,
            commands::rclone_commands::test_rclone_upload,
            commands::rclone_commands::delete_rclone_test_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

