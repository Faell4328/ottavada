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