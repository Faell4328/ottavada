use std::path::Path;
use tracing_subscriber::fmt;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Initializes the logging system
///
/// # Arguments
/// * `log_dir` - Path of the directory where the logs will be saved
pub fn init_logger(log_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    // Create the logs directory if it does not exist
    std::fs::create_dir_all(log_dir)?;

    // Create an appender to write logs to a file
    let file_appender = tracing_appender::rolling::daily(log_dir, "ottavada.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Configure subscriber with file and console layer (in debug)
    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_target(true)
        .with_level(true);

    #[cfg(debug_assertions)]
    let console_layer = fmt::layer().pretty().with_target(true).with_level(true);

    #[cfg(not(debug_assertions))]
    let console_layer = fmt::layer().with_target(true).with_level(true);

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::filter::LevelFilter::INFO)
        .with(file_layer)
        .with(console_layer);

    subscriber.init();

    // Keep the guard so that the non_blocking is not dropped
    std::mem::forget(_guard);

    Ok(())
}
