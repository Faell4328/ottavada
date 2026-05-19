mod commands;
mod domain;
mod infrastructure;
mod logger;
mod services;
#[cfg(test)]
pub mod test_support;

use infrastructure::database::Database;
use infrastructure::store::SystemStore;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::path::BaseDirectory;
use tauri::Manager;
use tracing::{info, warn};

fn reset_temp_directory(app_data_dir: &Path) -> Result<(), std::io::Error> {
    let temp_dir = app_data_dir.join("tmp");

    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)?;
    }

    std::fs::create_dir_all(&temp_dir)?;
    Ok(())
}

fn updater_builder() -> tauri_plugin_updater::Builder {
    tauri_plugin_updater::Builder::new()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RestoreWindowAction {
    Unminimize,
    Show,
    Maximize,
    Focus,
}

fn planned_restore_window_actions(is_minimized: bool) -> Vec<RestoreWindowAction> {
    if is_minimized {
        vec![
            RestoreWindowAction::Unminimize,
            RestoreWindowAction::Show,
            RestoreWindowAction::Maximize,
            RestoreWindowAction::Focus,
        ]
    } else {
        vec![
            RestoreWindowAction::Show,
            RestoreWindowAction::Maximize,
            RestoreWindowAction::Focus,
        ]
    }
}

fn restore_main_window<R: tauri::Runtime, M: tauri::Manager<R>>(manager: &M) {
    let Some(window) = manager.get_webview_window("main") else {
        warn!("Janela principal não encontrada ao restaurar estado inicial");
        return;
    };

    let is_minimized = window.is_minimized().unwrap_or(false);

    for action in planned_restore_window_actions(is_minimized) {
        match action {
            RestoreWindowAction::Unminimize => {
                let _ = window.unminimize();
            }
            RestoreWindowAction::Show => {
                let _ = window.show();
            }
            RestoreWindowAction::Maximize => {
                let _ = window.maximize();
            }
            RestoreWindowAction::Focus => {
                let _ = window.set_focus();
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn boost_current_process_priority() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS,
    };

    unsafe {
        let process = GetCurrentProcess();
        if SetPriorityClass(process, ABOVE_NORMAL_PRIORITY_CLASS) == 0 {
            warn!("Falha ao elevar a prioridade do processo principal");
        } else {
            info!("Prioridade do processo principal ajustada para acima do normal");
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn boost_current_process_priority() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(updater_builder().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            restore_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|_window, _event| {})
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Não foi possível obter diretório de dados");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Não foi possível criar diretório de dados");

            // Inicializar logger
            logger::init_logger(&app_data_dir).expect("Não foi possível inicializar o logger");

            boost_current_process_priority();
            restore_main_window(app);

            if let Err(e) = reset_temp_directory(&app_data_dir) {
                warn!(
                    "Falha ao limpar diretório temporário na inicialização ({}): {}",
                    app_data_dir.join("tmp").display(),
                    e
                );
            } else {
                info!(
                    "Diretório temporário limpo na inicialização: {}",
                    app_data_dir.join("tmp").display()
                );
            }

            info!("Aplicação iniciada");
            info!("Diretório de dados: {:?}", app_data_dir);

            let rclone_config_dir = app_data_dir.join("rclone");
            std::fs::create_dir_all(&rclone_config_dir)
                .expect("Não foi possível criar diretório de configuração do rclone");

            let rclone_config_path = rclone_config_dir.join("rclone.conf");

            let rclone_executable_path = if cfg!(target_os = "windows") {
                match app
                    .path()
                    .resolve("rclone/rclone.exe", BaseDirectory::Resource)
                {
                    Ok(path) if path.exists() => Some(path),
                    Ok(path) => {
                        warn!(
                            "Binário do rclone empacotado não encontrado em {}",
                            path.display()
                        );
                        None
                    }
                    Err(err) => {
                        warn!("Falha ao resolver o binário do rclone empacotado: {}", err);
                        None
                    }
                }
            } else {
                None
            };

            commands::rclone_commands::set_rclone_paths(rclone_executable_path, rclone_config_path);
            commands::rclone_commands::terminate_stale_rclone_rc_processes();

            // Inicializar banco de dados
            let db_path = app_data_dir.join("score_maestro.db");
            let db =
                Database::new(&db_path).expect("Não foi possível inicializar o banco de dados");

            // Estado para rastrear se o scan inicial terminou
            let initial_scan_completed = Arc::new(AtomicBool::new(false));

            app.manage(db.clone());
            app.manage(initial_scan_completed.clone());

            services::telemetry_service::spawn_telemetry_worker(
                db.clone(),
                app_data_dir.clone(),
            );

            // Inicializar store de configurações
            let store = SystemStore::new(app_data_dir.clone());
            app.manage(store);

            if let Ok(settings) = SystemStore::new(app_data_dir.clone()).get_app_settings() {
                if settings.first_run_completed {
                    let db_for_telemetry = db.clone();
                    let store_for_telemetry = app_data_dir.clone();
                    std::thread::spawn(move || {
                        let store = SystemStore::new(store_for_telemetry);
                        if let Err(error) = services::telemetry_service::send_telemetry_once(
                            &db_for_telemetry,
                            &store,
                        ) {
                            tracing::warn!("Falha ao enviar telemetria na abertura: {}", error);
                        }
                    });
                }
            }

            // Executar scan inicial em thread separada
            let db_clone = db.clone();
            let app_data_dir_clone = app_data_dir.clone();
            let scan_completed_flag = initial_scan_completed.clone();

            std::thread::spawn(move || {
                let store = SystemStore::new(app_data_dir_clone);
                let (host_id, should_scan) = match store.get_app_settings() {
                    Ok(settings) => {
                        let is_server = matches!(
                            settings.computer_type,
                            crate::domain::models::ComputerType::Server
                        );
                        (settings.computer_id, is_server)
                    }
                    Err(e) => {
                        tracing::error!("Erro ao obter settings para scan inicial: {:?}", e);
                        scan_completed_flag.store(true, Ordering::SeqCst);
                        return;
                    }
                };

                if should_scan {
                    services::background_scanner::run_initial_scan(&db_clone, &host_id);
                } else {
                    info!("Scan inicial ignorado: computador cliente");
                }
                scan_completed_flag.store(true, Ordering::SeqCst);
                info!("✓ Flag 'initial_scan_completed' setada para true");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Songs
            commands::song_commands::get_all_songs,
            commands::song_commands::get_all_song_summaries,
            commands::song_commands::get_favorited_songs,
            commands::song_commands::get_favorited_song_summaries,
            commands::song_commands::get_song_list_item_by_id,
            commands::song_commands::get_songs_with_drafts,
            commands::song_commands::get_song_summaries_with_drafts,
            commands::song_commands::get_songs_with_not_found,
            commands::song_commands::get_song_summaries_with_not_found,
            commands::song_commands::search_songs,
            commands::song_commands::get_search_suggestions,
            commands::song_commands::toggle_favorite,
            commands::song_commands::scan_directory,
            commands::song_commands::import_indexed_files,
            commands::song_commands::import_indexed_files_with_metadata,
            commands::song_commands::get_songs_by_category,
            commands::song_commands::get_song_summaries_by_category,
            commands::song_commands::create_song,
            commands::song_commands::create_song_with_categories,
            commands::song_commands::create_song_with_metadata,
            commands::song_commands::update_song,
            commands::song_commands::delete_song,
            // Scores
            commands::score_commands::update_score,
            commands::score_commands::add_score_to_song,
            commands::score_commands::add_scores_to_song,
            commands::score_commands::get_scores_for_song,
            commands::score_commands::open_file,
            commands::score_commands::open_file_path,
            commands::score_commands::open_file_location,
            commands::score_commands::update_score_status,
            commands::score_commands::delete_score,
            commands::score_commands::use_score_as_base,
            // Categories
            commands::category_commands::get_categories,
            commands::category_commands::create_category,
            commands::category_commands::delete_category,
            // Settings
            commands::settings_commands::get_settings,
            commands::settings_commands::refresh_library_summary_cache,
            commands::settings_commands::save_settings,
            commands::settings_commands::is_first_run,
            commands::settings_commands::complete_first_run,
            commands::settings_commands::generate_computer_id,
            commands::settings_commands::is_initial_scan_completed,
            commands::settings_commands::toggle_computer_type,
            commands::settings_commands::has_pending_changes,
            commands::settings_commands::has_server_apply_changes_in_progress,
            commands::settings_commands::mark_server_apply_changes_in_progress,
            commands::settings_commands::clear_server_apply_changes_in_progress,
            commands::settings_commands::exit_application,
            commands::settings_commands::mark_local_changes_as_applied,
            commands::settings_commands::mark_snapshot_as_uploaded,
            commands::settings_commands::get_app_contacts,
            // Updates
            commands::update_commands::check_for_updates,
            commands::update_commands::install_update,
            // Scan
            commands::scan_commands::scan_files_for_changes,
            commands::scan_commands::has_internet_connection,
            // Backup songs archives
            commands::backup_commands::generate_song_archives_files,
            commands::backup_commands::generate_events_file,
            commands::backup_commands::generate_snapshot_file,
            commands::backup_commands::export_backup_file,
            commands::backup_commands::import_backup_file,
            commands::backup_commands::generate_automatic_backup_file,
            commands::backup_commands::force_generate_backup_cloud_file,
            commands::backup_commands::import_backup_cloud_file,
            commands::backup_commands::apply_server_changes_on_client,
            // Rclone
            commands::rclone_commands::generate_rclone_config,
            commands::rclone_commands::test_rclone_connection,
            commands::rclone_commands::upload_with_rclone,
            commands::rclone_commands::test_rclone_upload,
            commands::rclone_commands::delete_rclone_test_file,
            commands::rclone_commands::sync_cloud_with_rclone,
            commands::rclone_commands::upload_cloud_paths_with_rclone,
            commands::rclone_commands::get_rclone_rc_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{planned_restore_window_actions, RestoreWindowAction};

    #[test]
    fn plans_minimized_window_restore_actions() {
        assert_eq!(
            planned_restore_window_actions(true),
            vec![
                RestoreWindowAction::Unminimize,
                RestoreWindowAction::Show,
                RestoreWindowAction::Maximize,
                RestoreWindowAction::Focus,
            ]
        );
    }

    #[test]
    fn plans_normal_window_restore_actions() {
        assert_eq!(
            planned_restore_window_actions(false),
            vec![
                RestoreWindowAction::Show,
                RestoreWindowAction::Maximize,
                RestoreWindowAction::Focus,
            ]
        );
    }
}
