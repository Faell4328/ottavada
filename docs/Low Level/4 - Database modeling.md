# Current SQLite model

This document describes the schema created in `src-tauri/src/infrastructure/database.rs`. Table names are preserved for historical compatibility. Legacy fields and tables must not be removed yet without a migration.

# composer

Table responsible for storing all composers.

| Field | Type          | PK  | FK  | Reference | Required? | Where?             |
| ----- | ------------- | --- | --- | --------- | --------- | ------------------ |
| id    | text (`uuid`) | Yes | No  | No        | Yes       | Client / Server    |
| name  | text          | No  | No  | No        | Yes       | Client / Server    |

# composerSongs

| Field      | Type          | PK  | FK  | Reference   | Required? | Where?             |
| ---------- | ------------- | --- | --- | ----------- | --------- | ------------------ |
| id         | text (`uuid`) | Yes | No  | No          | Yes       | Client / Server    |
| composerId | text (`uuid`) | No  | Yes | composer.id | Yes       | Client / Server    |
| songId     | text (`uuid`) | No  | Yes | songs.id    | Yes       | Client / Server    |

# arranger

Table responsible for storing all arrangers.

| Field | Type          | PK  | FK  | Reference | Required? | Where?             |
| ----- | ------------- | --- | --- | --------- | --------- | ------------------ |
| id    | text (`uuid`) | Yes | No  | No        | Yes       | Client / Server    |
| name  | text          | No  | No  | No        | Yes       | Client / Server    |

# arrangerSongs

| Field      | Type          | PK  | FK  | Reference   | Required? | Where?             |
| ---------- | ------------- | --- | --- | ----------- | --------- | ------------------ |
| id         | text (`uuid`) | Yes | No  | No          | Yes       | Client / Server    |
| arrangerId | text (`uuid`) | No  | Yes | arranger.id | Yes       | Client / Server    |
| songId     | text (`uuid`) | No  | Yes | songs.id    | Yes       | Client / Server    |

# categories

Table responsible for storing all categories.

| Field | Type          | PK  | FK  | Reference | Required? | Where?             |
| ----- | ------------- | --- | --- | --------- | --------- | ------------------ |
| id    | text (`uuid`) | Yes | No  | No        | Yes       | Client / Server    |
| name  | text          | No  | No  | No        | Yes       | Client / Server    |

# categoriesSongs

Table responsible for storing all relations between categories and songs (N:N).

| Field      | Type          | PK  | FK  | Reference     | Required? | Where?             |
| ---------- | ------------- | --- | --- | ------------- | --------- | ------------------ |
| id         | text (`uuid`) | Yes | No  | No            | Yes       | Client / Server    |
| categoryId | text (`uuid`) | No  | Yes | categories.id | Yes       | Client / Server    |
| songId     | text (`uuid`) | No  | Yes | songs.id      | Yes       | Client / Server    |

# songs

Table responsible for storing song information.

| Field       | Type                             | PK  | FK  | Reference | Required? | Where?             |
| ----------- | -------------------------------- | --- | --- | --------- | --------- | ------------------ |
| id          | text (`uuid`)                    | Yes | No  | No        | Yes       | Client / Server    |
| name        | text                             | No  | No  | No        | Yes       | Client / Server    |
| composer    | text                             | No  | No  | No        | No        | Client / Server    |
| arranger    | text                             | No  | No  | No        | No        | Client / Server    |
| is_favorite | bool                             | No  | No  | No        | No        | Client / Server    |
| path        | text                             | No  | No  | No        | Yes       | Server             |
| status      | (`main`, `draft` or `not_found`) | No  | No  | No        | Yes       | Server             |

- `path` - directory where the scores are being indexed.

# scores

Table responsible for storing score information.

| Field           | Type                          | PK  | FK  | Reference | Required? | Where?             |
| --------------- | ----------------------------- | --- | --- | --------- | --------- | ------------------ |
| id              | text (`uuid`)                 | Yes | No  | No        | Yes       | Client / Server    |
| song_id         | text (`uuid`)                 | No  | Yes | songs.id  | Yes       | Client / Server    |
| name            | text                          | No  | No  | No        | No        | Client / Server    |
| file_path       | text                          | No  | No  | No        | Yes       | Server             |
| file_name       | text                          | No  | No  | No        | Yes       | Server             |
| file_extension  | text                          | No  | No  | No        | Yes       | Client / Server    |
| file_size       | integer                       | No  | No  | No        | Yes       | Server             |
| file_modified_at| text                          | No  | No  | No        | Yes       | Server             |
| status          | (`main`, `draft` or `ignored`)| No  | No  | No        | Yes       | Server             |

- `file_path` - directory where the score file is stored.

- `file_name` - file name and extension, e.g.: `flauta.mus`.

- `file_modified_at` - timestamp of the file's last modification.

- `file_size` - file size.

# changes

Table responsible for storing all changes (insertions, updates and removals) until they are consolidated into a snapshot. The `events.msgpack.zst` file is generated *from* this table, but its generation does not clear the records; only the snapshot consolidation (`clear_changed_fields_before`) removes the entries already covered by the snapshot.

| Field     | Type                                                                                                              | PK  | FK  | Reference | Required? | Where?  |
| --------- | ----------------------------------------------------------------------------------------------------------------- | --- | --- | --------- | --------- | ------- |
| id        | text (`uuid`)                                                                                                     | Yes | No  | No        | Yes       | Server  |
| type      | (`insert`, `update` or `delete`)                                                                                  | No  | No  | No        | Yes       | Server  |
| entity    | (`categories`, `categoriesSongs`, `composer`, `composerSongs`, `arranger`, `arrangerSongs`, `songs` or `scores`) | No  | No  | No        | Yes       | Server  |
| entityId  | text (`uuid`)                                                                                                     | No  | Yes | entity.id | Yes       | Server  |
| field     | text                                                                                                              | No  | No  | No        | No        | Server  |
| value     | text                                                                                                              | No  | No  | No        | No        | Server  |
| timestamp | integer                                                                                                           | No  | No  | No        | Yes       | Server  |

- `type` - what was done: inserted, updated or deleted.

- `entity` - the name of the table that was changed.

- `entityId` - the id of the element of the table that was changed.

- `field` - the name of the field that was changed in the table.

- `value` - the value that was inserted or updated.

# backupQueue

This table is responsible for controlling the generation of the `{songId}.tar.zst` and ensuring that all of them have been uploaded to the cloud.

| Field  | Type                              | PK  | FK  | Reference | Required? | Where?  |
| ------ | --------------------------------- | --- | --- | --------- | --------- | ------- |
| songId | text (`uuid`)                     | Yes | Yes | songs.id  | Yes       | Server  |
| status | (`pending`, `processing` and `ok`)| No  | No  | No        | Yes       | Server  |

- `status`:

  - `pending` - the song is ready to be grouped and compressed.

  - `processing` - the song has been grouped and compressed, ready to be sent to the cloud.

  - `ok` - the song has already been sent to the cloud.

Computer information (computer name, organization, type, version, OS, architecture) is not stored in the database; it is consulted from the persistent settings file (`SystemStore`, see `6 - tauri store modeling.md`).

# errors

Table responsible for storing all errors.

| Field     | Type          | PK  | FK  | Reference | Required? | Where?             |
| --------- | ------------- | --- | --- | --------- | --------- | ------------------ |
| id        | text (`uuid`) | Yes | No  | No        | Yes       | Client / Server    |
| message   | text          | No  | No  | No        | Yes       | Client / Server    |
| timestamp | integer       | No  | No  | No        | Yes       | Client / Server    |
