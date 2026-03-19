# Sistema de Logging

O projeto Score-Maestro utiliza a biblioteca `tracing` para gerenciar logs da aplicação.

## Configuração

O sistema de logging é inicializado automaticamente quando a aplicação inicia em `src/lib.rs`. Os logs são salvos no diretório de dados da aplicação:
- **Windows**: `C:\Users\<seu-usuario>\AppData\Roaming\Score Maestro\`
- **Linux**: `~/.local/share/Score Maestro/`
- **macOS**: `~/Library/Application Support/Score Maestro/`

## Uso

Para usar logging em qualquer arquivo Rust, importe as macros de tracing:

```rust
use tracing::{info, warn, error, debug};

// Info - para eventos importantes
info!("Evento importante");

// Warn - para avisos
warn!("Algo pode estar errado");

// Error - para erros
error!("Ocorreu um erro");

// Debug - para debugging (apenas em modo debug)
debug!("Informação de debug");
```

## Formato dos Logs

Os logs são salvos em dois formatos:

1. **Arquivo** (`score-maestro.log.YYYY-MM-DD`): Formato JSON para fácil parsing
   ```json
   {"timestamp":"2024-01-15T10:30:00.123Z","level":"INFO","message":"Aplicação iniciada","target":"score_maestro","fields":{"message":"Aplicação iniciada"}}
   ```

2. **Console** (em modo debug): Formato legível e colorido

## Exemplos de Uso

### Em Comandos

```rust
#[tauri::command]
pub fn get_all_songs(db: tauri::State<Database>) -> Result<Vec<Song>, String> {
    info!("Buscando todas as músicas");
    match db.get_all_songs() {
        Ok(songs) => {
            info!("Retornou {} músicas", songs.len());
            Ok(songs)
        },
        Err(e) => {
            error!("Erro ao buscar músicas: {}", e);
            Err(e.to_string())
        }
    }
}
```

### Em Serviços

```rust
pub fn index_directory(path: &Path) -> Result<Vec<ScoreFile>> {
    info!("Indexando diretório: {:?}", path);
    
    let files = walk_directory(path)?;
    debug!("Encontrados {} arquivos", files.len());
    
    Ok(files)
}
```

## Dependências

As seguintes dependências foram adicionadas ao `Cargo.toml`:
- `tracing`: Framework de logging estruturado
- `tracing-subscriber`: Processador de eventos de tracing
- `tracing-appender`: Appender para salvar logs em arquivo

## Referências

- Documentação de `tracing`: https://docs.rs/tracing/
- Documentação de `tracing-subscriber`: https://docs.rs/tracing-subscriber/
