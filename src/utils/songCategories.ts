import type { Category } from "../types";
import { getCategoryDisplayName } from "./categoryDisplay";

export function getCategoryNames(
  categoryIds: string[],
  categories: Category[],
): string[] {
  if (categoryIds.length === 0) {
    return [];
  }

  const lookup = new Map(categories.map((cat) => [cat.id, cat.name]));
  const names: string[] = [];
  const seen = new Set<string>();

  for (const id of categoryIds) {
    const raw = lookup.get(id);
    if (!raw) continue;
    const display = getCategoryDisplayName(raw);
    if (seen.has(display)) continue;
    seen.add(display);
    names.push(display);
  }

  return names;
}
