**Ottavada** - good ideas

- backup using a USB drive or other local media.
- implement name suggestions with AI. The idea is to standardize song names (the user can choose to accept or not, individually).
- automatic rclone update.
  - If one day I need to abandon the project, I don't want it to stop working because of an outdated rclone, so I need to find a way to keep rclone updated.
- implement file verification hash.
  - the idea is to check only the files whose last modification date/time changed.
- implement smart search (even with typos).
- implement smart instrument identification.
  - removing junk from the name, e.g.: "_", "-", etc.
- clear modal when closing (`return () {}`).
  - currently, when opening the review modal when indexing a score, it usually already has warnings and then they disappear. I have to fix this.
- allow songs with the same name, but different composer and/or arranger.
- I want to implement a way to read the file. With that, I can make smarter suggestions and follow the order of the score layout that is in the score file.

---

**Ottavada** - far-fetched

- take the client out of `read-only`.

- download backup from the cloud.
- add a cybersecurity layer.
- possible addition of a new computer `type` `semi-server`.
- standardization of song names.
  - having an internal list of all existing songs (very ambitious and crazy).

---

**Ottavada Server** - far-fetched

- on the Ottavada website, musicians could read the scores of their instruments and listen to them.
  - this is better, because not every musician has a computer, the website brings more accessibility.
