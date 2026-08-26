# Installation and configuration

> This guide covers Windows, Linux and macOS. Follow the steps for your operating system.

---

## Required adjustments

Before following the OS-specific instructions, apply these changes to `src-tauri/tauri.conf.json`:

### 1. Disable updater artifacts

Since you don't have a certificate to self-sign, set `"createUpdaterArtifacts"` to `false`:

```json
"bundle": {
  "createUpdaterArtifacts": false
}
```

### 2. Set the `resources` field

The default points to `rclone/rclone.exe` (Windows only). Change it to match your OS:

| OS | Value |
|---|---|
| Windows | `"resources": ["rclone/rclone.exe"]` |
| Linux | `"resources": ["rclone/rclone"]` |
| macOS | `"resources": ["rclone/rclone"]` |

---

## `.env` setup

Rename `src-tauri/.env.exemple` to `src-tauri/.env`. The default values are enough to run the app — these fields are optional and only needed for features like telemetry and auto-updates.

---

## Commands

### Run

| Command | Description |
|---|---|
| `npm run tauri:win` | Run in dev mode on Windows |
| `npm run tauri:mac` | Run in dev mode on macOS |
| `npm run tauri:linux` | Run in dev mode on Linux |

### Test

| Command | Description |
|---|---|
| `npm run test:front` | Run all frontend tests |
| `npm run test:back` | Run all backend tests |
| `npm run test:full` | Run frontend and backend tests |

### Build

| Command | Target |
|---|---|
| `npm run tauri:build:win:x64` | Windows x64 |
| `npm run tauri:build:win:x32` | Windows x32 |
| `npm run tauri:build:mac:x64` | macOS x64 (Intel) |
| `npm run tauri:build:mac:arm64` | macOS arm64 (Apple Silicon) |
| `npm run tauri:build:linux:x64` | Linux x64 (AppImage) |

---

# Windows

### 1. Microsoft C++ Build Tools

Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/

Select the **"Desktop development with C++"** workload during installation.

### 2. Git

Download: https://git-scm.com/install/windows

### 3. Rust

Download: https://rust-lang.org/tools/install/

### 4. Node.js

Download: https://nodejs.org/en/download

### 5. Rclone

Download: https://rclone.org/downloads/

> Choose the version matching your CPU architecture.

After downloading and extracting, place the executable in `src-tauri/rclone/`. The expected name is `rclone.exe`.

### 6. Install dependencies

In the project root directory, run:

```bash
npm install
```

### 7. Add build target (optional)

If you intend to compile the project:

```bash
rustup target add i686-pc-windows-msvc    # x32
rustup target add x86_64-pc-windows-msvc  # x64
```

---

# Linux

### 1. System dependencies

Install the packages required by Tauri (webkit2gtk, etc.):

<details>
<summary><b>Debian / Ubuntu</b></summary>

```bash
sudo apt update && sudo apt install -y \
  git curl wget file build-essential \
  libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

</details>

<details>
<summary><b>Fedora</b></summary>

```bash
sudo dnf install -y \
  git curl wget file \
  webkit2gtk4.1-devel openssl-devel \
  libappindicator-gtk3-devel librsvg2-devel
```

</details>

<details>
<summary><b>Arch</b></summary>

```bash
sudo pacman -S --needed \
  git curl wget base-devel \
  webkit2gtk-4.1 openssl \
  libappindicator-gtk3 librsvg
```

</details>

### 2. Node.js

Install via [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 26.4.0
```

### 3. Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 4. Rclone

Download: https://rclone.org/downloads/

> Choose the version for your CPU architecture (usually `x86_64`).

After downloading and extracting, place the binary in `src-tauri/rclone/`. The expected name is `rclone` (no extension). Make it executable:

### 5. Install dependencies

In the project root directory, run:

```bash
npm install
```

### 6. Add build target (optional)

If you intend to compile the project:

```bash
rustup target add x86_64-unknown-linux-gnu
```

---

# macOS

### 1. Xcode Command Line Tools

```bash
xcode-select --install
```

### 2. Git

Download: https://git-scm.com/install/mac

### 3. Rust

Download: https://rust-lang.org/tools/install/

### 4. Node.js

Download: https://nodejs.org/en/download

### 5. Rclone

Download: https://rclone.org/downloads/

> Choose `x86_64` for Intel or `aarch64` for Apple Silicon.

After downloading and extracting, place the binary in `src-tauri/rclone/`. The expected name is `rclone` (no extension). Make it executable:

### 6. Install dependencies

In the project root directory, run:

```bash
npm install
```

### 7. Add build target (optional)

If you intend to compile the project:

```bash
rustup target add x86_64-apple-darwin    # Intel
rustup target add aarch64-apple-darwin   # Apple Silicon
```
