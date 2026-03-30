import { useState } from "react";
import {
  Library,
  Heart,
  FileEdit,
  FolderOpen,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { SidebarView } from "../types";

export default function Sidebar() {
  const { state, setSidebarView, createCategory, deleteCategory } =
    useAppState();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const currentView = state.sidebarView;
  const isClient = state.settings?.computer_type === "Client";

  function isActive(view: SidebarView): boolean {
    if (typeof view === "string" && typeof currentView === "string") {
      return view === currentView;
    }
    if (typeof view === "object" && typeof currentView === "object") {
      return view.id === currentView.id;
    }
    return false;
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    const existingCategory = state.categories.find(
      (cat) => cat.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (existingCategory) {
      setSidebarView({
        type: "category",
        id: existingCategory.id,
        name: existingCategory.name,
      });
      setNewCategoryName("");
      setShowNewCategory(false);
      return;
    }

    try {
      setIsCreatingCategory(true);
      await createCategory(name);
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (error) {
      console.error("Falha ao criar categoria:", error);
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleSubmitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleCreateCategory();
  }

  return (
    <aside className="flex w-[240px] flex-col gap-2.5 border-r border-white/20 bg-gradient-to-b from-[rgba(35,52,72,0.94)] to-[rgba(55,78,106,0.9)] px-3 py-3 text-[#dce7f5]">
      {/* Biblioteca */}
      <div className="border-b border-white/15 pb-2">
        <div className="flex items-center gap-1.5 text-sm font-bold mb-1.5">
          <Library className="h-4 w-4" />
          Biblioteca
        </div>
        <nav className="flex flex-col">
          <SidebarItem
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            label="Todas as Partituras"
            active={isActive("all")}
            onClick={() => setSidebarView("all")}
          />
          <SidebarItem
            icon={<Heart className="h-3.5 w-3.5" />}
            label="Favoritos"
            active={isActive("favorites")}
            onClick={() => setSidebarView("favorites")}
          />
          {!isClient && (
            <SidebarItem
              icon={<FileEdit className="h-3.5 w-3.5" />}
              label="Rascunhos Ativos"
              active={isActive("drafts")}
              onClick={() => setSidebarView("drafts")}
            />
          )}
          {!isClient && (
            <SidebarItem
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              label="Partituras não encontradas"
              active={isActive("not_found")}
              onClick={() => setSidebarView("not_found")}
            />
          )}
        </nav>
      </div>

      {/* Categorias */}
      <div>
        <div className="flex items-center justify-between text-sm font-bold mb-1.5">
          <span>Categorias</span>
          {!isClient && (
            <button
              type="button"
              onClick={() => setShowNewCategory(!showNewCategory)}
              className="flex h-5 w-5 items-center justify-center rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-0 text-white/80"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>

        {showNewCategory && !isClient && (
          <form className="flex gap-1 mb-2" onSubmit={handleSubmitCategory}>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={isCreatingCategory}
              className="flex-1 h-7 rounded border border-white/24 bg-white/14 px-2 text-sm text-white placeholder-white/50 outline-none focus:border-white/40"
              placeholder="Nome da categoria"
              autoFocus
            />
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}

        <nav className="flex flex-col">
          {state.categories.map((cat) => (
            <div key={cat.id} className="group flex items-center">
              <SidebarItem
                label={cat.name}
                active={isActive({ type: "category", id: cat.id, name: cat.name })}
                onClick={() =>
                  setSidebarView({
                    type: "category",
                    id: cat.id,
                    name: cat.name,
                  })
                }
                className="flex-1"
              />
              {!isClient && (
                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded bg-transparent hover:bg-red-500/20 transition-all cursor-pointer border-0 text-red-300/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {state.categories.length === 0 && (
            <span className="text-xs text-white/40 px-1 py-1">
              Nenhuma categoria
            </span>
          )}
        </nav>
      </div>
    </aside>
  );
}

function SidebarItem({
  label,
  icon,
  active,
  onClick,
  className = "",
}: {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 border-0 border-b border-white/12 px-1 py-1.5 text-left text-[13px] transition-colors cursor-pointer ${
        active
          ? "text-white font-medium bg-white/10 rounded"
          : "text-[#e8f1ff]/80 hover:text-white"
      } bg-transparent ${className}`}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      {label}
    </button>
  );
}
