use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tracing::{info, error};

use crate::infrastructure::database::Database;

/// Gerencia scanning de arquivos em background
/// Executa a cada 5 minutos de forma segura em thread separada
pub struct BackgroundScanner {
    is_running: Arc<Mutex<bool>>,
}

impl BackgroundScanner {
    /// Cria uma nova instância do scanner de background
    pub fn new() -> Self {
        BackgroundScanner {
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Inicia o background scanner com verificação a cada 5 minutos
    pub fn start(&self, db: Arc<Database>) {
        let is_running = Arc::clone(&self.is_running);

        // Verificar se já está rodando
        if let Ok(mut running) = is_running.lock() {
            if *running {
                info!("BackgroundScanner já está em execução");
                return;
            }
            *running = true;
        }

        thread::spawn(move || {
            info!("BackgroundScanner iniciado - verificará a cada 5 minutos");

            loop {
                // Aguardar 5 minutos (300 segundos)
                thread::sleep(Duration::from_secs(300));

                // Verificar se deve continuar rodando
                if let Ok(running) = is_running.lock() {
                    if !*running {
                        info!("BackgroundScanner parado");
                        break;
                    }
                }

                // Executar scan
                info!("Iniciando scan periódico de alterações");
                
                match db.get_all_scores_with_metadata() {
                    Ok(scores) => {
                        let mut changed_count = 0;
                        let mut error_count = 0;

                        for (score_id, file_path, stored_size, stored_modified_at_str) in scores {
                            let path = std::path::Path::new(&file_path);

                            if !path.exists() || !path.is_file() {
                                error_count += 1;
                                continue;
                            }

                            match crate::services::indexer::get_file_metadata(path) {
                                Ok((current_size, current_modified_at)) => {
                                    let stored_modified_at = chrono::NaiveDateTime::parse_from_str(
                                        &stored_modified_at_str,
                                        "%Y-%m-%d %H:%M:%S",
                                    )
                                    .unwrap_or_else(|_| chrono::Local::now().naive_local());

                                    let detector = crate::services::indexer::FileChangeDetector::new(
                                        current_size,
                                        current_modified_at,
                                        stored_size,
                                        stored_modified_at,
                                    );

                                    if detector.has_changed() {
                                        if let Err(e) = db.set_score_status_to_draft(&score_id) {
                                            error!("Erro ao atualizar status para draft: {:?}", e);
                                            error_count += 1;
                                        } else {
                                            changed_count += 1;
                                            info!("Status atualizado para draft: {}", file_path);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Erro ao obter metadados: {:?}", e);
                                    error_count += 1;
                                }
                            }
                        }

                        info!("Scan periódico concluído: {} alterações, {} erros",
                            changed_count, error_count);
                    }
                    Err(e) => {
                        error!("Erro ao buscar scores para scan: {:?}", e);
                    }
                }
            }
        });
    }

    /// Para o background scanner
    #[allow(dead_code)]
    pub fn stop(&self) {
        if let Ok(mut running) = self.is_running.lock() {
            *running = false;
            info!("BackgroundScanner parado");
        }
    }
}

impl Default for BackgroundScanner {
    fn default() -> Self {
        Self::new()
    }
}
