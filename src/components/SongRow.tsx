import React from "react";
import { ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import type { SongListItem } from "../types";

interface SongRowProps {
  song: SongListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onAddFile: () => void;
  onAddDirectory: () => void;
  onEdit: () => void;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
}

function SongRow({
  song,
  isExpanded,
  onToggle,
  onToggleFavorite,
  onAddFile,
  onAddDirectory,
  onEdit,
  menuId,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
}: SongRowProps) {
  const author = [song.composer, song.arranger].filter(Boolean).join(" / ");

  return (
    <tr
      className={`border-b border-[#d8e0ea] text-sm text-[#344b61] ${
        isExpanded ? "bg-[#eef3f9] font-bold" : "hover:bg-[#f2f5fa]"
      } cursor-pointer transition-colors`}
      onClick={onToggle}
    >
      <td className="px-3.5 py-2">
        <span className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#7b8da1] flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#7b8da1] flex-shrink-0" />
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
          >
            <ContextMenuItem
              label={song.is_favorite ? "Remover de favoritos" : "Adicionar aos favoritos"}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); onMenuClose(); }}
            />
            <ContextMenuItem
              label="Adicionar arquivo"
              onClick={(e) => { e.stopPropagation(); onAddFile(); onMenuClose(); }}
            />
            <ContextMenuItem
              label="Adicionar diretório"
              onClick={(e) => { e.stopPropagation(); onAddDirectory(); onMenuClose(); }}
            />
            <ContextMenuItem
              label="Editar"
              onClick={(e) => { e.stopPropagation(); onEdit(); onMenuClose(); }}
              isLast
            />
          </ContextMenu>
        </div>
      </td>
    </tr>
  );
}

export const MemoizedSongRow = React.memo(SongRow, (prev, next) => {
  return (
    prev.song.id === next.song.id &&
    prev.song.name === next.song.name &&
    prev.song.composer === next.song.composer &&
    prev.song.arranger === next.song.arranger &&
    prev.song.is_favorite === next.song.is_favorite &&
    prev.song.scores.length === next.song.scores.length &&
    prev.song.category_ids.length === next.song.category_ids.length &&
    prev.isExpanded === next.isExpanded &&
    prev.isMenuOpen === next.isMenuOpen
  );
});

// ── Shared menu primitives ──

function ContextMenu({
  isOpen,
  onToggle,
  children,
}: {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="p-1 rounded transition-colors hover:bg-white/20"
        title="Menu de ações"
      >
        <MoreVertical className="h-4 w-4 text-[#8b9db2]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#c5cfdb] rounded shadow-lg z-50 w-48">
          {children}
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({
  label,
  onClick,
  isLast,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 hover:bg-[#f2f5fa] text-sm text-[#344b61] transition-colors ${
        isLast ? "" : "border-b border-[#e8ecf0]"
      }`}
    >
      {label}
    </button>
  );
}

export { ContextMenu, ContextMenuItem };
