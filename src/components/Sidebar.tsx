import { useMemo, useState, type ReactNode } from "react";
import {
  Library,
  Heart,
  FileEdit,
  FileX,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppState } from "../context/AppContext";
import type { SidebarView } from "../types";
import { isClientComputer } from "../utils/computer";
import { isSidebarViewActive } from "../utils/sidebarView";
import { getRelatedAuthorOptions } from "../utils/songSearch";
import { useConfirmation } from "../hooks/useConfirmation";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { EditCategoryModal } from "./EditCategoryModal";
import { EditAuthorModal } from "./EditAuthorModal";
import { getCategoryDisplayName } from "../utils/categoryDisplay";
import toast from "../utils/toast";

export default function Sidebar() {
  const {
    state,
    setSidebarView,
    setAuthorFilters,
    createCategory,
    updateCategory,
    deleteCategory,
    updateAuthor,
    deleteAuthor,
  } = useAppState();
  const { t } = useTranslation();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [authorToEdit, setAuthorToEdit] = useState<{
    kind: "composer" | "arranger";
    name: string;
  } | null>(null);
  const confirmation = useConfirmation();

  const currentView = state.sidebarView;
  const isClient = isClientComputer(state.settings?.computer_type);
  const isSyncLocked =
    state.isScanningFiles ||
    state.rcloneProgress.active ||
    state.operationStatus.stepCurrent !== null;
  const isCategoryLocked = isClient || isSyncLocked;
  const categoryLockedTitle = isClient
    ? t("topBar.clientBlocked")
    : t("topBar.syncBlocked");
  const libraryViews: Array<{
    view: SidebarView;
    label: string;
    icon: ReactNode;
  }> = [
    {
      view: "all",
      label: t("sidebar.allSongs"),
      icon: <FolderOpen className="h-3.5 w-3.5" />,
    },
    {
      view: "favorites",
      label: t("sidebar.favorites"),
      icon: <Heart className="h-3.5 w-3.5" />,
    },
    {
      view: "drafts",
      label: t("sidebar.drafts"),
      icon: <FileEdit className="h-3.5 w-3.5" />,
    },
    {
      view: "not_found",
      label: t("sidebar.notFound"),
      icon: <FileX className="h-3.5 w-3.5" />,
    },
  ];

  const composerOptions = useMemo(() => {
    return getRelatedAuthorOptions(
      state.songs,
      "composer",
      state.authorFilters.arranger,
    );
  }, [state.songs, state.authorFilters.arranger]);

  const arrangerOptions = useMemo(() => {
    return getRelatedAuthorOptions(
      state.songs,
      "arranger",
      state.authorFilters.composer,
    );
  }, [state.songs, state.authorFilters.composer]);

  async function handleCreateCategory() {
    if (isCategoryLocked) {
      toast.error(categoryLockedTitle);
      return;
    }

    const name = newCategoryName.trim();
    if (!name) return;

    const existingCategory = state.categories.find(
      (cat) => cat.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
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
      console.error("Failed to create category:", error);
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleSubmitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleCreateCategory();
  }

  const canEditCategory = (categoryId: string, categoryName: string) =>
    !isCategoryLocked &&
    categoryId !== "default-category" &&
    categoryName.toLowerCase() !== "uncategorized";

  const canEditAuthor = (kind: "composer" | "arranger", authorName: string) =>
    !isCategoryLocked && authorName.toLowerCase() !== `no ${kind}`;

  const openEditAuthor = (kind: "composer" | "arranger", name: string) => {
    setAuthorToEdit({ kind, name });
  };

  return (
    <aside className="flex w-60 flex-col gap-2.5 border-r border-white/20 bg-[rgba(35,52,72,0.94)] px-3 py-3 text-[#dce7f5]">
      {/* Library */}
      <div className="border-b border-white/15 pb-2">
        <div className="flex items-center gap-1.5 text-sm font-bold mb-1.5">
          <Library className="h-4 w-4" />
          {t("sidebar.library")}
        </div>
        <nav className="flex flex-col">
          {libraryViews
            .filter(
              ({ view }) =>
                !isClient || (view !== "drafts" && view !== "not_found"),
            )
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

      {/* Categories */}
      <div>
        <div className="flex items-center justify-between text-sm font-bold mb-1.5">
          <span>{t("sidebar.categories")}</span>
          {!isClient && (
            <button
              type="button"
              onClick={() => setShowNewCategory(!showNewCategory)}
              disabled={isSyncLocked}
              title={isSyncLocked ? categoryLockedTitle : t("sidebar.addCategory")}
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
              placeholder={t("sidebar.categoryPlaceholder")}
              autoFocus
            />
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}

        <nav className="flex flex-col">
          {state.categories.map((cat) => (
            <div key={cat.id} className="group flex items-center border-0 border-b border-white/12">
              <SidebarItem
                label={getCategoryDisplayName(cat.name)}
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
                  onClick={() =>
                    setCategoryToEdit({ id: cat.id, name: cat.name })
                  }
                  title={t("sidebar.editCategory")}
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
                      t("sidebar.deleteCategoryTitle"),
                      t("sidebar.deleteCategoryMessage", { name: cat.name }),
                      async () => {
                        await deleteCategory(cat.id);
                      },
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
                {t("sidebar.noCategories")}
              </span>
          )}
        </nav>
      </div>

      <div className="border-t border-white/15 pt-2">
        <div className="mb-1.5 text-sm font-bold">{t("sidebar.composer")}</div>
        <nav className="flex flex-col overflow-y-auto max-h-77">
          <SidebarItem
            label={t("sidebar.all")}
            className="border-0 border-b border-white/12"
            active={state.authorFilters.composer === "all"}
            onClick={() =>
              setAuthorFilters({ ...state.authorFilters, composer: "all" })
            }
          />
          <SidebarItem
            label={t("sidebar.noComposer")}
            className="border-0 border-b border-white/12"
            active={state.authorFilters.composer === "none"}
            onClick={() =>
              setAuthorFilters({ ...state.authorFilters, composer: "none" })
            }
          />
          {composerOptions.map((composer) => (
            <div key={composer} className="group flex items-center border-0 border-b border-white/12">
              <SidebarItem
                label={composer}
                active={state.authorFilters.composer === composer}
                onClick={() =>
                  setAuthorFilters({ ...state.authorFilters, composer })
                }
                className="flex-1"
              />
              {canEditAuthor("composer", composer) && (
                <button
                  type="button"
                  onClick={() => openEditAuthor("composer", composer)}
                  title={t("sidebar.editComposer")}
                  className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded bg-transparent hover:bg-white/10 transition-all cursor-pointer border-0 text-white/70"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {canEditAuthor("composer", composer) && (
                <button
                  type="button"
                  onClick={() =>
                    confirmation.requestConfirmation(
                      t("sidebar.deleteComposerTitle"),
                      t("sidebar.deleteComposerMessage", { name: composer }),
                      async () => {
                        await deleteAuthor("composer", composer);
                      },
                    )
                  }
                  className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded bg-transparent hover:bg-red-500/20 transition-all cursor-pointer border-0 text-red-300/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-2.5 mb-1.5 text-sm font-bold">{t("sidebar.arranger")}</div>
        <nav className="flex flex-col overflow-y-auto max-h-77">
          <SidebarItem
            label={t("sidebar.all")}
            className="border-0 border-b border-white/12"
            active={state.authorFilters.arranger === "all"}
            onClick={() =>
              setAuthorFilters({ ...state.authorFilters, arranger: "all" })
            }
          />
          <SidebarItem
            label={t("sidebar.noArranger")}
            className="border-0 border-b border-white/12"
            active={state.authorFilters.arranger === "none"}
            onClick={() =>
              setAuthorFilters({ ...state.authorFilters, arranger: "none" })
            }
          />
          {arrangerOptions.map((arranger) => (
            <div key={arranger} className="group flex items-center border-0 border-b border-white/12">
              <SidebarItem
                label={arranger}
                active={state.authorFilters.arranger === arranger}
                onClick={() =>
                  setAuthorFilters({ ...state.authorFilters, arranger })
                }
                className="flex-1"
              />

              {canEditAuthor("arranger", arranger) && (
                <button
                  type="button"
                  onClick={() =>
                    confirmation.requestConfirmation(
                      t("sidebar.deleteArrangerTitle"),
                      t("sidebar.deleteArrangerMessage", { name: arranger }),
                      async () => {
                        await deleteAuthor("arranger", arranger);
                      },
                    )
                  }
                  className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded bg-transparent hover:bg-red-500/20 transition-all cursor-pointer border-0 text-red-300/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
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
      <EditAuthorModal
        isOpen={authorToEdit !== null}
        author={authorToEdit}
        onClose={() => setAuthorToEdit(null)}
        onSave={async (kind, oldName, newName) => {
          await updateAuthor(kind, oldName, newName);
          setAuthorToEdit(null);
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
      className={`flex w-full items-center gap-2 px-1 py-1.5 text-left text-[13px] transition-colors cursor-pointer ${
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
