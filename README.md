<p align="center">
  <img src="public/icon.png" width="200">
</p>

**Ottavada** is free software for Windows 10 and 11 (Exe, `x32` and `x64`), Linux (AppImage, `x64`) and macOS (universal DMG, `x64` and `arm`), built with Tauri and React. It is a desktop application that makes life easier for people who deal with many songs and scores. Its main goal is to solve common challenges related to finding, organizing and moving them between computers.

It is important to note that **Ottavada** is not a tool for creating, editing or reading scores. It acts as an intermediary and facilitator, integrating and organizing your workflow. It was designed to work alongside widely used score creation and editing tools, such as **Finale**, **MuseScore**, **Sibelius**, **Dorico** and **Encore**, as well as other programs compatible with formats such as **MusicXML**, **MIDI** and **PDF**.

# How does it do this?

**Finding**: Filters by category, composer, arranger and a search bar make finding songs fast. The list shows only the song name and, with one click, expands to show the scores of that song, following the **traditional orchestral order** (the pattern: [Standard Orchestral Score Order](./docs/High%20Level/4%20-%20Requirements/1%20-%20Functional%20requirements%20-%20both.md#62-supported-instruments-and-their-order)), keeping the screen clean and free of visual clutter.

**Organization**: The system prevents duplication by not accepting two songs with the same name, composer and arranger (at least one of the three must differ) and by not allowing repeated instruments within the same song.

- **Correct** examples of songs:

  - Song name, with no composer and no arranger:
    - "Fly, thought";
    - "Fly, thought with choir".
  - Song name - composer - arranger:
    - "Serenade" - "Schubert" - "Anna";
    - "Serenade" - "Schubert" - "Charles".

- **Correct** examples of instruments:

  - "Trumpet" and "Trumpet (solo)";
  - "Trumpet 1" and "Trumpet 2".

**Moving between computers**: Send songs from one computer to another with one click, with full control over what goes and what stays. Each computer has a [role](./docs/High%20Level/1%20-%20Usage%20mode.md) defined in the initial setup.

**Automatic backup**: Ottavada generates backups periodically, so even if your computer is lost or damaged, your songs and scores remain safe and can be restored on another computer.

---

# System philosophy

**Ottavada** adds songs and scores exclusively through **folder indexing**. The process is simple: just select a folder that contains score files. The tool reads that content and incorporates it internally (without changing anything in your files). From then on, any change made to the files inside the folders, such as additions, modifications or deletions, is automatically reflected in Ottavada.

This means that the organization of songs and scores follows the folder structure defined by you. The tool adapts to your way of organizing, not the other way around — ideal for those who want to keep control over their folders and files.

Ottavada **does not modify your folders or your files**, with one exception: **moving to the trash** a song and/or score when the user selects it in the tool. The song and score names defined in the system are used only internally for organization and identification, and do not affect the real names of the files or directories.

If one day you decide to stop using Ottavada, all your folders and files will remain exactly where they were.

---

# Benefits and Limitations of Ottavada

Beyond the benefits mentioned in [**How does it do this?**](#how-does-it-do-this), there are other benefits, but also limitations, that are inherent to the architecture chosen in the development of the tool. The benefits are:

## Benefits

### 1st Benefit - You have TOTAL control over your folders and files

Ottavada was designed to "mold" itself to the way you work, meaning your files remain under your control and in your organization. With it, you don't face the difficulty that other tools/services have, which is the goal of making your exit as hard as possible and turning you into their hostage.

### 2nd Benefit - Zero or very low cost

Using the "cloud provider" as the communication bridge for exchanging files between your computers with Ottavada reduces complexity and cost.

### 3rd Benefit - Full control over what goes to the Ottavada(s) in Consult mode

As mentioned before, there are two modes of using Ottavada. With that, you have full control over what goes or not to the Consult mode.

### 4th Benefit - Backup

Besides having an integrated backup system, they return EXACTLY to the same place they were on the other computer. You don't need to learn a new organization or go looking for them.

### 5th Benefit - Simple for outsiders

Because Ottavada follows a simple pattern, it makes it MUCH easier if someone else needs to access your musical repertoire, because they don't need to learn how you organize your folders and files — they simply need to perform a search with/without filters, expand the song and find the score (which is already ordered).

### 6th Benefit - Works even without internet (with limitations)

The internet is essential for **sending and receiving updates** between computers; without a connection this step is not possible. However, the repertoire **previously downloaded** by Ottavada in **consult** mode is stored locally on your computer.

This means that, even when **offline**, you can still **search, view and open** all the songs and scores that were downloaded before.

**Summary**: online you receive what's new; offline you keep using everything you've already downloaded.

### Complement

There are other benefits, such as avoiding duplication (which makes things much easier for you and other people), but as they were already mentioned in the texts above, I won't repeat them here.

## Limitations

### 1st Limitation - You need to add songs manually

When you need to add new song(s) and score(s), you need the manual work of going to your operating system's explorer and creating the directory, naming it, moving the scores into it, naming them, in order to index them in Ottavada.

Currently this is a limitation that has no solution in Ottavada, but the solution is already in **planning**.

### 2nd Limitation - Problem if you need to reorganize the folders

If you need to reorganize your folders, when you index a folder, Ottavada stores its "address". If you move the folder and the address changes, you will need to **re-index the folder** manually.

Currently this is a limitation that has no solution in Ottavada, but the solution is already in **planning**.

### 3rd Limitation - Conflict in simultaneous use between computers in Manage mode

It is not recommended to use two or more computers in Manage mode at the same time, due to write and rewrite conflicts in the cloud provider; this is a limitation of the architecture.

To switch the Manage mode to another computer, you need to **import the backup** from the cloud (Settings → Import backups). This process downloads and restores all songs, scores and settings, which can be slow depending on the size of your repertoire.

Currently there is no mechanism for real-time synchronization between two Manage mode computers, but this is already in **planning**.

### 4th Limitation - Learning a new tool

There is also a cost/benefit question: there is **a learning and adaptation curve**, you will need to understand how the tool works and get used to it, which takes time. But over time you will reap the benefits mentioned above.

---

# About the documentation

The project documentation is in `docs/` and was divided into three sections:

- **High Level** — general overview of the system: requirements, features, architecture.
- **Notes** — development diary and ideas.
- **Low Level** — technical aspects: tools, modeling, flows, implementation decisions.

> If this is your first time reading the documentation, start with **High Level** before moving to **Low Level**. Understand the *why* before the *how*. I also recommend reading the files following the order in the folder and file names.
