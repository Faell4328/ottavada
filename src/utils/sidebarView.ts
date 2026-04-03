import type { SidebarView } from "../types";

export function getSidebarViewLabel(sidebarView: SidebarView): string {
  if (sidebarView === "all") return "Todas as Músicas";
  if (sidebarView === "favorites") return "Favoritos";
  if (sidebarView === "drafts") return "Rascunhos Ativos";
  if (sidebarView === "not_found") return "Partituras não encontradas";
  if (typeof sidebarView === "object") return sidebarView.name;
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
