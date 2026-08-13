The project can be developed on Windows, Linux and macOS. The steps below cover the Windows environment; the build commands available for other platforms are in `package.json`.

# Installation and configuration on Windows

> This guide still needs a full review for Linux and macOS. The commands below were checked against the current `package.json` scripts.

1st Download Git: https://git-scm.com/install/windows

2nd Download Rust: https://rust-lang.org/tools/install/

3rd Download Node: https://nodejs.org/pt-br/download

4th Download Rclone: https://rclone.org/downloads/

- You must download according to your CPU architecture.

4th After downloading and extracting rclone, place the corresponding executable in `src-tauri/rclone/`. On Windows, the expected name is `rclone.exe`.

5th In the project root directory, run: `npm install` or `npm i`.

6th If you intend to compile the project, it is recommended to download:

- `rustup target add i686-pc-windows-msvc` - if your computer is `x32`.

- `rustup target add x86_64-pc-windows-msvc` - if your computer is `x64`.

## Update



The update uses Tauri's native mechanism. To generate the private and public keys, run the command: `tauri signer generate`. You will be asked to provide a password. After providing it, the public and private keys will be generated.

Then, add the keys in the following places:

- In the `.env` file

- In the `tauri.config.json` file

## Self-signed

The application uses a self-signed signature.

**If you have the .pfx**:

1. Open it and install it on your computer.

2. Then open it at: `certmgr.msc` > personal > certificates > Open the certificate > Details > Thumbprint.

3. Based on what was returned, add it to `tauri.config.json`, in the field: `certificateThumbprint`.

**If you don't have the .pfx**:

1. Simply remove the lines:

```json
"certificateThumbprint": "04f52bc09d3206c1938b96532d251cacc78adcce",
"digestAlgorithm": "sha256",
"timestampUrl": "http://timestamp.digicert.com",
```

---

# Commands

**Run**

- `npm run tauri:win` - This command runs the application in Dev mode.

**Test**

- `npm run test:front` - This command runs all Front tests.

- `npm run test:back` - This command runs all Back tests.

- `npm run test:full` - Runs the Front and Back tests.

**Build**

- `npm run tauri:build:win:x64` - Builds the project for Windows x64.

- `npm run tauri:build:win:x32` - Builds the project for Windows x32.
