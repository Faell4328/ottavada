import { useMemo, useState, type ReactNode } from "react";
import {
  Library,
  Heart,
  FileEdit,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { SidebarView } from "../types";
import { isClientComputer } from "../utils/computer";
import { isSidebarViewActive } from "../utils/sidebarView";
import { useConfirmation } from "../hooks/useConfirmation";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { EditCategoryModal } from "./EditCategoryModal";
import toast from "react-hot-toast";

export default function Sidebar() {
  const { state, setSidebarView, setAuthorFilters, createCategory, updateCategory, deleteCategory } =
    useAppState();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<{ id: string; name: string } | null>(null);
  const confirmation = useConfirmation();

  const currentView = state.sidebarView;
  const isClient = isClientComputer(state.settings?.computer_type);
  const isSyncLocked =
    state.isScanningFiles ||
    state.rcloneProgress.active ||
    state.operationStatus.stepCurrent !== null;
  const isCategoryLocked = isClient || isSyncLocked;
  const categoryLockedTitle = isClient
    ? "Esse recurso só está disponível no computador principal."
    : "Espere a sincronização terminar para continuar.";
  const libraryViews: Array<{ view: SidebarView; label: string; icon: ReactNode }> = [
    {
      view: "all",
      label: "Todas as Músicas",
      icon: <FolderOpen className="h-3.5 w-3.5" />,
    },
    {
      view: "favorites",
      label: "Favoritos",
      icon: <Heart className="h-3.5 w-3.5" />,
    },
    {
      view: "drafts",
      label: "Rascunhos Ativos",
      icon: <FileEdit className="h-3.5 w-3.5" />,
    },
  ];

  const composerOptions = useMemo(() => {
    const values = new Set<string>();
    state.songs.forEach((song) => song.composer?.trim() && values.add(song.composer.trim()));
    return [...values].sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  }, [state.songs]);

  const arrangerOptions = useMemo(() => {
    const values = new Set<string>();
    state.songs.forEach((song) => song.arranger?.trim() && values.add(song.arranger.trim()));
    return [...values].sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  }, [state.songs]);

  async function handleCreateCategory() {
    if (isCategoryLocked) {
      toast.error(categoryLockedTitle);
      return;
    }

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

  const canEditCategory = (categoryId: string, categoryName: string) =>
    !isCategoryLocked && categoryId !== "default-category" && categoryName.toLowerCase() !== "sem categoria";

  return (
    <aside className="flex w-60 flex-col gap-2.5 border-r border-white/20 bg-linear-to-b from-[rgba(35,52,72,0.94)] to-[rgba(55,78,106,0.9)] px-3 py-3 text-[#dce7f5]">
      {/* Biblioteca */}
      <div className="border-b border-white/15 pb-2">
        <div className="flex items-center gap-1.5 text-sm font-bold mb-1.5">
          <Library className="h-4 w-4" />
          Biblioteca
        </div>
        <nav className="flex flex-col">
          {libraryViews
            .filter(({ view }) => !isClient || view !== "drafts")
            .map(({ view, label, icon }) => (
              <SidebarItem
                key={typeof view === "string" ? view : view.id}
                icon={icon}
                label={label}
                active={isSidebarViewActive(currentView, view)}
                onClick={() => setSidebarView(view)}
              />
            ))}
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
              disabled={isSyncLocked}
              title={isSyncLocked ? categoryLockedTitle : "Adicionar categoria"}
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
              disabled={isCreatingCategory || isSyncLocked}
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
                active={isSidebarViewActive(currentView, {
                  type: "category",
                  id: cat.id,
                  name: cat.name,
                })}
                onClick={() =>
                  setSidebarView({
                    type: "category",
                    id: cat.id,
                    name: cat.name,
                  })
                }
                className="flex-1"
              />
              {canEditCategory(cat.id, cat.name) && (
                <button
                  type="button"
                  onClick={() => setCategoryToEdit({ id: cat.id, name: cat.name })}
                  title="Editar categoria"
                  className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded bg-transparent hover:bg-white/10 transition-all cursor-pointer border-0 text-white/70"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {canEditCategory(cat.id, cat.name) && (
                <button
                  type="button"
                  onClick={() =>
                    confirmation.requestConfirmation(
                      "Excluir categoria?",
                      `A categoria \"${cat.name}\" será removida. As músicas continuarão na biblioteca sem essa categoria.`,
                      async () => {
                        await deleteCategory(cat.id);
                      }
                    )
                  }
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

      <div className="border-t border-white/15 pt-2">
        <div className="mb-1.5 text-sm font-bold">Compositor</div>
        <nav className="flex flex-col">
          <SidebarItem
            label="Todos"
            active={state.authorFilters.composer === "all"}
            onClick={() => setAuthorFilters({ ...state.authorFilters, composer: "all" })}
          />
          <SidebarItem
            label="Sem compositor"
            active={state.authorFilters.composer === "none"}
            onClick={() => setAuthorFilters({ ...state.authorFilters, composer: "none" })}
          />
          {composerOptions.map((composer) => (
            <SidebarItem
              key={composer}
              label={composer}
              active={state.authorFilters.composer === composer}
              onClick={() => setAuthorFilters({ ...state.authorFilters, composer })}
            />
          ))}
        </nav>

        <div className="mt-2.5 mb-1.5 text-sm font-bold">Arranjador</div>
        <nav className="flex flex-col">
          <SidebarItem
            label="Todos"
            active={state.authorFilters.arranger === "all"}
            onClick={() => setAuthorFilters({ ...state.authorFilters, arranger: "all" })}
          />
          <SidebarItem
            label="Sem arranjador"
            active={state.authorFilters.arranger === "none"}
            onClick={() => setAuthorFilters({ ...state.authorFilters, arranger: "none" })}
          />
          {arrangerOptions.map((arranger) => (
            <SidebarItem
              key={arranger}
              label={arranger}
              active={state.authorFilters.arranger === arranger}
              onClick={() => setAuthorFilters({ ...state.authorFilters, arranger })}
            />
          ))}
        </nav>
      </div>
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        isLoading={confirmation.isLoading}
        onConfirm={() => {
          void confirmation.confirm();
        }}
        onCancel={confirmation.cancel}
      />
      <EditCategoryModal
        isOpen={categoryToEdit !== null}
        category={categoryToEdit}
        onClose={() => setCategoryToEdit(null)}
        onSave={async (categoryId, name) => {
          await updateCategory(categoryId, name);
          setCategoryToEdit(null);
        }}
      />
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

