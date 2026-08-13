The server will be a simple PHP and SQLite.

To protect against bots, it will be necessary to send an API key that lives inside the application and is sent in the request.

The current website is `https://ottavada.com`, previously: `https://scoremaestro.rhafaell.com.br`.

## Route

**User**
`GET /update.json` - returning the `.json` with the information for the application update.

```json
{
    "version": "1.3.0",
    "notes": "Migration to Ottavada and multi-language support",
    "pub_date": "2026-08-02T18:00:00Z",
    "platforms": {
        "windows-x86_64": {
            "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUVGUxSzBnd2RES3dNQ3NhYkpVczM5L3FJY2k1RWZ4ZThyM2JKWlp4RkVSMjFRVjU5SHBaczJaQjhvYmRLR1VUcCtrMWxQTUhNVTBlR3lrNzRRdjVvVnFVQmY4UEJuUkE0PQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg1NzA0MTU3CWZpbGU6T3R0YXZhZGFfMS4zLjBfeDY0LXNldHVwLmV4ZQpneW8yR2JqRVRxbzM4VkoycTBseFRtemVrNkV6RW9qZ3dCakVoMXBhaEhiOUs2MGpUZk81MEpScmhjYzNnVGRvQnlSUjd2NUtzTjRvREFBUmZ6KzBDUT09Cg==",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_x64-setup.exe"
        },
        "windows-i686": {
            "signature": "SIGNATURE_X86",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v0.11/Ottavada_0.11.0_x86-setup.exe"
        },
        "linux-x86_64": {
            "signature": "SIGNATURE_LINUX_X64",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_1.3.0_x86_64.AppImage"
        },
        "darwin-x86_64": {
            "signature": "SIGNATURE_MACOS_X64",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_1.3.0_x64.dmg"
        },
        "darwin-aarch64": {
            "signature": "SIGNATURE_MACOS_ARM",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_1.3.0_aarch64.dmg"
        }
    }
}
```

**Download files**: They live in `releases` on GitHub.

# Telemetry

The telemetry route is another one: `https://servidor.ottavada.com`, this happens because it is sent to my homelab which is not always on. If a send fails, Ottavada does not present any problem and later resends what failed.

It must send the `Token` parameter in the `header`, so the server accepts the telemetry.

`POST /telemetry` - to send telemetry data.

```json
// Example of telemetry sent
{
    "computerId": "computer id", // Unique computer ID (persisted in tauri-plugin-store)
    "type": "server", // Usage mode: "server" (Manage mode) or "client" (Consult mode)
    "language": "en", // Language used in the system
    "appVersion": "0.9.1", // Running application version
    "os": "windows", // Operating system (windows, linux, etc)
    "arch": "x64", // System architecture (x32 or x64)
    "musicCount": 120, // Total songs registered in the local database
    "musicMain": 100, // Number of songs with "main" status (valid and synchronized)
    "musicDraft": 15, // Number of draft songs (not synchronized)
    "scoresCount": 980, // Total registered scores
    "scoresMain": 850, // Number of scores with "main" status (valid and synchronized)
    "scoresDraft": 80, // Number of draft scores (not synchronized)
    "errors": [
        {
            "id": "uuid",
            "date": "2026-04-12",
            "message": "error compressing file", // Message of the error that occurred
            "timestamp": 1710684000 // When the error happened (epoch)
        }
    ]
}
```
