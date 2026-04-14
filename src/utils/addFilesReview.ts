import type { IndexedFile, SongListItem } from "../types";
import { findExistingScoreConflict, type ScoreConflict } from "./libraryDuplicates";
import { normalizeScoreNameForSave } from "./nameFormat";

export interface IndexedFileEntry {
  file: IndexedFile;
  idx: number;
}

export interface AddFilesReviewAnalysis {
  normalizedInstrumentNames: Map<number, string | null>;
  normalizedInstrumentCounts: Map<string, number>;
  duplicateMap: Map<number, ScoreConflict | null>;
  batchDuplicateMap: Map<number, boolean>;
  duplicateEntries: IndexedFileEntry[];
  addableEntries: IndexedFileEntry[];
}

function buildNormalizedInstrumentNames(
  activeFileEntries: IndexedFileEntry[],
  instrumentNames: Record<number, string>
): Map<number, string | null> {
  const normalizedNames = new Map<number, string | null>();

  activeFileEntries.forEach(({ file, idx }) => {
    normalizedNames.set(idx, normalizeScoreNameForSave(instrumentNames[idx] ?? file.instrument));
  });

  return normalizedNames;
}

function buildNormalizedInstrumentCounts(
  normalizedInstrumentNames: Map<number, string | null>
): Map<string, number> {
  const counts = new Map<string, number>();

  normalizedInstrumentNames.forEach((normalizedInstrument) => {
    if (!normalizedInstrument) {
      return;
    }

    counts.set(normalizedInstrument, (counts.get(normalizedInstrument) ?? 0) + 1);
  });

  return counts;
}

function buildDuplicateMap(
  activeFileEntries: IndexedFileEntry[],
  songsForDuplicateCheck: SongListItem[],
  normalizedTitle: string
): Map<number, ScoreConflict | null> {
  const duplicateMap = new Map<number, ScoreConflict | null>();

  activeFileEntries.forEach(({ file, idx }) => {
    duplicateMap.set(idx, findExistingScoreConflict(songsForDuplicateCheck, file, normalizedTitle));
  });

  return duplicateMap;
}

function buildBatchDuplicateMap(
  activeFileEntries: IndexedFileEntry[],
  normalizedInstrumentNames: Map<number, string | null>,
  normalizedInstrumentCounts: Map<string, number>
): Map<number, boolean> {
  const batchDuplicateMap = new Map<number, boolean>();

  activeFileEntries.forEach(({ idx }) => {
    const normalizedInstrument = normalizedInstrumentNames.get(idx);
    batchDuplicateMap.set(
      idx,
      normalizedInstrument !== null &&
        normalizedInstrument !== undefined &&
        (normalizedInstrumentCounts.get(normalizedInstrument) ?? 0) > 1
    );
  });

  return batchDuplicateMap;
}

export function analyzeAddFilesReview(
  activeFileEntries: IndexedFileEntry[],
  instrumentNames: Record<number, string>,
  songsForDuplicateCheck: SongListItem[],
  normalizedTitle: string
): AddFilesReviewAnalysis {
  const normalizedInstrumentNames = buildNormalizedInstrumentNames(activeFileEntries, instrumentNames);
  const normalizedInstrumentCounts = buildNormalizedInstrumentCounts(normalizedInstrumentNames);
  const duplicateMap = buildDuplicateMap(activeFileEntries, songsForDuplicateCheck, normalizedTitle);
  const batchDuplicateMap = buildBatchDuplicateMap(
    activeFileEntries,
    normalizedInstrumentNames,
    normalizedInstrumentCounts
  );

  const duplicateEntries = activeFileEntries.filter(({ idx }) => {
    return duplicateMap.get(idx) !== null || batchDuplicateMap.get(idx) === true;
  });

  const addableEntries = activeFileEntries.filter(({ idx }) => {
    return duplicateMap.get(idx) === null && batchDuplicateMap.get(idx) !== true;
  });

  return {
    normalizedInstrumentNames,
    normalizedInstrumentCounts,
    duplicateMap,
    batchDuplicateMap,
    duplicateEntries,
    addableEntries,
  };
}