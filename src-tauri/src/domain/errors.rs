use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Erro de banco de dados: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Erro de I/O: {0}")]
    Io(#[from] std::io::Error),

    #[error("Arquivo não encontrado: {0}")]
    #[allow(dead_code)]
    FileNotFound(String),

    #[error("Partitura não encontrada: {0}")]
    #[allow(dead_code)]
    ScoreNotFound(String),

    #[error("Versão não encontrado: {0}")]
    VersionNotFound(String),

    #[error("Categoria não encontrada: {0}")]
    #[allow(dead_code)]
    CategoryNotFound(String),

    #[error("Diretório inválido: {0}")]
    InvalidDirectory(String),

    #[error("Espaço insuficiente no destino")]
    #[allow(dead_code)]
    InsufficientSpace,

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
