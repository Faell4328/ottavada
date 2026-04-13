import type { IndexedFile } from "../types";
import { compareInstrumentNames } from "./instrumentOrder";

export interface IndexedFileEntry {
  file: IndexedFile;
  idx: number;
}

function getReviewInstrumentName(
  entry: IndexedFileEntry,
  instrumentNames: Record<number, string>,
  editingInstrumentIndex: number | null
): string | null {
  const useEditedNames = editingInstrumentIndex === null;

  return useEditedNames ? instrumentNames[entry.idx] ?? entry.file.instrument : entry.file.instrument;
}

export function sortIndexedFileEntriesForReview(
  entries: IndexedFileEntry[],
  instrumentNames: Record<number, string>,
  editingInstrumentIndex: number | null
): IndexedFileEntry[] {
  return entries.slice().sort((a, b) => {
    return compareInstrumentNames(
      getReviewInstrumentName(a, instrumentNames, editingInstrumentIndex),
      getReviewInstrumentName(b, instrumentNames, editingInstrumentIndex)
    );
  });
}
