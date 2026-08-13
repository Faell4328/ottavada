# Local

## Directories

**Root** directory:

- `C:\Users\<user>\AppData\Roaming\ottavada\` (Windows).
- `/home/<user>/.local/share/ottavada` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/` (macOS).

The rotating log files are written directly to this directory, with the name `ottavada.log`. They are not written to the project or installation directory.

---

Directory for the **temporary files**:

- `C:\Users\<user>\AppData\Roaming\ottavada\temp` (Windows).
- `/home/<user>/.local/share/ottavada/temp` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/temp` (macOS).

The backend also uses `tmp/` to restore backup files and clears its content during startup or after restoration. `temp/` and `tmp/` are distinct directories in the current code.

---

**Cloud** root directory:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud` (Windows).
- `/home/<user>/.local/share/ottavada/cloud` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud` (macOS).
  > **Note:** This directory is used to synchronize with the cloud.

---

Directory with the scores **grouped** and **compressed** to be sent to the **cloud**:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\songs` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/songs` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/songs` (macOS).

---

Directory where the **actions** (`events` and `snapshot`) to be sent to the **cloud** live:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\actions` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/actions` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/actions` (macOS).

---

Directory where the **backups** to be sent to the **cloud** live:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\backup` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/backup` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/backup` (macOS).

---

Directory where the **draft** and **ignored** scores live so they are not lost in the backup:

- `C:\Users\<user>\AppData\Roaming\ottavada\cloud\backup_scores_draft_ignored` (Windows).
- `/home/<user>/.local/share/ottavada/cloud/backup_scores_draft_ignored` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/cloud/backup_scores_draft_ignored` (macOS).

---

**`rclone` configuration directory**:

- `C:\Users\<user>\AppData\Roaming\ottavada\rclone` (Windows).
- `/home/<user>/.local/share/ottavada/rclone` (Linux).
- `/Users/<user>/Library/Application Support/ottavada/rclone` (macOS).

---

# Cloud

## Directories

A folder called "ottavada" is created in the cloud and that is where the files are sent.

Only the **cloud directory** is sent: its subdirectories and its files.
