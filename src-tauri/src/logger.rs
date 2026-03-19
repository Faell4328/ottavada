use std::path::Path;
use tracing_subscriber::fmt;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Inicializa o sistema de logging
/// 
/// # Arguments
/// * `log_dir` - Caminho do diretório onde os logs serão salvos
pub fn init_logger(log_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    // Cria o diretório de logs se não existir
    std::fs::create_dir_all(log_dir)?;

    // Cria um appender para escrever logs em arquivo
    let file_appender = tracing_appender::rolling::daily(log_dir, "score-maestro.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Configurar subscriber com layer de arquivo e console (em debug)
    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_target(true)
        .with_level(true);

    #[cfg(debug_assertions)]
    let console_layer = fmt::layer()
        .pretty()
        .with_target(true)
        .with_level(true);

    #[cfg(not(debug_assertions))]
    let console_layer = fmt::layer()
        .with_target(true)
        .with_level(true);

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::filter::LevelFilter::INFO)
        .with(file_layer)
        .with(console_layer);

    subscriber.init();

    // Keep the guard para evitar que o non_blocking seja descartado
    std::mem::forget(_guard);

    Ok(())
}
