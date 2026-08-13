# Local

## Diretórios

Diretório **raiz**:

- `C:\Users\<user>\AppData\Roaming\ottavada\` (Windows).
- `/home/<user>/.local/share/ottavada` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/` (macOS).

Os arquivos de log rotativos são gravados diretamente nesse diretório, com o nome `ottavada.log`. Eles não são gravados no diretório do projeto ou da instalação.

---

Diretório para os **arquivos temporários**:

- `C:\Users\<user>\AppData\Roaming\ottavada\temp` (Windows).
- `/home/<user>/.local/share/ottavada/temp` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/temp` (macOS).

---

Diretório raiz da **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud` (Windows).
- `/home/<user>/.local/share/ottavada/cloud` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud` (macOS).
  > **Nota:** Esse diretório é utilizado para sincronizar com a nuvem.

---

Diretório com as partituras **agrupadas** e **compactadas** para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\songs` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/songs` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/songs` (macOS).

---

Diretório onde fica as **ações** (`events` e `snapshot`) para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\actions` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/actions` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/actions` (macOS).

---

Diretório onde fica os **backups** para serem enviados a **nuvem**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\backup` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/backup` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/backup` (macOS).

---

Diretório onde fica as partituras **draft** e **ignored** para não se perder no backup:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\backup_scores_draft_ignored` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/backup_scores_draft_ignored` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/backup_scores_draft_ignored` (macOS).

---

**Diretório das configurações do `rclone`**:

- `C:\Users\<user>\AppData\Roaming\ottavada\rclone` (Windows).
- `/home/<user>/.local/share/ottavada/rclone` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/rclone` (macOS).

---

# Nuvem

## Diretórios

É criado uma pasta chamada "ottavada" na nuvem e é lá que os arquivos são enviados.

É enviado apenas o **diretório cloud**: seu subdiretórios e seus arquivos.
