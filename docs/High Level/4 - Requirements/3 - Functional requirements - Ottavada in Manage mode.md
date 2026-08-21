# 1. Folder indexing

The system must allow indexing folders that contain score files in [supported formats](4%20-%20Non-functional%20requirements.md#3-supported-extensions).

## 1.1. Song name suggestion

During the indexing process, the system must use the directory name as a suggestion for the song name.

**Example:** `National Anthem/` - suggestion: **NATIONAL ANTHEM**.

## 1.2. Instrument suggestion

During the indexing process, the system must use the file name to suggest the instrument associated with the score.

**Examples:**

- `Tuba.mus` - suggestion: **Tuba**
- `National Anthem - Tuba.mus` - suggestion: **Tuba**

If it is not possible to identify the instrument from the file name, the suggestion field must remain empty for manual completion by the user.

## 1.3. Indexing multiple folders

The system must allow selecting more than one folder at a time when indexing.

The confirmation modal must open one folder at a time, in the order in which the folders were selected:

- **confirming** a folder adds it and advances to the next one;
- **canceling** a folder skips it and advances to the next one;
- **closing (X)** cancels the current folder and all remaining ones.

## 1.4. Order of the scores

It must be the same order as in **Functional requirements - both** under **Listing order in the song**.

---

# 2. Songs

## 2.1. Song name

The song name must always be written with all letters in uppercase.

Example: `National Anthem` must be stored and displayed as `NATIONAL ANTHEM`.

## 2.2. Available operations

### 2.2.1. Songs with "send allowed" status

The user must be able to:

- **open**, expands the song and shows all its scores;
- **open local**, opens the indexed folder of that song in the file explorer;
- **add/remove from favorites**;
- **edit** the song information, including:
  - name;
  - composer;
  - arranger;
  - categories;
- **disallow sending**, changing the status of the song and scores to `draft`;
- **remove song**, must open a modal offering two options to the user:
  - **stop indexing folder**, removes the song and score(s) from Ottavada;
  - **move folder and files to trash** and files (also stopping indexing).

### 2.2.2. Songs with "send not allowed" status

The user must be able to:

- **open**, expands the song and shows all its scores;

- **open local**, opens the indexed folder of that song in the file explorer;

- **add/remove from favorites**;

- **edit** the song information, including:

  - name;
  - composer;
  - arranger;
  - categories;

- **allow sending**, changing the status of the song and scores to `main`;

- **remove song**, must open a modal offering two options to the user:

  - **stop indexing folder**, removes the song and score(s) from Ottavada;
  - **move folder and files to trash** and files (also stopping indexing).

### 2.2.3. Songs with "no score" status

The user must be able to:

- **re-index song**, changing the path and folder name referring to that song;
- **stop indexing folder**, removes the song from Ottavada.

## 2.3. Selecting multiple songs

The user must be able to select more than one song at a time through a checkbox in each row. When at least one song is selected, a bulk actions bar must be shown with a counter of selected songs and a **clear selection** action.

The available bulk actions depend on the status of the selected songs:

- **All selected songs have "send allowed" (`main`) or "send not allowed" (`draft`) status** — the full options must be shown:
  - **allow sending** (`main`), applies the status to all selected songs;
  - **disallow sending** (`draft`), applies the status to all selected songs;
  - **add/remove from favorites**;
  - **edit**, opens a modal that edits the selected songs one at a time, pre-filled with the current data, advancing to the next with **save & next**;
  - **stop indexing folder**, removes the songs from Ottavada;
  - **move folder and files to trash**;
  - **clear selection**.
- **All selected songs have "no score" (`not_found`) status** — only these options must be shown:
  - **stop indexing folder**, removes the songs from Ottavada;
  - **re-index folder**;
  - **clear selection**.
- **Mixed selection** (songs with and without scores together) — only **clear selection** must be shown; no bulk action is available.

### 2.3.1. Re-index confirmation modal

When re-indexing (individually or in bulk), a modal must be shown naming the song that is about to be re-indexed, so the user knows which folder they are working on:

- a button to **open in file explorer**, which opens the indexed folder of the current song;
- a **re-index** button, which opens the folder picker for that song and, after confirming, advances to the next selected song;
- a **cancel** button;
- when there is more than one song left, the modal must show how many remain.

---

# 3. Scores

## 3.1. Available operations

### 3.1.1. Scores with "send allowed" status

The user must be able to:

- **open**, the score will be opened using the default application associated with the file extension;
- **open local**, opens the indexed folder in the file explorer, with the selected score's file;
- **edit**, allowing changing the instrument name;
- **use as base**, uses this score as a base to create another;
- **disallow sending**, changing the score status to `draft`;
- **ignore score**, updates the score status to `ignored`;
- **move to trash**, moves the file to the trash.

### 3.1.2. Scores with "send not allowed" status

The user must be able to:

- **open**, the score will be opened using the default application associated with the file extension;
- **open local**, opens the indexed folder in the file explorer, with the selected score's file;
- **edit**, allowing changing the instrument name;
- **use as base**, uses this score as a base to create another;
- **allow sending**, changing the score status to `main`;
- **ignore score**, updates the score status to `ignored`;
- **move to trash**, moves the file to the trash.

### 3.1.3. Scores with "ignored" status

The user must be able to:

- **open**, the score will be opened using the default application associated with the file extension;
- **open local**, opens the indexed folder in the file explorer, with the selected score's file;
- **edit**, allowing changing the instrument name;
- **use as base**, uses this score as a base to create another;
- **allow sending**, changing the score status to `main`;
- **disallow sending**, changing the score status to `draft`;
- **move to trash**, moves the file to the trash.

---

# 4. Identify changes

## 4.1. Check changes

When clicking the "apply changes" button, the system must identify changes in the indexed folders, automatically identifying:

- addition of new score(s);
- modification of score(s);
- removal of score(s);
- addition of score(s) with a duplicate instrument.

It is considered **modification** when:

- renaming;
- extension change;
- file size change;
- last modification date/time change;

## 4.2. Change report

The report is shown after the "check changes" step.

It is displayed in a modal; the user must be able to choose: **continue** or **cancel**.

### 4.2.1. Sections

- **added** - shows everything that was added.
- **changed** - shows everything that was changed. Changed scores are shown with a status selector, allowing the user to choose how each one should be treated (see 4.2.2).
- **removed** - shows everything that was removed.
- **duplicate scores** - shows new files detected with an instrument name already used by another score in the same song (see 12.5).

### 4.2.2. Changing the status of changed scores

The user must be able to change the target status of each changed score directly in the report, without leaving the modal.

When a score file is changed, its status moves to **Send not allowed** (`draft`) by default. In the **changed** section, each changed score is shown with a status selector, so the user can choose:

- **Send allowed** (`main`) - the score remains allowed to be sent;
- **Send not allowed** (`draft`) - the score will not be sent (default);
- **Ignored** (`ignored`) - the score will be ignored.

For example: a score that would move from **Send allowed** to **Send not allowed** can be kept as **Send allowed** by choosing that option in the selector, without leaving the modal.

### 4.2.3. Summary - addition/change/removal of several scores of the same song

When there is the same action on several scores involving the same song, everything must be grouped into one line. Avoiding several lines for the same thing, e.g.: "Scores `aaa`, `bbb` and `ccc` were added to the song `xx`".

---

# 5. Categories

## 5.1. Available operations

The user must be able to:

- create categories;
- edit categories;
- delete categories.

---

# 6. Composers and arrangers

## 6.1. Automatic creation

Composers and arrangers must be created automatically when they are associated with a song during its creation or editing.

## 6.2. Available operations

The user must be able to:

- change the name of composers;
- change the name of arrangers;
- remove composers;
- remove arrangers.

## 6.3. Suggestions while typing

When starting to type the composer or arranger name while creating or editing a song, the system must suggest the names you have already registered, based on what is being typed.

---

# 7. Operational transparency

## 7.1. Upload to cloud steps

Steps:

1. Identify changes;
2. Generate events and/or snapshot;
3. Generate automatic backup (same as the "Backup now" action);
4. Group and compress changed files;
5. Send new or modified files.

The backup step (3) uses `rclone copy` so that older backups already stored in the cloud are preserved. The other steps (2, 4 and 5) use `rclone sync`, so that files removed locally are also removed from the cloud.

---

# 8. File processing

## 8.1. Packing with tar and compressing with zst

Scores with **send allowed** status must be grouped into a `tar` and renamed to the score's `id`. The files must remain at the root of the `tar` (no subdirectories). After joining everything with `tar`, it must be compressed with `zst`.

## 8.2. Snapshot

A snapshot must be generated when the events file exceeds **1 MB**, before compression.

The snapshot is intended exclusively for the Ottavada in **Consult** mode. It must contain only songs with `main` status and scores with `main` status.

When a snapshot is generated, the snapshot file must remain in the local actions directory until it is sent to the cloud. The events file can be removed locally after consolidation, because the snapshot contains all changes prior to it. If the sending fails, the snapshot remains local and will be resent on the next synchronization.

After generating the snapshot:

1. The current published catalog must be persisted in the snapshot file;
2. Clients must discard the existing locally published state;
3. The state must be restored from the new snapshot;
4. The server's events file must be reinitialized, removing the events already consolidated in the snapshot;
5. The local snapshot must remain available until the synchronization flow sends it to the cloud.

## 8.3. Backup

These scores with **send not allowed** and **ignored** status must be renamed with the score's `id` and sent to `/backup_scores_draft_ignored`; since they are files that can change frequently and in smaller quantity, they are not compressed. This brings the benefit: when several scores are sent and some are changed, only the changed ones are sent and the others are not resent.

---

# 9. Settings

The user must be able to:

- change the computer name;
- change the organization name;
- change the cloud provider;
- export backup (cloud);
- import backups (cloud);
- change the language.

---

# 10. Backup

The backup must be **generated every time** the user clicks **apply changes**.

One backup **must not replace** another. The system must keep only the most recent backup in the backup directory. After generating a new backup, the older files that exceed this limit must be removed.

Each backup must be saved with a name based on the generation timestamp, in the format `backup - {timestamp}.msgpack.zst`, without replacing previous backups.

The full backup must contain the **Manage** mode database.

The backup generation is performed during step 3 of the upload to cloud flow (see 7.1), following the same steps as the "Backup now" action in the settings.

## 10.1. Import backup

When clicking the "import backup" button (cloud), the system must download and validate the most recent backup in the cloud, verifying that it is not corrupted and was sent correctly. Before importing, the confirmation modal must be displayed showing the backup **date**, and the counts of **songs**, **scores**, **categories**, **composers** and **arrangers** contained in that backup.

In "import backup", if the score files already exist, Ottavada must check whether the files it has are more recent than those on the computer; if so, it must replace the local file with the one Ottavada downloaded; if not or if equal, it must keep the original file (<mark>Not implemented</mark>).

---

# 11. Startup

During application startup, the system must:

1. Check if there is an update;

2. Send telemetry.

---

# 12. Duplication identification

## 12.1. Uniqueness

The system must prevent duplicates according to the rules below:

- songs: the combination of name, composer and arranger must be unique; songs with the same name can exist when there is a different composer or arranger;
- scores: the instrument name must be unique within the same song;
- files: the same physical file cannot be indexed more than once;
- categories: the name must be unique;
- composers: the name must be unique;
- arrangers: the name must be unique.

Comparisons must ignore differences between uppercase and lowercase letters. The system must report the conflict and prevent the operation.

**Example**:

| **Wrong**                                                                                                                                     | **Correct**                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Song 1**: `Behold Our God` with the same composer and arranger<br/>**Song 2**: `Behold Our God` with the same composer and arranger      | **Song 1**: `Behold Our God` with composer `A`<br/>**Song 2**: `Behold Our God` with composer `B`                                    |
| **Score 1**: `Violino I`<br/>**Score 2**: `Violino I`<br/>**Score 3**: `Trompete`<br/>**Score 4**: `Trompete`                                 | **Score 1**: `Violino I`<br/>**Score 2**: `Violino I (Solo)`<br/>**Score 3**: `Trompete 1`<br/>**Score 4**: `Trompete 2`                  |

> This avoids redundancy and doubts in the repertoire.

## 12.2. When indexing an already indexed folder

The system must issue a warning and not let the user proceed.

## 12.3. Possible duplicate songs (<mark>Not implemented</mark>)

The system must identify similar song names, e.g.: `"National Anthem"` and `"The National Anthem"`, the system must identify and report them to the user.

**Trigram / N-gram Similarity** must be used to identify possible duplicate songs, being executed in the **index directory**.

## 12.4. Adding a duplicate file after indexing (<mark>Not implemented</mark>)

The user may accidentally add a new file with a name, but with a different extension or a slightly different name, for example:

- `National Anthem - Oboe.mus` and `National Anthem - Oboe.musx`;

- `National Anthem - Score.musx` and `National Anthem - Score.pdf`;

- `National Anthem - Oboe.mscz` and `National Anthem - Oboe.mscz`.

## 12.5. Duplicate instrument when adding a score after indexing

When checking changes, if a new file is detected in an indexed folder and its instrument name already exists in another score of the same song (ignoring differences between uppercase and lowercase), the system must identify it as a duplicate:

- the duplicate is reported in the **duplicate scores** section of the change report;
- when applied, the duplicate score is added with the `ignored` status;
- the user can only change the `ignored` status of this score after renaming its instrument.
