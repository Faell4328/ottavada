import i18next from "i18next";

const DEFAULT_CATEGORY_KEY = "uncategorized";

export function getCategoryDisplayName(name: string): string {
  if (name.toLowerCase() === DEFAULT_CATEGORY_KEY) {
    return i18next.t("sidebar.uncategorized");
  }
  return name;
}
