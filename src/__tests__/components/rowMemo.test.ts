import { describe, expect, it } from "vitest";

import { areScoreRowPropsEqual, type ScoreRowProps } from "../../components/ScoreRow";
import { areSongRowPropsEqual, type SongRowProps } from "../../components/SongRow";

const baseScore = {
  id: "score-1",
  name: "Flauta",
  file_path: "/songs/flauta.musx",
  file_extension: "musx",
  updated_at: "2026-04-08T10:00:00Z",
  status: "draft" as const,
};

const baseSong = {
  id: "song-1",
  name: "HINO NACIONAL",
  composer: "JOEL",
  arranger: null,
  updated_at: "2026-04-08T10:00:00Z",
  is_favorite: false,
  category_ids: ["cat-1"],
  scores: [baseScore],
};

function buildScoreRowProps(overrides: Partial<ScoreRowProps> = {}): ScoreRowProps {
  return {
    score: baseScore,
    onSelectScore: () => undefined,
    menuId: "score-1",
    isMenuOpen: false,
    onMenuOpen: () => undefined,
    onMenuClose: () => undefined,
    onEdit: () => undefined,
    onStatusChange: async () => undefined,
    onDelete: async () => undefined,
    onUseAsBase: () => undefined,
    computerType: "Server",
    isLocked: false,
    ...overrides,
  };
}

function buildSongRowProps(overrides: Partial<SongRowProps> = {}): SongRowProps {
  return {
    song: baseSong,
    isExpanded: true,
    onToggle: () => undefined,
    onToggleFavorite: () => undefined,
    onAddFile: () => undefined,
    onEdit: () => undefined,
    onDelete: async () => undefined,
    menuId: "song-1",
    isMenuOpen: false,
    onMenuOpen: () => undefined,
    onMenuClose: () => undefined,
    computerType: "Server",
    isLocked: false,
    ...overrides,
  };
}

describe("row memo comparators", () => {
  it("re-renders score rows when lock state changes", () => {
    const prev = buildScoreRowProps();
    const next = buildScoreRowProps({ isLocked: true });

    expect(areScoreRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders song rows when lock state changes", () => {
    const prev = buildSongRowProps();
    const next = buildSongRowProps({ isLocked: true });

    expect(areSongRowPropsEqual(prev, next)).toBe(false);
  });
});