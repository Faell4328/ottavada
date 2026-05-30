import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import type { SongListItem } from "../types";
import { ContextMenu, ContextMenuItem } from "./ui/ContextMenu";
import { isClientComputer } from "../utils/computer";
import * as api from "../api/commands";

export interface SongRowProps {
  song: SongListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: (songId: string) => Promise<void>;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  computerType?: string;
  isLocked: boolean;
}

const SongRow = React.forwardRef<HTMLTableRowElement, SongRowProps>(function SongRow(
  {
    song,
    isExpanded,
    onToggle,
    onToggleFavorite,
    onEdit,
    onDelete,
    menuId,
    isMenuOpen,
    onMenuOpen,
    onMenuClose,
    computerType,
    isLocked,
  }: SongRowProps,
  ref
) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const author = [song.composer, song.arranger].filter(Boolean).join(" / ");
  const isClient = isClientComputer(computerType);
  const isActionLocked = isClient || isLocked;
  const openLocalTarget = song.path.trim();
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
      toast.error("Erro ao abrir local da música");
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

  const runDeleteAction = async (action: () => Promise<void>) => {
    setIsDeleteLoading(true);
    try {
      await action();
      setIsDeleteModalOpen(false);
      onMenuClose();
    } catch (err) {
      console.error("Failed to delete song:", err);
      toast.error("Erro ao deletar música");
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
        className={`border-b border-[#d8e0ea] text-sm text-[#344b61] ${
          isExpanded ? "bg-[#edf2f7] font-bold" : "bg-white hover:bg-[#f7f9fc]"
        } cursor-pointer transition-colors`}
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
        <td className="px-3.5 py-2 text-[#5c7089]">{author || "—"}</td>
        <td className="px-3.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[#5c7089]">—</span>
            <ContextMenu
              isOpen={isMenuOpen}
              onToggle={(e) => {
                e.stopPropagation();
                isMenuOpen ? onMenuClose() : onMenuOpen(menuId);
              }}
              disabled={false}
            >
              {isClient ? (
                <ContextMenuItem
                  label="Abrir"
                  onClick={(e) => handleMenuAction(e, onToggle)}
                  isLast={!openLocalTarget}
                />
              ) : (
                <ContextMenuItem
                  label="Abrir"
                  onClick={(e) => handleMenuAction(e, onToggle)}
                  disabled={isActionLocked}
                />
              )}
              <ContextMenuItem
                label="Abrir local"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleOpenLocal();
                  onMenuClose();
                }}
                    disabled={!openLocalTarget}
              />
              {!isClient && (
                <>
                  <ContextMenuItem
                    label={song.is_favorite ? "Remover de favoritos" : "Adicionar aos favoritos"}
                    onClick={(e) => handleMenuAction(e, onToggleFavorite)}
                    disabled={isActionLocked}
                  />
                  <ContextMenuItem
                    label="Editar"
                    onClick={(e) => handleMenuAction(e, onEdit)}
                    disabled={isActionLocked}
                  />
                  <ContextMenuItem
                    label="Deletar"
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
              <div className="w-full max-w-md rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-6 shadow-xl">
                <h2 className="mb-3 text-lg font-semibold text-[#2f4259]">Deletar Música</h2>
                <p className="mb-6 text-sm text-[#4a6278]">
                  O que você quer fazer com o diretório desta música?
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={closeDeleteModal}
                    disabled={isDeleteLoading}
                    className="rounded-lg border border-[#c5cfdb] px-4 py-2 text-sm font-medium text-[#344b61] transition-colors hover:bg-[#eef2f6] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      void runDeleteAction(() => onDelete(song.id));
                    }}
                    disabled={isDeleteLoading}
                    className="rounded-lg border border-[#4f84d7] px-4 py-2 text-sm font-medium text-[#4f84d7] transition-colors hover:bg-[#edf4ff] disabled:opacity-50"
                  >
                    Parar de indexar diretório
                  </button>
                  <button
                    onClick={() => {
                      void runDeleteAction(() => api.deleteSongWithFiles(song.id));
                    }}
                    disabled={isDeleteLoading}
                    className="rounded-lg bg-[#c04b4b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#a93b3b] disabled:opacity-50"
                  >
                    {isDeleteLoading ? "Processando..." : "Deletar diretório e arquivos"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
});

SongRow.displayName = "SongRow";

export function areSongRowPropsEqual(prev: SongRowProps, next: SongRowProps) {
  return (
    prev.song.id === next.song.id &&
    prev.song.name === next.song.name &&
    prev.song.composer === next.song.composer &&
    prev.song.arranger === next.song.arranger &&
    prev.song.is_favorite === next.song.is_favorite &&
    prev.song.path === next.song.path &&
    prev.song.scores.length === next.song.scores.length &&
    prev.song.category_ids.length === next.song.category_ids.length &&
    prev.isExpanded === next.isExpanded &&
    prev.isMenuOpen === next.isMenuOpen &&
    prev.isLocked === next.isLocked &&
    prev.computerType === next.computerType
  );
}

export const MemoizedSongRow = React.memo(SongRow, areSongRowPropsEqual);

MemoizedSongRow.displayName = "MemoizedSongRow";
