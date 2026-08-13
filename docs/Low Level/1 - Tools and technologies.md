# How does it work under the hood?

The exact versions of the dependencies must be checked in `package.json` and `src-tauri/Cargo.toml`. This page describes responsibilities, it does not replace the manifests.

The system uses `Tauri` underneath everything. The interface lives in the frontend and the file, database and native integration routines live in the Rust backend.

# 1. Front

- `React` and `TypeScript` - build the interface and keep the components typed.
- `Vite` - provides the development server and the fast build of the web application.

## 1.1. Front dependencies

- `@tauri-apps/api` - bridge between the frontend and Tauri's native APIs.
- `@tauri-apps/plugin-dialog` - opens native file and folder selection boxes.
- `dotenv-cli` - loads environment variables in local scripts.
- `lucide-react` - provides ready-made icons for the interface.
- `react-hot-toast` - shows quick success, error and warning notifications.
- `react-router` - controls navigation between screens and routes.
- `react-i18next` - multi-language support.

## 1.2. Development and testing dependencies

- `@tauri-apps/cli` - compiles and packages the Tauri app in development and release environments.
- `@testing-library/jest-dom` - adds more readable matchers to UI tests.
- `@testing-library/react` - tests React components by behavior.
- `jsdom` - simulates the browser to run tests in Node.
- `tailwindcss` - generates the utility styles used by the frontend.
- `typescript` - performs type checking of the code.
- `vite` - also participates in the build and preview pipeline.
- `vitest` - runs the automated frontend tests.

# 2. Back

- `Rust` - implements the local logic, database access and operating system integration.
- `tauri` - provides the base of the desktop app and the backend runtime.
- `tauri-build` - generates the configuration and files needed to compile the Tauri app.
- `tauri-plugin-updater` - manages the automatic update flow.
- `tauri-plugin-single-instance` - controls the execution of a single instance of the application.
- `tauri-plugin-opener` - opens external resources from the backend.
- `tauri-plugin-dialog` - displays native dialogs to the user.
- `tauri-plugin-shell` - allows executing external commands with controlled security.
- `tauri-plugin-fs` - accesses files and directories from the backend.
- `tauri-plugin-store` - stores local app preferences.
- `tauri-plugin-notification` - triggers native notifications in response to app events.
- `rusqlite` - SQLite access with locally compiled support.
- `chrono` - handles domain and database dates and times.
- `serde`, `serde_json` and `rmp-serde` - serialize and deserialize data and the `MessagePack` files.
- `reqwest` - makes HTTP requests, for example for update checking and network integrations.
- `notify` - watches file system changes.
- `walkdir` - traverses directories safely and predictably.
- `tar` - builds the `.tar` files used in the backup flow.
- `zstd` - compresses the backups into `.zst` to reduce size.
- `fs2` - helps measure free space and disk usage.
- `uuid` - generates unique identifiers for database records and events.
- `url` - validates and manipulates URLs.
- `thiserror` - simplifies the definition of typed errors.
- `tracing` and `tracing-subscriber` - record and organize application logs.
- `tracing-appender` - writes logs to file.
- `windows-sys` - exposes Windows-specific APIs when necessary.
- `trash` - moves files to the system trash.

# 3. Database and files

- `SQLite` - stores the library's local data, backups and app states.
  - `FTS5` - SQLite extension used for faster, more flexible text search.
- `MessagePack` (`.msgpack`) - compact format used in exported and synchronized data.

# 4. Others

- `rclone` - performs the synchronization with the cloud.
- `.tar` + `.zst` - pack and compress the song files for backup.
