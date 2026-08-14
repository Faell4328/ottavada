```json
{
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "computerName": "Faell",
    "organizationName": "Sei la",
    "type": "client or server",
    "language": "en",
    "first_run_completed": false,
    "rclone": {
        "provider": "koofr, google_drive, dropbox, onedrive, pcloud, sftp or webdav"
    },
    "cloud": {
        "lastSnapshotTimestamp": 14821049124,
        "lastChangeTimestamp": 12903812039,
        "lastBackupTimestamp": 12903812903
    },
    "database_local": 0,
    "backup_database_step": null,
    "backup_songs_step": null
}
```

The names above reflect the keys currently persisted. The backup fields are optional and may not exist in old installations. The keys are written by `SystemStore` (`src-tauri/src/infrastructure/store.rs`, `save_app_settings`) and the persisted file is sorted alphabetically by `serde_json`.

Writes are serialized by a process-wide `Mutex` (`store_lock`) to avoid concurrent read-modify-write operations overwriting each other.
