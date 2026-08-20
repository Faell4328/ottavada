import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";
import { open } from "@tauri-apps/plugin-dialog";
import toast from "../utils/toast";
import { useTranslation } from "react-i18next";
import type { SongListItem } from "../types";
import { ContextMenu, ContextMenuItem } from "./ui/ContextMenu";
import { isClientComputer } from "../utils/computer";
import {
  getScoreStatusBadgeClass,
  getScoreStatusLabel,
} from "../utils/scoreStatus";
import { getCategoryNames } from "../utils/songCategories";
import type { Category } from "../types";
import * as api from "../api/commands";

export interface SongRowProps {
  song: SongListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: (songId: string) => Promise<void>;
  onDeleteWithFiles: (songId: string) => Promise<void>;
  onStatusChange: (songId: string, status: "main" | "draft") => Promise<void>;
  onReindex: () => Promise<void>;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  computerType?: string;
  isLocked: boolean;
  categories: Category[];
}

const SongRow = React.forwardRef<HTMLTableRowElement, SongRowProps>(
  function SongRow(
    {
      song,
      isExpanded,
      onToggle,
      onToggleFavorite,
      onEdit,
      onDelete,
      onDeleteWithFiles,
      onStatusChange,
      onReindex,
      menuId,
      isMenuOpen,
      onMenuOpen,
      onMenuClose,
      computerType,
      isLocked,
      categories,
    }: SongRowProps,
    ref,
  ) {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false);
    const { t } = useTranslation();
    useScrollLock(isDeleteModalOpen);
    const author = [song.composer, song.arranger].filter(Boolean).join(" / ");
    const categoryNames = getCategoryNames(song.category_ids, categories);
    const categoryLabel = categoryNames.join(", ");
    const isClient = isClientComputer(computerType);
    const isActionLocked = isClient || isLocked;
    const openLocalTarget = song.path.trim();
    const isDraft = song.status === "draft";
    const isNotFound = song.status === "not_found";
    const isHighlighted = isDraft || isNotFound;
    const handleMenuAction = (e: React.MouseEvent, action: () => void) => {
      e.stopPropagation();
      action();
      onMenuClose();
    };

    const handleOpenLocal = async () => {
      if (!openLocalTarget) {
        return;
      }

      try {
        await api.openFileLocation(openLocalTarget);
      } catch (err) {
        console.error("Failed to open song location:", err);
        toast.error(t("songRow.openSongError"));
      }
    };

    const handleOpenClientTempDir = async () => {
      try {
        await api.openSongTempDir(song.id);
      } catch (err) {
        console.error("Failed to open song temp dir:", err);
        toast.error(t("songRow.openScoreError"));
      }
    };

    const handleReindex = async () => {
      try {
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected !== "string" || !selected) {
          return;
        }

        await api.reindexSongDirectory(song.id, selected);
        await onReindex();
      } catch (err) {
        console.error("Failed to reindex song:", err);
        toast.error(t("songRow.reindexError"));
      }
    };

    const handleDelete = () => {
      setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
      if (!isDeleteLoading) {
        setIsDeleteModalOpen(false);
      }
    };

    const runDeleteAction = async (action: () => Promise<void>, successMessage?: string) => {
      setIsDeleteLoading(true);
      try {
        await action();
        if (successMessage) {
          toast.success(successMessage);
        }
        setIsDeleteModalOpen(false);
        onMenuClose();
      } catch (err) {
        console.error("Failed to delete song:", err);
        toast.error(t("songRow.deleteError"));
      } finally {
        setIsDeleteLoading(false);
      }
    };

    return (
      <>
        <tr
          ref={(node) => {
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          id={`song-row-${song.id}`}
          style={{
            scrollMarginTop: "4.75rem",
            contentVisibility: "auto",
            containIntrinsicSize: "44px",
          }}
          className={`border-b border-[#d8e0ea] text-sm transition-colors ${
            isNotFound
              ? "bg-[#fff1f2] text-[#8f3232] hover:bg-[#ffe4e6]"
              : isDraft
                ? "bg-[#fff7ed] text-[#7c4a10] hover:bg-[#fdeccf]"
                : "bg-white text-[#344b61] hover:bg-[#f7f9fc]"
          } cursor-pointer`}
          onClick={onToggle}
        >
          <td className="px-3.5 py-2">
            <span className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-[#7b8da1] shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[#7b8da1] shrink-0" />
              )}
              <span className="font-bold truncate">{song.name}</span>
            </span>
          </td>
          <td
            className={`px-3.5 py-2 ${isHighlighted ? "text-[#965050]" : "text-[#5c7089]"}`}
          >
            {author || "—"}
          </td>
          <td
            className={`px-3.5 py-2 truncate ${isHighlighted ? "text-[#965050]" : "text-[#5c7089]"}`}
            title={categoryLabel || undefined}
          >
            {categoryLabel || "—"}
          </td>
          <td className="px-3.5 py-2">
            <div className="flex items-center justify-between">
              {isClient ? (
                <span />
              ) : (
                <span className={getScoreStatusBadgeClass(song.status)}>
                  {getScoreStatusLabel(song.status)}
                </span>
              )}
              <ContextMenu
                isOpen={isMenuOpen}
                onToggle={(e) => {
                  e.stopPropagation();
                  isMenuOpen ? onMenuClose() : onMenuOpen(menuId);
                }}
                onClose={onMenuClose}
                disabled={false}
              >
                {!isNotFound &&
                  (isClient ? (
                    <>
                      <ContextMenuItem
                        label={t("songRow.open")}
                        onClick={(e) => handleMenuAction(e, onToggle)}
                      />
                      <ContextMenuItem
                        label={t("songRow.openLocal")}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleOpenClientTempDir();
                          onMenuClose();
                        }}
                      />
                      <ContextMenuItem
                        label={
                          song.is_favorite
                            ? t("songRow.removeFromFavorites")
                            : t("songRow.addToFavorites")
                        }
                        onClick={(e) => handleMenuAction(e, onToggleFavorite)}
                        isLast
                      />
                    </>
                  ) : (
                    <ContextMenuItem
                      label={t("songRow.open")}
                      onClick={(e) => handleMenuAction(e, onToggle)}
                      disabled={isActionLocked}
                    />
                  ))}
                {!isClient && !isNotFound && (
                  <ContextMenuItem
                    label={t("songRow.openLocal")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleOpenLocal();
                      onMenuClose();
                    }}
                    disabled={!openLocalTarget}
                  />
                )}
                {!isClient && isNotFound && (
                  <>
                  <ContextMenuItem
                    label={t("songRow.reindexDirectory")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMenuClose();
                        void handleReindex();
                      }}
                      disabled={isActionLocked}
                    />
                  <ContextMenuItem
                    label={t("songRow.stopIndexing")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMenuClose();
                        void onDelete(song.id);
                      }}
                      disabled={isActionLocked}
                      isLast
                    />
                  </>
                )}
                {!isClient && !isNotFound && (
                  <>
                    <ContextMenuItem
                      label={
                        isDraft ? t("songRow.allowSend") : t("songRow.disallowSend")
                      }
                      onClick={(e) =>
                        handleMenuAction(e, () => {
                          void Promise.resolve(
                            onStatusChange(song.id, isDraft ? "main" : "draft"),
                          ).catch((err) => {
                            console.error("Failed to update song status:", err);
                          });
                        })
                      }
                      disabled={isActionLocked}
                    />
                    <ContextMenuItem
                      label={
                        song.is_favorite
                          ? t("songRow.removeFromFavorites")
                          : t("songRow.addToFavorites")
                      }
                      onClick={(e) => handleMenuAction(e, onToggleFavorite)}
                      disabled={isActionLocked}
                    />
                    <ContextMenuItem
                      label={t("songRow.edit")}
                      onClick={(e) => handleMenuAction(e, onEdit)}
                      disabled={isActionLocked}
                    />
                    <ContextMenuItem
                      label={t("songRow.remove")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                      disabled={isActionLocked}
                      isLast
                    />
                  </>
                )}
              </ContextMenu>
            </div>
          </td>
        </tr>

        {isDeleteModalOpen && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-lg rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-6 shadow-xl">
                <h2 className="mb-3 text-lg font-semibold text-[#2f4259]">
                  {t("songRow.deletion")}
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={closeDeleteModal}
                    disabled={isDeleteLoading}
                    className="rounded-lg border border-[#c5cfdb] px-4 py-2 text-sm font-medium text-[#344b61] transition-colors hover:bg-[#eef2f6] disabled:opacity-50"
                  >
                    {t("songRow.cancel")}
                  </button>
                  <button
                    onClick={() => {
                      void runDeleteAction(() => onDelete(song.id));
                    }}
                    disabled={isDeleteLoading}
                    className="rounded-lg border border-[#4f84d7] px-4 py-2 text-sm font-medium text-[#4f84d7] transition-colors hover:bg-[#edf4ff] disabled:opacity-50"
                  >
                    {t("songRow.stopIndexing")}
                  </button>
                  <button
                    onClick={() => {
                      void runDeleteAction(() => onDeleteWithFiles(song.id));
                    }}
                    disabled={isDeleteLoading}
                    className="rounded-lg bg-[#c04b4b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#a93b3b] disabled:opacity-50"
                  >
                    {isDeleteLoading
                      ? t("songRow.processing")
                      : t("songRow.moveToTrash")}
                  </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  },
);

SongRow.displayName = "SongRow";

export function areSongRowPropsEqual(prev: SongRowProps, next: SongRowProps) {
  return (
    prev.song.id === next.song.id &&
    prev.song.name === next.song.name &&
    prev.song.composer === next.song.composer &&
    prev.song.arranger === next.song.arranger &&
    prev.song.is_favorite === next.song.is_favorite &&
    prev.song.path === next.song.path &&
    prev.song.status === next.song.status &&
    prev.song.scores.length === next.song.scores.length &&
    prev.song.category_ids.length === next.song.category_ids.length &&
    prev.song.category_ids.every((id, index) => next.song.category_ids[index] === id) &&
    prev.categories === next.categories &&
    prev.isExpanded === next.isExpanded &&
    prev.isMenuOpen === next.isMenuOpen &&
    prev.isLocked === next.isLocked &&
    prev.computerType === next.computerType
  );
}

export const MemoizedSongRow = React.memo(SongRow, areSongRowPropsEqual);

MemoizedSongRow.displayName = "MemoizedSongRow";
