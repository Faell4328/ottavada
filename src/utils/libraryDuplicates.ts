import type { IndexedFile, ScoreListItem, SongListItem } from "../types";
import { isSamePath } from "./paths";
import { normalizeScoreNameForSave, normalizeSongNameForSave } from "./nameFormat";

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

export function findExistingScoreConflict(
  songs: SongListItem[] | null | undefined,
  file: IndexedFile,
  targetSongName?: string | null
): ScoreConflict | null {
  if (!songs) {
    return null;
  }

  for (const song of songs) {
    const matchedScore = song.scores.find((score) => isSamePath(score.file_path, file.path));

    if (matchedScore) {
      return {
        song,
        score: matchedScore,
        kind: "path",
      };
    }
  }

  const targetSong = targetSongName ? findSongByName(songs, targetSongName) : null;

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

export function describeScoreConflict(
  conflict: ScoreConflict,
  currentSongName?: string | null
): string {
  const normalizedCurrentSongName = currentSongName
    ? normalizeSongNameForSave(currentSongName)
    : null;
  const normalizedConflictSongName = normalizeSongNameForSave(conflict.song.name);

  if (
    normalizedCurrentSongName &&
    normalizedConflictSongName !== normalizedCurrentSongName
  ) {
    return `Essa partitura já está sendo utilizada na música ${conflict.song.name} e por isso não será salva.`;
  }

  return "Essa partitura já foi adicionada";
}

export function describeExistingSongWarning(): string {
  return "Essa música já existe em seu repertorio";
}
