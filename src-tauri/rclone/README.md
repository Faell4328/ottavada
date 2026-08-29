# Rclone Binaries

The rclone binaries here must follow the pattern described below for each platform.

## Windows

Two binaries, one per architecture, with the flow alternating names according to the `tauri:build:win:full` script in `package.json`:

- `rclone64.exe` — x64 build
- `rclone32.exe` — x32 build

The script renames `rclone64.exe` to `rclone.exe` before building x64, then switches to `rclone32.exe` to build x32, and finally restores the original names.

## macOS

Two binaries, one per architecture, with the same flow alternating names according to the `tauri:build:mac:full` script in `package.json`:

- `rclone64` — x64 build
- `rcloneARM` — arm64 build

The script does the same: it switches the active name to `rclone` before each build and restores it at the end.

## Linux

Straightforward, no renaming, just a single `rclone` binary, since only x64 is supported.