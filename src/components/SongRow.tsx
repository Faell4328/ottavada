import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import type { SongListItem } from "../types";
import { ContextMenu, ContextMenuItem } from "./ui/ContextMenu";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { useConfirmation } from "../hooks/useConfirmation";
import { isClientComputer } from "../utils/computer";

export interface SongRowProps {
  song: SongListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onAddFile: () => void;
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
    onAddFile,
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
  const confirmation = useConfirmation();
  const author = [song.composer, song.arranger].filter(Boolean).join(" / ");
  const isClient = isClientComputer(computerType);
  const isActionLocked = isClient || isLocked;
  const handleMenuAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    onMenuClose();
  };

  const handleDelete = () => {
    confirmation.requestConfirmation(
      "Deletar Música",
      "Você realmente deseja deletar esta música? Seu arquivo irá continuar localmente, será removido apenas do sistema.",
      async () => {
        try {
          await onDelete(song.id);
          onMenuClose();
        } catch (err) {
          console.error("Failed to delete song:", err);
          toast.error("Erro ao deletar música");
        }
      }
    );
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
              disabled={isActionLocked}
            >
              {isClient ? (
                <ContextMenuItem
                  label="Abrir"
                  onClick={(e) => handleMenuAction(e, onToggle)}
                  disabled={isActionLocked}
                  isLast
                />
              ) : (
                <>
                  <ContextMenuItem
                    label={song.is_favorite ? "Remover de favoritos" : "Adicionar aos favoritos"}
                    onClick={(e) => handleMenuAction(e, onToggleFavorite)}
                    disabled={isActionLocked}
                  />
                  <ContextMenuItem
                    label="Adicioanar arquivo(s)"
                    onClick={(e) => handleMenuAction(e, onAddFile)}
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

      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        isLoading={confirmation.isLoading}
        onConfirm={confirmation.confirm}
        onCancel={confirmation.cancel}
      />
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
