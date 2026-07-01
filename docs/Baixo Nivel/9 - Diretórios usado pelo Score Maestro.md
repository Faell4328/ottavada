# Local

## Diretórios

Diretório **raiz**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro` (Linux).

---

Diretório para os **arquivos temporários**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\temp` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/temp` (Linux).

---

Diretório raiz da **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud` (Linux).
  ! Esse diretório é utilizado para sincronizar com a nuvem

---

Diretório com as partituras **agrupadas** e **compactadas** para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\songs` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/songs` (Linux).

---

Diretório onde fica as **ações** (`events` e `snapshot`) para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\actions` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/actions` (Linux).

---

Diretório onde fica os **backups** para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\backup` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/backup` (Linux).

---

Diretório onde fica as partituras **draft** e **ignored** para não se perder no backup:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\backup_scores_draft_ignored` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/backup_scores_draft_ignored` (Linux).

---

**Diretório das configurações do `rclone`**:

- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\rclone` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/rclone` (Linux).

---

# Nuvem

## Diretórios

É criado uma pasta chamada "ScoreMaestro" na nuvem e é lá que os arquivos são enviados.

É enviado apenas o **diretório cloud**: seu subdiretórios e seus arquivos.