const DEFAULT_CATEGORY_ID = "default-category";

export function normalizeSelectedCategoryIds(categoryIds: string[]): string[] {
  const seen = new Set<string>();
  const normalized = [] as string[];

  for (const categoryId of categoryIds) {
    const trimmedCategoryId = categoryId.trim();

    if (!trimmedCategoryId) {
      continue;
    }

    if (!seen.has(trimmedCategoryId)) {
      seen.add(trimmedCategoryId);
      normalized.push(trimmedCategoryId);
    }
  }

  const realCategoryIds = normalized.filter((categoryId) => categoryId !== DEFAULT_CATEGORY_ID);

  return realCategoryIds.length > 0 ? realCategoryIds : [DEFAULT_CATEGORY_ID];
}

export function toggleSelectedCategoryId(categoryIds: string[], categoryId: string): string[] {
  const nextCategoryIds = categoryIds.includes(categoryId)
    ? categoryIds.filter((id) => id !== categoryId)
    : [...categoryIds, categoryId];

  return normalizeSelectedCategoryIds(nextCategoryIds);
}