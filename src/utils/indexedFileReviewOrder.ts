import type { IndexedFile } from "../types";
import { compareInstrumentNames } from "./instrumentOrder";

export interface IndexedFileEntry {
  file: IndexedFile;
  idx: number;
}

function getReviewInstrumentName(
  entry: IndexedFileEntry,
  instrumentNames: Record<number, string>
): string | null {
  return instrumentNames[entry.idx] ?? entry.file.instrument;
}

export function sortIndexedFileEntriesForReview(
  entries: IndexedFileEntry[],
  instrumentNames: Record<number, string>
): IndexedFileEntry[] {
  return entries.slice().sort((a, b) => {
    return compareInstrumentNames(
      getReviewInstrumentName(a, instrumentNames),
      getReviewInstrumentName(b, instrumentNames)
    );
  });
}
