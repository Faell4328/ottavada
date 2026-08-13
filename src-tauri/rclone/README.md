# IMPORTANT

The build scripts prepare the `rclone` file before the build:

- Windows: copies `rclone64.exe` or `rclone.exe` to `rclone`.
- macOS/Linux: expects the Unix binary in `rclone`.

The `rclone` file is ignored by Git because it is a platform-specific binary.
