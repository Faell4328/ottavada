# Como funciona por baixo do capô?

## Tecnologias e os porques?

O Score Maestro, utiliza:

- Tauri para criar a aplicação.

- React, TypeScript e Vite no Front.

- Rust no back.

- SQLite para armazenamento local.

- Rclone para sincronziar os arquivos.

- Tar e Zstd para juntar e compactação das músicas.

- Koofr ou Google Drive armazenar as partituras e trocar informação entre os computadores.

- MsgPack ao invés de JSON para backup, troca de informação e etc.
