import type { IndexedFile, ScoreListItem, SongListItem } from "../types";
import { isSamePath } from "./paths";
import { normalizeScoreNameForSave, normalizeSongNameForSave } from "./nameFormat";
import i18n from "../i18n";

export interface ScoreConflict {
  song: SongListItem;
  score: ScoreListItem;
  kind: "path" | "instrument";
}

export function findSongByName(
  songs: SongListItem[] | null | undefined,
  songName: string
): SongListItem | null {
  if (!songs) {
    return null;
  }

  const normalizedSongName = normalizeSongNameForSave(songName);
  if (!normalizedSongName) {
    return null;
  }

  return (
    songs.find((song) => normalizeSongNameForSave(song.name) === normalizedSongName) ?? null
  );
}

export function findSongByNameComposerArranger(
  songs: SongListItem[] | null | undefined,
  songName: string,
  composer: string,
  arranger: string
): SongListItem | null {
  if (!songs) {
    return null;
  }

  const normalizedSongName = normalizeSongNameForSave(songName);
  if (!normalizedSongName) {
    return null;
  }

  const normalizedComposer = normalizeSongNameForSave(composer);
  const normalizedArranger = normalizeSongNameForSave(arranger);

  return (
    songs.find((song) => {
      const nameMatch =
        normalizeSongNameForSave(song.name) === normalizedSongName;
      if (!nameMatch) {
        return false;
      }

      const composerMatch =
        normalizeSongNameForSave(song.composer ?? "") === normalizedComposer;
      const arrangerMatch =
        normalizeSongNameForSave(song.arranger ?? "") === normalizedArranger;

      return composerMatch && arrangerMatch;
    }) ?? null
  );
}

export function findExistingScoreConflict(
  songs: SongListItem[] | null | undefined,
  file: IndexedFile,
  targetSongName?: string | null,
  composer?: string,
  arranger?: string
): ScoreConflict | null {
  if (!songs) {
    return null;
  }

  const targetSong = targetSongName
    ? findSongByNameComposerArranger(songs, targetSongName, composer ?? "", arranger ?? "")
    : null;

  const normalizedInstrument = normalizeScoreNameForSave(file.instrument ?? "");
  if (!normalizedInstrument) {
    return null;
  }

  if (targetSong) {
    const matchingScoreInTargetSong = targetSong.scores.find((score) => {
      const existingInstrument = normalizeScoreNameForSave(score.name ?? "");
      return existingInstrument === normalizedInstrument;
    });

    if (matchingScoreInTargetSong) {
      return {
        song: targetSong,
        score: matchingScoreInTargetSong,
        kind: "instrument",
      };
    }
  }

  return null;
}

export function findExistingScoreConflictInSong(
  song: SongListItem | null | undefined,
  file: IndexedFile
): ScoreConflict | null {
  if (!song) {
    return null;
  }

  const matchedScoreByPath = song.scores.find((score) => isSamePath(score.file_path, file.path));
  if (matchedScoreByPath) {
    return {
      song,
      score: matchedScoreByPath,
      kind: "path",
    };
  }

  const normalizedInstrument = normalizeScoreNameForSave(file.instrument ?? "");
  if (!normalizedInstrument) {
    return null;
  }

  const matchingScore = song.scores.find((score) => {
    const existingInstrument = normalizeScoreNameForSave(score.name ?? "");
    return existingInstrument === normalizedInstrument;
  });

  if (!matchingScore) {
    return null;
  }

  return {
    song,
    score: matchingScore,
    kind: "instrument",
  };
}

export function findScoreNameConflictInSong(
  song: SongListItem | null | undefined,
  scoreName: string,
  excludedScoreId?: string | null
): ScoreListItem | null {
  if (!song) {
    return null;
  }

  const normalizedScoreName = normalizeScoreNameForSave(scoreName);
  if (!normalizedScoreName) {
    return null;
  }

  return (
    song.scores.find((score) => {
      if (excludedScoreId && score.id === excludedScoreId) {
        return false;
      }

      return normalizeScoreNameForSave(score.name ?? "") === normalizedScoreName;
    }) ?? null
  );
}

export function describeScoreConflict(
  conflict: ScoreConflict,
  currentSongName?: string | null
): string {
  const normalizedConflictSongName = normalizeSongNameForSave(conflict.song.name);

  if (currentSongName && normalizedConflictSongName === normalizeSongNameForSave(currentSongName)) {
    return i18n.t("libraryDuplicates.scoreInSameSong", { name: conflict.song.name });
  }

  return i18n.t("libraryDuplicates.scoreInOtherSong", { name: conflict.song.name });
}

export interface ScoreConflictSummary {
  songName: string;
  count: number;
}

export function summarizeScoreConflictsBySong(
  conflicts: ScoreConflict[]
): ScoreConflictSummary[] {
  const grouped = new Map<string, ScoreConflictSummary>();

  conflicts.forEach((conflict) => {
    const key = normalizeSongNameForSave(conflict.song.name) ?? conflict.song.name;
    const current = grouped.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    grouped.set(key, {
      songName: conflict.song.name,
      count: 1,
    });
  });

  return Array.from(grouped.values());
}

export function formatScoreConflictSummary(summary: ScoreConflictSummary): string {
  return summary.count === 1
    ? i18n.t("libraryDuplicates.oneScoreInSong", { name: summary.songName })
    : i18n.t("libraryDuplicates.multipleScoresInSong", { count: summary.count, name: summary.songName });
}

export function describeExistingSongWarning(): string {
  return i18n.t("libraryDuplicates.existingSongWarning");
}
