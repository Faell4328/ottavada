# Local

## Diretórios

Diretório **raiz**:

- `C:\Users\<user>\AppData\Roaming\ottavada\` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada` (Linux).

---

Diretório para os **arquivos temporários**:

- `C:\Users\<user>\AppData\Roaming\ottavada\temp` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/temp` (Linux).

---

Diretório raiz da **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/cloud` (Linux).
  ! Esse diretório é utilizado para sincronizar com a nuvem

---

Diretório com as partituras **agrupadas** e **compactadas** para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\songs` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/cloud/songs` (Linux).

---

Diretório onde fica as **ações** (`events` e `snapshot`) para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\actions` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/cloud/actions` (Linux).

---

Diretório onde fica os **backups** para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\backup` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/cloud/backup` (Linux).

---

Diretório onde fica as partituras **draft** e **ignored** para não se perder no backup:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\backup_scores_draft_ignored` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/cloud/backup_scores_draft_ignored` (Linux).

---

**Diretório das configurações do `rclone`**:

- `C:\Users\<user>\AppData\Roaming\ottavada\rclone` (Windows).
- `/home/<user>/.local/share/com.rhafa.ottavada/rclone` (Linux).

---

# Nuvem

## Diretórios

É criado uma pasta chamada "ottavada" na nuvem e é lá que os arquivos são enviados.

É enviado apenas o **diretório cloud**: seu subdiretórios e seus arquivos.
