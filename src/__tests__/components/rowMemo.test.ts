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
  path: "/songs/hino-nacional",
  updated_at: "2026-04-08T10:00:00Z",
  is_favorite: false,
  status: "main" as const,
  category_ids: ["cat-1"],
  scores: [baseScore],
};

function buildScoreRowProps(overrides: Partial<ScoreRowProps> = {}): ScoreRowProps {
  return {
    score: baseScore,
    displayIndex: 0,
    isSelected: false,
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
    onEdit: () => undefined,
    onDelete: async () => undefined,
    onDeleteWithFiles: async () => undefined,
    onStatusChange: async () => undefined,
    onReindex: async () => undefined,
    menuId: "song-1",
    isMenuOpen: false,
    onMenuOpen: () => undefined,
    onMenuClose: () => undefined,
    computerType: "Server",
    isLocked: false,
    categories: [],
    ...overrides,
  };
}

describe("row memo comparators", () => {
  it("re-renders score rows when lock state changes", () => {
    const prev = buildScoreRowProps();
    const next = buildScoreRowProps({ isLocked: true });

    expect(areScoreRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders score rows when display index changes", () => {
    const prev = buildScoreRowProps();
    const next = buildScoreRowProps({ displayIndex: 1 });

    expect(areScoreRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders score rows when the selected state changes", () => {
    const prev = buildScoreRowProps();
    const next = buildScoreRowProps({ isSelected: true });

    expect(areScoreRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders song rows when lock state changes", () => {
    const prev = buildSongRowProps();
    const next = buildSongRowProps({ isLocked: true });

    expect(areSongRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders song rows when the selected score changes", () => {
    const prev = buildSongRowProps();
    const next = buildSongRowProps({
      song: {
        ...baseSong,
        path: "/songs/novo-caminho",
      },
    });

    expect(areSongRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders song rows when the song status changes", () => {
    const prev = buildSongRowProps();
    const next = buildSongRowProps({
      song: {
        ...baseSong,
        status: "draft",
      },
    });

    expect(areSongRowPropsEqual(prev, next)).toBe(false);
  });

  it("re-renders song rows when the song status changes to not_found", () => {
    const prev = buildSongRowProps();
    const next = buildSongRowProps({
      song: {
        ...baseSong,
        status: "not_found",
      },
    });

    expect(areSongRowPropsEqual(prev, next)).toBe(false);
  });
});