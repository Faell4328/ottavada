# Summarized timeline

# Version 0.1

## Features

- fix of interface inconsistencies;
- review of adding and editing songs, scores and favorites;
- addition of the log system.

## Improvements

- removal of interface elements that clutter the experience;
- organization of common actions in the overflow menu;
- validation of the project's dependencies.

## Fixes

- elimination of the unwanted visual selection when clicking on scores/instruments;
- adjustment of the confirmation modal for deletions;
- guarantee of correct log storage in the user directory.

# Version 0.2

## Features

- migration of system information to `tauri-plugin-store`;
- detection of file changes in Rust and in the front;
- implementation of the `draft` -> `main` flow;
- listing of active drafts and review of the status flow;
- start of client/server support.

## Improvements

- update of the database, front and back;
- adjustment of the first access page and the settings;
- review of the confirmation experience in critical changes.

## Fixes

- blocking of repeated clicks on "check changes";
- blocking of undue actions on the client;
- reinforcement of the usage mode change with a modal and countdown.

# Version 0.3

## Features

- generation of `MessagePack` from the database;
- integration of the rclone flow with the cloud;
- update of the first access and settings for the provider;
- saving of the initial configuration in `tauri-plugin-store`.

## Improvements

- migration of cloud files to the correct structure;
- preparation of the test upload and provider validation;
- alignment of the generated database with the new structure.

## Fixes

- review of generated dates and fields;
- adjustment of directory names and `tauri-plugin-store` configuration;
- organization of the text and navigation of the cloud flow.

# Version 0.4

## Features

- cleanup of the base and fix of the existing flows;
- update of the database and `tauri-plugin-store`;
- consolidation of the interface nomenclature.

## Improvements

- replacement of texts to reflect "songs" instead of "scores";
- maintenance of a more coherent interface with the product vision.

## Fixes

- fix of the code that uses database and store;
- validation of the tests after the refactoring.

# Version 0.5

## Features

- generation of `{songId}.tar.zst`;
- recording of `changedField` in all flows;
- generation of `events.msgpack.zst`, `snapshot.msgpack.zst` and `backup.msgpack.zst`;
- export and import of the backup.

## Improvements

- refactoring of the front and back;
- facilitation of future synchronizations;
- reinforcement of the forced snapshot generation in the settings.

## Fixes

- guarantee of the integrity of the exported files;
- adjustment of the import flow to maintain consistency.

# Version 0.6

## Features

- consolidation of rclone in the cloud;
- checking of server changes on the client;
- creation of rules for the read-only client flow;
- cleanup of the temporary directory on startup.

## Improvements

- reduction of toast noise in the checking process;
- ordering of songs and scores;
- improvement of progress and compression in upload/download.

## Fixes

- fix of the undue sending of `draft`;
- adjustment of the real extension of files on the client;
- stabilization of the snapshot generation.

# Version 0.7

## Features

- display of a warning when there is no internet;
- reinforcement of the local and cloud backup flow;
- improvement of the change behavior and file reprocessing.

## Improvements

- reduction of duplicate toasts;
- strengthening of the `StatusBar` with more useful progress;
- improvement of the cloud synchronization.

## Fixes

- fix of the wrong opening of directories;
- fix of snapshot generation and reprocessing;
- guarantee that the app stops rclone when it is closed.

# Version 0.8

## Features

- adjustment of the score display mode;
- strengthening of the change confirmation;
- standardization of song and score names;
- guarantee of the correct ordering of instruments.

## Improvements

- improvement of the user experience when opening, editing and locating files;
- permission of multiple files in the overflow menu;
- reinforcement of the naming and identification logic.

## Fixes

- fix of Windows-specific problems;
- adjustment of the cursor on interactive elements;
- fix of the flow when expanding songs and opening temporary files.

# Version 0.9

## Features

- addition of favorite on the song;
- standardization of local and cloud backup;
- integration of the cloud provider configuration;
- incorporation of the rclone usage into the project.

## Improvements

- display of the number of songs and scores by status;
- improvement of the provider and backup test;
- improvement of the first access and settings.

## Fixes

- adjustment of the automatic snapshot so it does not delete `cloud/songs/`;
- fix of the real StatusBar progress;
- resolution of toast duplication and failures when switching provider.

# Version 0.10

## Features

- display of only songs in the initial list and loading of scores on demand;
- blocking of actions during critical processes;
- handling of song and score duplicates before saving.

## Improvements

- improvement of search, ordering and user feedback;
- simplification of the review and editing flows;
- more stability for the client and server.

## Fixes

- fix of freezes, visual bugs and search inconsistencies;
- adjustment of the StatusBar behavior;
- fix of open score problems and list update.

# Version 0.11

## Features

- addition of the software update flow;
- possibility to postpone an update;
- display of the version in the settings and checking of updates;
- update check when opening the app.

## Improvements

- organization of the update experience on client and server;
- reading of keys and passwords from `.env`.

## Fixes

- prevention of conflicts with the update at the wrong time;
- fix of the visual behavior of the app after updating.

# Version 0.12

## Features

- improvement of the daily backup;
- handling of a score already used in another song;
- prevention of duplicate score names;
- highlighting of pending items before the save button.

## Improvements

- checking of the song and score count without cache;
- reinforcement of the previous status validation;
- alignment of the review modal with the indexing flow.

## Fixes

- adjustment of `open local` and `open score` in the review modal;
- fix of the `{songId}.tar.zst` generation when adding scores;
- guarantee that backup and snapshot go to the cloud correctly.

# Version 0.13

## Features

- consolidation of the front and back refactoring;
- update of `tauri-plugin-store` according to the documentation;
- inclusion of telemetry and client database;
- reorganization of the first access to show the usage mode.

## Improvements

- inclusion of the organization name;
- improvement of the contacts and telemetry flow;
- preparation of the path to v1 with more stability.

## Fixes

- fix of synchronization when applying changes quickly;
- fix of local backup import with snapshot generation;
- locking of navigation after redirecting to home.

# Version 1.0

## Features

- blocking of actions during an available update;
- addition of the organization name on the client;
- inclusion of an introductory video before the first access;
- addition of support contacts.

## Improvements

- improvement of toast messages and the review modal;
- addition of visual feedback on long operations;
- fix of interface inconsistencies.

## Fixes

- fix of Windows instability when applying and checking changes;
- fix of score display when expanding a song;
- adjustment of scrolling with few songs on Windows;
- fix of a cursor bug when editing text in the middle of a line.

# Version 1.1

## Features

- migration of cloud files to the correct structure;
- permission to use a score as a base;
- support for more musical file formats;
- addition of composers and arrangers with autocomplete.

## Improvements

- preservation of the cloud backup when switching providers;
- update of the cloud flow when starting the application;
- organization of the category, composer and arranger filters.

## Fixes

- fix of backup loss problems;
- prevention of multiple app instances;
- review of the upload, checking and cloud integration structure.

# Version 1.2

## Features

- easier editing and deletion of category, composer and arranger;

- added `ignored` status on the score;

- added `main`, `draft` and `not_found` status on the song.

## Improvements

- directory indexing;

- database modeling;

- modeling of the `*.msgpack` files;

- instrument suggestion in the add modal;

- interface improvements;

- replacement of permanent deletion with sending to the trash;

- automatic snapshot generation when the event payload reaches 1 MiB.

## Fixes

- removal of duplications and standardization of fields in `tauri-plugin-store`;

- removal of inconsistencies in the `draft` status;

- removal of manual song creation;

- removal of the "add file(s)" option;

- removal of the `not_found` status on the score.

# Version 1.2.1

## Improvements

- improvement in instrument identification.

# Version 1.3

## Features

- full backup to the cloud, recovering the files locally.

## Improvements

- adding more instruments;
- improving the order of the instruments;
- interface improvements for lay users;
- using relative path to support multiple users.

## Fixes

- changing from "move to trash" to "stop indexing" on `not_found` songs.

# Version 1.4

## Features

- addition of languages: English, Spanish, French, Italian and German;
- support for Linux and macOS;
- addition of cloud providers: Dropbox, OneDrive and pCloud;
- addition of advanced mode providers: SFTP and WebDAV;
- possibility to change the status of changed scores directly in the change report;
- identification of duplicate instruments when checking changes, adding them as ignored.

## Improvements

- new rclone version;
- texts and warnings;
- adding confirmation when clicking "import backup";
- song duplicate checking, before it was only the "name", now it is "name" + "composer" + "arranger";
- indexing of multiple folders at once;
- name of the Ottavada modes;
- removal of the computer name and organization name from telemetry;
- lazy loading to the front-end;
- CSP security;
- removal of unnecessary dependencies (such as `tauri-plugin-store`).

## Fixes

- removing legacy code;
- fixing inconsistency in the song and score count label in the settings;
- changes report;
- migration from Score Maestro to Ottavada;
- fixing inconsistencies between code and documentation.

# Development

## Fixing inconsistencies

**Update the names of the rows in the tables**

**Update the names of the tables and columns**

- [x] Table name: `changedField` -> `changes`
  
- [x] Table name: `songsBackup` -> `backupQueue`
  
- [x] Remove table: `computerInformation` (it is used)
  
- [x] Remove the `hash` row in `scores` (it is not used)
  
- [x] Remove the `last_score_file_modified_at` row in `songs` (it is used)
  
- [x] Remove the `host_id` row from `scores` (it is used)

**Fix code that uses the old name**

**Remove code that uses or creates old tables**

- [x] Use the lock to avoid overwriting the store file (process-wide `Mutex` in `SystemStore`)

- [x] Remove `google_drive_mode` from tauri-plugin-store

- [x] Fix the field names and order in tauri-plugin-store

- [x] Add the option in the overflow menu: "add to favorites" on the client

**Change the button option when opening the song, in the song's overflow menu**

- [x] Close the song/score overflow menu when clicked outside

## Planning

**Build a plan to make migration easier**

**Improve the backup system**
