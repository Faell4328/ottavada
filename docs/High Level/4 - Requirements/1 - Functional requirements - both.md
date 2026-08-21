# 1. Telemetry

## 1.1. When telemetry is sent

The system must send telemetry data:

- when it is opened;
- every 5 minutes.

## 1.2. Information sent by telemetry

The data sent must be:

- Computer ID (generated randomly at installation);
- Usage mode;
- Language;
- Application version;
- Operating system (Windows, Linux and macOS);
- Architecture (x32, x64 or xARM);
- Total number of songs;
- Number of songs in **send allowed** (`main`) status;
- Number of songs in **send not allowed** (`draft`) status;
- Number of scores in **send allowed** (`main`) status;
- Number of scores in **send not allowed** (`draft`) status;
- Content of the local telemetry error queue (`errors`).

> Telemetry sends a computer identifier generated at installation. It is not linked to the user's identity; the privacy policy must explain the purpose, retention and opt-out.

# 2. Updates

The system must support version updates, using Tauri's own mechanism (plugin), with the settings in `update.json` on the [Ottavada](https://ottavada.com/update.json) website.

The user must be able to decline the update, leaving a button in the header to update; when clicking it, the system asks whether they want to start the update.

---

# 3. Filters

The filters must operate cumulatively.

## 3.1. Sections

It must have the sections:

- **All songs** - Lists all songs;
- **Favorites** - Lists all favorite songs;
- **Not allowed**:
  - Lists all songs with **send not allowed** (`draft`) status;
  - Lists all songs with **send allowed** (`main`) status, but that have at least one score with **send not allowed** status;
- **Without scores** - Lists all songs in **no score** (`not_found`) status.

## 3.2. Category

When the user selects a category, it must show the songs, composers and arrangers that belong to that category.

The category must have the default values: **No category** (contains all songs without a category), which cannot be changed or removed.

## 3.3. Composer and arranger

When the user selects a composer, it must only show the songs and arrangers related to that composer. The same applies if the arranger is selected.

The composer must have, by default, the options: **All** and **No composer** (contains all songs without a composer), which cannot be changed or removed.

The arranger must have, by default, the options: **All** and **No arranger** (contains all songs without an arranger), which cannot be changed or removed.

## 3.4. Search bar

The song search must be performed based on the filter(s) the user applied.

The search must be simple, looking for substrings in the song name.

## 3.5. Default selected values

The filters must start with the following values:

- Section: All songs;
- Category: *None selected*;
- Composer: All;
- Arranger: All.

---

# 4. Cloud

## 4.1. Supported providers

Ottavada must support:

- Koofr (**Recommended provider**);
- Google Drive;
- Dropbox;
- OneDrive;
- pCloud.

Advanced options:

- WebDAV;
- SFTP.

## 4.2. Engine for sending and receiving with the cloud

Ottavada must internally use `rclone`.

The `rclone` executable must be distributed and incorporated into the system, with no need for installation, configuration or manual interaction by the user.

All `rclone`-related configuration, including creating remotes, authentication, sync parameters, directories, credentials and connection management, must be performed exclusively by Ottavada through its interface and internal flows. Completely abstracting the use of `rclone`.

---

# 5. Operational transparency

## 5.1. Progress bar

The system must show the progress of the actions: "apply changes" and "check changes".

## 5.2. Restrictions during synchronization

During synchronizations, the user may only:

- expand the scores of a song;
- open scores with a double click;
- perform searches;
- use filters.

Other operations must remain blocked, for security and integrity reasons.

---

# 6. Instruments and ordering

## 6.1. Listing order in the song

The supported instruments and their order are based on the internal order of Finale and Sibelius, which follows the pattern of the *New German School* convention (Wagner, Strauss, Mahler), which is the international standard.

1st Instruments without a name must come first;

2nd Identified instruments must come next (in the order of the list in **6.2**);

3rd Identified instruments that are outside the list must come last (in alphabetical order).

## 6.2. Supported instruments and their order

**Woodwinds**

| Position | Instrument (Portuguese) | Instrument (English)      |
| -------- | ----------------------- | ------------------------- |
| 1        | Flautim                 | Piccolo                   |
| 2        | Flauta                  | Flute                     |
| 3        | Flauta Alto             | Alto Flute                |
| 4        | Oboé                    | Oboe                      |
| 5        | Oboé d'Amore            | Oboe d'Amore              |
| 6        | Corne Inglês            | English Horn/ Cor Anglais |
| 7        | Heckelfone              | Heckelphone               |
| 8        | Clarinete Mib (Soprinho)| E♭ Clarinet               |
| 9        | Clarinete (Sib/Lá)      | Clarinet (B♭/A)           |
| 10       | Clarinete Baixo         | Bass Clarinet             |
| 11       | Clarinete Contralto     | Contralto Clarinet        |
| 12       | Clarinete Contrabaixo   | Contrabass Clarinet       |
| 13       | Saxofone Soprano        | Soprano Saxophone         |
| 14       | Saxofone Alto           | Alto Saxophone            |
| 15       | Saxofone Tenor          | Tenor Saxophone           |
| 16       | Saxofone Barítono       | Baritone Saxophone        |
| 17       | Saxofone Baixo          | Bass Saxophone            |
| 18       | Fagote                  | Bassoon                   |
| 19       | Contrafagote            | Contrabassoon             |

**Brass**

| Position | Instrument (Portuguese)  | Instrument (English)      |
| -------- | ------------------------ | ------------------------- |
| 20       | Trompa (Trompa Francesa) | Horn (French Horn)        |
| 21       | Trompa Wagneriana        | Wagner Tuba               |
| 22       | Trompete Piccolo         | Piccolo Trumpet           |
| 23       | Trompete                 | Trumpet                   |
| 24       | Trompete Baixo           | Bass Trumpet              |
| 25       | Cornetim                 | Cornet (B♭)               |
| 26       | Fliscorno                | Flugelhorn                |
| 27       | Trombone Alto            | Alto Trombone             |
| 28       | Trombone (Tenor)         | Trombone                  |
| 29       | Trombone Baixo           | Bass Trombone             |
| 30       | Eufônio (Barítono)       | Euphonium / Baritone Horn |
| 31       | Tuba                     | Tuba                      |

**Percussion**

| Position | Instrument (Portuguese) | Instrument (English)   |
| -------- | ----------------------- | ---------------------- |
| 32       | Tímpanos                | Timpani                |
| 33       | Caixa Clara             | Snare Drum             |
| 34       | Bumbo                   | Bass Drum              |
| 35       | Tom-tom                 | Tom-tom (single drum)  |
| 36       | Bateria                 | Drum set               |
| 37       | Bongôs                  | Bongos                 |
| 38       | Congas                  | Congas                 |
| 39       | Pratos                  | Cymbals (crash & ride) |
| 40       | Triângulo               | Triangle               |
| 41       | Pandeiro                | Tambourine             |
| 42       | Adufe                   | Tambour (frame drum)   |
| 43       | Sinos de Mão            | Handbells              |
| 44       | Sinos de Trenó          | Sleigh bells           |
| 45       | Castanholas             | Castanets              |
| 46       | Bloco de Madeira        | Wood block             |
| 47       | Blocos de Templo        | Temple blocks          |
| 48       | Maracas                 | Maracas                |
| 49       | Tam-Tam (Gongo)         | Tam-tam (gong)         |
| 50       | Crótalos                | Crotales               |
| 51       | Glockenspiel            | Glockenspiel           |
| 52       | Xilofone                | Xylophone              |
| 53       | Marimba                 | Marimba                |
| 54       | Vibrafone               | Vibraphone             |
| 55       | Sinos Tubulares         | Tubular bells          |

**Keyboards**

| Position | Instrument (Portuguese) | Instrument (English) |
| -------- | ----------------------- | -------------------- |
| 56       | Celesta                 | Celesta              |
| 57       | Piano                   | Piano                |
| 58       | Cravo                   | Harpsichord          |
| 59       | Órgão de Tubos          | Pipe organ           |
| 60       | Acordeão                | Accordion            |

**Harp**

| Position | Instrument (Portuguese) | Instrument (English) |
| -------- | ----------------------- | -------------------- |
| 61       | Harpa                   | Harp                 |

**Bowed Strings**

| Position | Instrument (Portuguese) | Instrument (English)     |
| -------- | ----------------------- | ------------------------ |
| 62       | Violino                 | Violin                   |
| 63       | Viola                   | Viola                    |
| 64       | Violoncelo              | Cello / Violoncello      |
| 65       | Contrabaixo             | Double bass / Contrabass |

## 6.3. Score name normalization

When normalizing a score name (used for uniqueness comparison and for the stored instrument name), leading digits and whitespace must be removed, because they represent the file's ordering prefix and are not part of the instrument name. Digits that are not at the start of the name must be preserved.

**Examples:**

- `00001 Flauta 1` → `Flauta 1`;
- `2 Flauta` → `Flauta`;
- `Trompete 3I` → `Trompete 3I` (trailing number preserved);
- `Flauta 2 Principal 3` → `Flauta 2 Principal 3` (numbers not at the start preserved);
- `Sax10` → `Sax10` (number not separated by whitespace preserved).
