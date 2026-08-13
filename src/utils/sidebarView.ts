import type { SidebarView } from "../types";
import i18next from "i18next";
import { getCategoryDisplayName } from "./categoryDisplay";

export function getSidebarViewLabel(sidebarView: SidebarView): string {
  if (sidebarView === "all") return i18next.t("sidebarViewLabels.all", "All Songs");
  if (sidebarView === "favorites") return i18next.t("sidebarViewLabels.favorites", "Favorites");
  if (sidebarView === "drafts") return i18next.t("sidebarViewLabels.drafts", "With sending not allowed");
  if (sidebarView === "not_found") return i18next.t("sidebarViewLabels.not_found", "Missing Scores");
  if (typeof sidebarView === "object") return getCategoryDisplayName(sidebarView.name);
  return "";
}

export function isSidebarViewActive(currentView: SidebarView, view: SidebarView): boolean {
  if (typeof view === "string" && typeof currentView === "string") {
    return view === currentView;
  }

  if (typeof view === "object" && typeof currentView === "object") {
    return view.id === currentView.id;
  }

  return false;
}
