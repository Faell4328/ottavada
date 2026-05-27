## Local

Diretório raiz do projeto:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro` (Linux).

Diretório temporário do projeto:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\temp` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/temp` (Linux).

Diretório raiz da nuvem:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud` (Linux).
  ! Esse diretório é utilizado para sincronizar com a nuvem

Diretório com as partituras compactadas:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\songs` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/songs` (Linux).

Diretório com os eventos:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\events` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/events` (Linux).
  ! Esse é o diretório onde é salvo os arquivos `events.msgpack.zst`.

Diretório das configurações do `rclone`:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\rclone` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/rclone` (Linux).

! É o mesmo diretório do `tauri-plugin-store`.

## Nuvem

- `events.msgpack.zst` - arquivo com as alterações recentes feitas. Cada computador terá o seu (até a `v1` apenas o Servidor gera)
- `snapshot.msgpack.zst` - arquivo com a snapshot do banco de dados (gerado exclusivamente pelo servidor).
- `pending/` - diretório com todas as músicas pendentes.
  - Músicas que foram enviadas pelo Cliente e precisam ser aprovadas pelo servidor.
- `songs/` - diretório com todas as músicas e partituras.
- `songs/{songId}.tar.zst` - arquivo compactado com todas as partituras de uma música.
  ! O diretório raiz é definido no `rclone`, por exemplo: `/Score Maestro/Songs`
