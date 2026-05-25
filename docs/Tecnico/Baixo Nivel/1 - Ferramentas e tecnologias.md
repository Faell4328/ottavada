# Como funciona por baixo do capô?

O sistema utiliza `tauri` por de baixo de tudo.

# 1. Front

- `react` e `typescript`
- `vite`
- `tailwindcss`
- `react-router` - Navegação entre telas
- `lucide-react` - Ícones
- `react-hot-toast` - Notificações em tempo real

# 2. Back-end

- `rust`
- `zst` crate - Reduz tamanho para backup na nuvem
- `rusqlite` crate - SQLite com suporte a FTS5
- `serde` + `rmp-serde` - Leitura do arquivo `MessagePack`.
- `fs2` - Espaço em disco
- `thiserror` - Erros tipados
- `tauri-plugin-dialog` - Diálogos nativos (seleção de arquivos/pastas)
- `tauri-plugin-fs` - Acesso ao sistema de arquivos
- `tauri-plugin-store` - Persistência de configurações
- `tracing` + `tracing-subscriber` - Para criar e processar logs
- `tracing-appender` - Para salvar os logs

# 3. Banco de Dados e Armazenamento

- `SQLite`
- `.msgpack`

# 4. Outros

- `rclone` - Para sincronização na nuvem.
- `.tar` + `.zst` - Junção e compactação dos arquivos.
