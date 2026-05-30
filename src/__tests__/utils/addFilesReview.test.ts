import { describe, expect, it } from "vitest";

import { analyzeAddFilesReview, type IndexedFileEntry } from "../../utils/addFilesReview";
import type { SongListItem } from "../../types";

const baseSong: SongListItem = {
  id: "song-1",
  name: "CANON",
  composer: null,
  arranger: null,
  path: "/music/canon",
  updated_at: "2026-04-08T00:00:00.000Z",
  is_favorite: false,
  category_ids: [],
  scores: [
    {
      id: "score-1",
      name: "Flauta",
      file_path: "/library/Canon - Flauta.musx",
      file_extension: "musx",
      updated_at: "2026-04-08T00:00:00.000Z",
      status: "main",
    },
  ],
};

describe("addFilesReview", () => {
  it("marks path duplicates and keeps non-duplicates addable", () => {
    const activeFileEntries: IndexedFileEntry[] = [
      {
        idx: 0,
        file: {
          path: "/library/Canon - Flauta.musx",
          name: "Canon",
          instrument: "Flauta",
          extension: "musx",
        },
      },
      {
        idx: 1,
        file: {
          path: "/library/Canon - Violino.musx",
          name: "Canon",
          instrument: "Violino",
          extension: "musx",
        },
      },
    ];

    const analysis = analyzeAddFilesReview(activeFileEntries, {}, [baseSong], "CANON");

    expect(analysis.duplicateEntries.map(({ idx }) => idx)).toEqual([0]);
    expect(analysis.addableEntries.map(({ idx }) => idx)).toEqual([1]);
    expect(analysis.duplicateMap.get(0)?.kind).toBe("path");
    expect(analysis.duplicateMap.get(1)).toBeNull();
  });

  it("marks batch duplicates when two selected files have same normalized instrument", () => {
    const activeFileEntries: IndexedFileEntry[] = [
      {
        idx: 0,
        file: {
          path: "/music/A - FLAUTA 1.musx",
          name: "Canon",
          instrument: "Flauta",
          extension: "musx",
        },
      },
      {
        idx: 1,
        file: {
          path: "/music/A - flauta 2.musx",
          name: "Canon",
          instrument: "Flauta",
          extension: "musx",
        },
      },
    ];

    const analysis = analyzeAddFilesReview(activeFileEntries, {}, [], "CANON");

    expect(analysis.batchDuplicateMap.get(0)).toBe(true);
    expect(analysis.batchDuplicateMap.get(1)).toBe(true);
    expect(analysis.duplicateEntries).toHaveLength(2);
    expect(analysis.addableEntries).toHaveLength(0);
  });

  it("uses edited instrument names to resolve batch duplicate state", () => {
    const activeFileEntries: IndexedFileEntry[] = [
      {
        idx: 0,
        file: {
          path: "/music/A - Flauta.musx",
          name: "Canon",
          instrument: "Flauta",
          extension: "musx",
        },
      },
      {
        idx: 1,
        file: {
          path: "/music/A - Violino.musx",
          name: "Canon",
          instrument: "Violino",
          extension: "musx",
        },
      },
    ];

    const analysis = analyzeAddFilesReview(
      activeFileEntries,
      {
        0: "Flauta",
        1: "Flauta",
      },
      [],
      "CANON"
    );

    expect(analysis.batchDuplicateMap.get(0)).toBe(true);
    expect(analysis.batchDuplicateMap.get(1)).toBe(true);
    expect(analysis.normalizedInstrumentCounts.get("Flauta")).toBe(2);
  });
});