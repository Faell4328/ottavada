# 1. Languages

The application must support the following languages:

- Portuguese;
- English;
- Spanish;
- French;
- Italian;
- German.

# 2. Categories

## 2.1. Association

A song can have between **0 and N categories**.

When no category is defined, the **No category** category must be automatically assigned.

## 2.2. "No category" category

The **no category** category:

- cannot be edited;
- cannot be removed;
- must be automatically assigned when no category is assigned to the song.

---

# 3. Supported extensions

The system must accept the following formats: `.pdf`, `.mus`, `.musx`, `.mscx`, `.mscz`, `.xml`, `.musicxml`, `.sib`, `.enc`, `.dorico`, `.mid` and `.midi`.

---

# 4. Supported operating systems

The system must support the following operating systems:

- Windows 10 and 11 (`EXE`, x32 and x64);
- Linux (`AppImage`, x64);
- Mac (`DMG`, x64 and xARM).

---

# 5. Consult mode

## 5.1. Storing scores locally

Downloaded scores must remain compressed and may only be uncompressed into temporary directories when they are opened.

---

# 6. Rclone

`rclone` must be executed using:

```
rclone sync source destination --rc --rc-addr=127.0.0.1:5572
```

The parameter is necessary for checking and displaying progress.

The `rclone check` command must not be used.

---

# 7. Security

The system must:

- be fault tolerant;
- validate preconditions before executing any operation;
- present clear information to the user about the operations performed.

## 7.1. Logs

- Logs must be kept for **30 days**. The telemetry error queue has its own retention and must not be confused with log files.

- Logs must be stored in the Ottavada user data directory, described in `Directories used by Ottavada.md`, and never in the project or installation directory.

## 7.2. Deletion

The system must ask for confirmation before permanently removing any item.

---

# 8. Ottavada server

## 8.1. Telemetry

In case of sending failure: no visible notification must be shown to the user.

In case of success: the `errors` table must be cleared.

## 8.2. Updates

The user must be able to postpone the update.

- If the user postpones: a warning (button) must appear, so they can update easily.

---

# 9. Compression

## 9.1. Performance and compression level

All steps must be executed in independent threads to avoid blocking or overloading the main thread.

The `zst` compression must use:

- `-10` for balanced compression;
- `-T0` to use all available cores.

## 9.2. Upload and download to the cloud

All score files with **send allowed** status must be compressed with `zst` before being sent to the cloud.
