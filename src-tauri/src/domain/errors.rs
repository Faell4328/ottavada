use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Song not found: {0}")]
    SongNotFound(String),

    #[error("Score not found: {0}")]
    ScoreNotFound(String),


    #[error("Invalid directory: {0}")]
    InvalidDirectory(String),

    #[error("Operation not allowed for client")]
    ClientOperationNotAllowed,

    #[error("score_duplicate_instrument")]
    ScoreDuplicateInstrument,

    #[error("score_source_file_not_found")]
    ScoreSourceFileNotFound,

    #[error("score_target_file_exists:{0}")]
    ScoreTargetFileExists(String),

    #[error("{0}")]
    Generic(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
