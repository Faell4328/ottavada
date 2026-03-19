mod commands;
mod domain;
mod infrastructure;
mod logger;
mod services;

use infrastructure::database::Database;
use infrastructure::store::SystemStore;
use tauri::Manager;
use tracing::info;

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

            // Executar scan inicial ao ligar
            info!("Executando verificação inicial de alterações");
            match db.get_all_scores_with_metadata() {
                Ok(scores) => {
                    let mut changed_count = 0;
                    for (score_id, file_path, stored_size, stored_modified_at_str) in scores {
                        let path = std::path::Path::new(&file_path);

                        if !path.exists() || !path.is_file() {
                            continue;
                        }

                        if let Ok((current_size, current_modified_at)) = 
                            services::indexer::get_file_metadata(path) {
                            let stored_modified_at = chrono::NaiveDateTime::parse_from_str(
                                &stored_modified_at_str,
                                "%Y-%m-%d %H:%M:%S",
                            ).unwrap_or_else(|_| chrono::Local::now().naive_local());

                            let detector = services::indexer::FileChangeDetector::new(
                                current_size,
                                current_modified_at,
                                stored_size,
                                stored_modified_at,
                            );

                            if detector.has_changed() {
                                if db.set_score_status_to_draft(&score_id).is_ok() {
                                    changed_count += 1;
                                    info!("Status atualizado para draft (inicialização): {}", file_path);
                                }
                            }
                        }
                    }
                    info!("Verificação inicial concluída: {} alterações", changed_count);
                }
                Err(e) => {
                    eprintln!("Erro na verificação inicial: {:?}", e);
                }
            }

            app.manage(db.clone());

            // Inicializar store de configurações
            let store = SystemStore::new(app_data_dir);
            app.manage(store);

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
            commands::song_commands::import_indexed_files_with_metadata,
            commands::song_commands::get_songs_by_category,
            commands::song_commands::create_song,
            commands::song_commands::create_song_with_categories,
            commands::song_commands::create_song_with_metadata,
            commands::song_commands::update_song,
            // Scores
            commands::score_commands::update_score,
            commands::score_commands::add_score_to_song,
            commands::score_commands::add_scores_to_song,
            commands::score_commands::open_file,
            commands::score_commands::update_score_status,
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
            // Scan
            commands::scan_commands::scan_files_for_changes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

