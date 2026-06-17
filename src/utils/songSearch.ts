import type { SongListItem } from "../types";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function songMatchesSearchQuery(song: SongListItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const searchableFields = [song.name, song.composer, song.arranger].filter(Boolean);

  return searchableFields.some((field) => normalizeSearchText(field as string).includes(normalizedQuery));
}

export function normalizeAuthorName(value: string | null | undefined): string {
  return normalizeSearchText(value ?? "");
}

export function getUniqueSongAuthors(songs: SongListItem[], field: "composer" | "arranger") {
  const values = new Map<string, string>();

  for (const song of songs) {
    const value = song[field]?.trim();
    if (value) {
      const key = normalizeAuthorName(value);
      if (!values.has(key)) {
        values.set(key, value);
      }
    }
  }

  return [...values.values()].sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
}

export function getRelatedAuthorOptions(
  songs: SongListItem[],
  targetField: "composer" | "arranger",
  relatedFilter: string
): string[] {
  const relatedField: "composer" | "arranger" = targetField === "composer" ? "arranger" : "composer";

  const filteredSongs = relatedFilter === "all"
    ? songs
    : songs.filter((song) => {
        const value = song[relatedField];
        if (relatedFilter === "none") return !value?.trim();
        return normalizeAuthorName(value) === normalizeAuthorName(relatedFilter);
      });

  const values = new Set<string>();
  for (const song of filteredSongs) {
    const value = song[targetField]?.trim();
    if (value) {
      values.add(value);
    }
  }

  return [...values].sort((left, right) =>
    left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
  );
}

export function songMatchesAuthorFilter(
  song: SongListItem,
  filters: { composer: string; arranger: string }
): boolean {
  const composerMatches =
    filters.composer === "all"
      ? true
      : filters.composer === "none"
        ? !song.composer?.trim()
        : normalizeAuthorName(song.composer) === normalizeAuthorName(filters.composer);

  const arrangerMatches =
    filters.arranger === "all"
      ? true
      : filters.arranger === "none"
        ? !song.arranger?.trim()
        : normalizeAuthorName(song.arranger) === normalizeAuthorName(filters.arranger);

  return composerMatches && arrangerMatches;
}