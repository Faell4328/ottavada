**For simplicity, the documentation uses JSON in the examples, but the real file is a MessagePack compressed with Zstandard (`.msgpack.zst`).**

The names below are the current serialized representation. The full backup has its own schema and must not be inferred only from the snapshot and event examples.

# 1. snapshot.msgpack.zst

A simplified example of the structure.

```json
{
    "generatedAt": 1710684000,
    "categories": [
        {
            "id": "uuid-category-1",
            "name": "Classical"
        }
    ],
    "categoriesSongs": [
        {
            "id": "uuid-relation-1",
            "categoryId": "uuid-category-1",
            "songId": "uuid-song-1"
        }
    ],
    "composers": [
        {
            "id": "uuid-composer-1",
            "name": "Ludwig van Beethoven"
        }
    ],
    "composerSongs": [
        {
            "id": "uuid-relation-2",
            "composerId": "uuid-composer-1",
            "songId": "uuid-song-1"
        }
    ],
    "arrangers": [
        {
            "id": "uuid-arranger-1",
            "name": "Nikolai Rimsky-Korsakov"
        }
    ],
    "arrangerSongs": [
        {
            "id": "uuid-relation-3",
            "arrangerId": "uuid-arranger-1",
            "songId": "uuid-song-1"
        }
    ],
    "songs": [
        {
            "id": "uuid-song-1",
            "name": "National Anthem",
            "scores": [
                {
                    "id": "uuid-score-1",
                    "songId": "uuid-song-1",
                    "name": "Flute 1",
                    "fileExtension": ".musx"
                }
            ]
        }
    ]
}
```

---

# 2. events.msgpack.zst

The events are stored in ascending order of `timestamp`. When two events have the same timestamp, they are ordered by the event's `id`. New records are appended to the end.

Each event has its own `id`, but the client currently persists and uses `last_change_timestamp` as the synchronization cursor. Therefore, all events with a timestamp greater than the last applied timestamp are processed together. The ordering by `timestamp` and `id` must be preserved in the file to ensure deterministic application within that set.

The event's `id` does not replace the timestamp cursor in the client's local state.

---

## 2.1. Category

Uses the `type`: `insert`, `update` and `delete`.

### 2.1.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-1",
            "timestamp": 1710685000,
            "type": "insert",
            "entity": "categories",
            "entityId": "uuid-category-1",
            "data": [
                {
                    "field": "name",
                    "value": "Classical"
                }
            ]
        }
    ]
}
```

### 2.1.2. Update

```json
{
    "events": [
        {
            "id": "uuid-event-2",
            "timestamp": 1710685001,
            "type": "update",
            "entity": "categories",
            "entityId": "uuid-category-1",
            "data": [
                {
                    "field": "name",
                    "value": "Classical 1"
                }
            ]
        }
    ]
}
```

### 2.1.3. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-3",
            "timestamp": 1710685002,
            "type": "delete",
            "entity": "categories",
            "entityId": "uuid-category-1"
        }
    ]
}
```

## 2.2. Category-song relation

Uses the `type`: `insert` and `delete`.

### 2.2.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-4",
            "timestamp": 1710685003,
            "type": "insert",
            "entity": "categoriesSongs",
            "entityId": "uuid-relation-1",
            "data": [
                {
                    "field": "categoryId",
                    "value": "uuid-category-1"
                },
                {
                    "field": "songId",
                    "value": "uuid-song-1"
                }
            ]
        }
    ]
}
```

### 2.2.2. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-5",
            "timestamp": 1710685004,
            "type": "delete",
            "entity": "categoriesSongs",
            "entityId": "uuid-relation-1"
        }
    ]
}
```

## 2.3. Composers

Uses the `type`: `insert`, `update` and `delete`.

### 2.3.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-6",
            "timestamp": 1710685005,
            "type": "insert",
            "entity": "composers",
            "entityId": "uuid-composer-1",
            "data": [
                {
                    "field": "name",
                    "value": "Ludwig van Beethoven"
                }
            ]
        }
    ]
}
```

### 2.3.2. Update

```json
{
    "events": [
        {
            "id": "uuid-event-7",
            "timestamp": 1710685006,
            "type": "update",
            "entity": "composers",
            "entityId": "uuid-composer-1",
            "data": [
                {
                    "field": "name",
                    "value": "Beethoven"
                }
            ]
        }
    ]
}
```

### 2.3.3. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-8",
            "timestamp": 1710685007,
            "type": "delete",
            "entity": "composers",
            "entityId": "uuid-composer-1"
        }
    ]
}
```

## 2.4. Composer-song relation

Uses the `type`: `insert` and `delete`.

### 2.4.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-9",
            "timestamp": 1710685008,
            "type": "insert",
            "entity": "composerSongs",
            "entityId": "uuid-relation-2",
            "data": [
                {
                    "field": "composerId",
                    "value": "uuid-composer-1"
                },
                {
                    "field": "songId",
                    "value": "uuid-song-1"
                }
            ]
        }
    ]
}
```

### 2.4.2. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-10",
            "timestamp": 1710685009,
            "type": "delete",
            "entity": "composerSongs",
            "entityId": "uuid-relation-2"
        }
    ]
}
```

## 2.5. Arrangers

Uses the `type`: `insert`, `update` and `delete`.

### 2.5.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-11",
            "timestamp": 1710685010,
            "type": "insert",
            "entity": "arrangers",
            "entityId": "uuid-arranger-1",
            "data": [
                {
                    "field": "name",
                    "value": "Nikolai Rimsky-Korsakov"
                }
            ]
        }
    ]
}
```

### 2.5.2. Update

```json
{
    "events": [
        {
            "id": "uuid-event-12",
            "timestamp": 1710685011,
            "type": "update",
            "entity": "arrangers",
            "entityId": "uuid-arranger-1",
            "data": [
                {
                    "field": "name",
                    "value": "Korsakov"
                }
            ]
        }
    ]
}
```

### 2.5.3. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-13",
            "timestamp": 1710685012,
            "type": "delete",
            "entity": "arrangers",
            "entityId": "uuid-arranger-1"
        }
    ]
}
```

## 2.6. Arranger-song relation

Uses the `type`: `insert` and `delete`.

### 2.6.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-14",
            "timestamp": 1710685013,
            "type": "insert",
            "entity": "arrangerSongs",
            "entityId": "uuid-relation-3",
            "data": [
                {
                    "field": "arrangerId",
                    "value": "uuid-arranger-1"
                },
                {
                    "field": "songId",
                    "value": "uuid-song-1"
                }
            ]
        }
    ]
}
```

### 2.6.2. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-15",
            "timestamp": 1710685014,
            "type": "delete",
            "entity": "arrangerSongs",
            "entityId": "uuid-relation-3"
        }
    ]
}
```

## 2.7. Songs

Uses the `type`: `insert`, `update` and `delete`.

### 2.7.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-16",
            "timestamp": 1710685015,
            "type": "insert",
            "entity": "songs",
            "entityId": "uuid-song-1",
            "data": [
                {
                    "field": "name",
                    "value": "National Anthem"
                },
                {
                    "field": "path",
                    "value": "C:/Repertoire/National Anthem"
                }
            ]
        }
    ]
}
```

### 2.7.2. Update

```json
{
    "events": [
        {
            "id": "uuid-event-17",
            "timestamp": 1710685016,
            "type": "update",
            "entity": "songs",
            "entityId": "uuid-song-1",
            "data": [
                {
                    "field": "name",
                    "value": "National Anthem ##"
                }
            ]
        }
    ]
}
```

### 2.7.3. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-18",
            "timestamp": 1710685017,
            "type": "delete",
            "entity": "songs",
            "entityId": "uuid-song-1"
        }
    ]
}
```

## 2.8. Scores

Uses the `type`: `insert`, `update` and `delete`.

### 2.8.1. Insert

```json
{
    "events": [
        {
            "id": "uuid-event-19",
            "timestamp": 1710685018,
            "type": "insert",
            "entity": "scores",
            "entityId": "uuid-score-1",
            "data": [
                {
                    "field": "songId",
                    "value": "uuid-song-1"
                },
                {
                    "field": "name",
                    "value": "Flute 1"
                },
                {
                    "field": "fileExtension",
                    "value": ".musx"
                }
            ]
        }
    ]
}
```

### 2.8.2. Update

```json
{
    "events": [
        {
            "id": "uuid-event-20",
            "timestamp": 1710685019,
            "type": "update",
            "entity": "scores",
            "entityId": "uuid-score-1",
            "data": [
                {
                    "field": "songId",
                    "value": "uuid-song-1"
                },
                {
                    "field": "name",
                    "value": "Flute 1 (Solo)"
                },
                {
                    "field": "fileExtension",
                    "value": ".musx"
                }
            ]
        }
    ]
}
```

### 2.8.3. Delete

```json
{
    "events": [
        {
            "id": "uuid-event-21",
            "timestamp": 1710685020,
            "type": "delete",
            "entity": "scores",
            "entityId": "uuid-score-1"
        }
    ]
}
```

---

# 3. backup.msgpack.zst

Full export of the **Manage** mode database, used for backup, migration and replication between servers. Unlike the snapshot, it is not intended for client synchronization: it also includes `draft`, `ignored` and `not_found` records, as well as the server's `settings` (including the `rclone` configuration) and the pending `changes` log.

A simplified example of the structure:

```json
{
    "schema_version": 1,
    "generated_at": 1710684000,
    "settings": {
        "computer_id": "uuid-server-a",
        "computer_name": "Server A",
        "computer_type": "server",
        "rclone_config": null
    },
    "categories": [
        {
            "id": "uuid-category-1",
            "name": "Classical"
        }
    ],
    "songs": [
        {
            "id": "uuid-song-1",
            "name": "National Anthem",
            "composer": "Ludwig van Beethoven",
            "arranger": "Nikolai Rimsky-Korsakov",
            "path": "C:/Repertoire/National Anthem",
            "is_favorite": true
        }
    ],
    "scores": [
        {
            "id": "uuid-score-1",
            "song_id": "uuid-song-1",
            "name": "Flute 1",
            "file_path": "C:/Repertoire/National Anthem",
            "file_name": "flute1.musx",
            "file_size": 1234,
            "file_modified_at": "2026-01-01 12:00:00",
            "status": "main"
        }
    ],
    "categoriesSongs": [
        {
            "id": "uuid-relation-1",
            "category_id": "uuid-category-1",
            "song_id": "uuid-song-1"
        }
    ],
    "changes": [
        {
            "id": "uuid-change-1",
            "type": "update",
            "entity": "scores",
            "entityId": "uuid-score-1",
            "field": "status",
            "value": "main",
            "timestamp": 1710685000
        }
    ],
    "backupQueue": [
        {
            "id": "uuid-song-1",
            "song_id": "uuid-song-1",
            "status": "ok",
            "last_backup_at": null,
            "error_message": null
        }
    ]
}
```

## 3.1. Fields

- `schema_version` - schema version of the backup (currently `1`).
- `generated_at` - timestamp of the generation.
- `settings` - the server's `AppSettings`, including the `rclone` configuration.
- `categories` - all categories (`id`, `name`).
- `songs` - all songs (`id`, `name`, `composer`, `arranger`, `path`, `is_favorite`). Composers and arrangers are stored denormalized as names on each song; there are no separate `composer`/`arranger` entities in the backup.
- `scores` - all scores (`id`, `song_id`, `name`, `file_path`, `file_name`, `file_size`, `file_modified_at`, `status`).
- `categoriesSongs` - relations between categories and songs.
- `changes` - the pending change log (the `changes` table) captured at the moment of generation.
- `backupQueue` - the state of the song backup queue.

> **Note about `changes`:** because the backup includes the `changes` table, which accumulates every edit until it is consolidated into a snapshot, the backup file size varies over time — it is larger just before a snapshot and smaller just after — and does not reflect only the amount of songs, scores and categories.
