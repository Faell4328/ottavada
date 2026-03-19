use std::sync::{Arc, Mutex};
use tracing::{info};

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
