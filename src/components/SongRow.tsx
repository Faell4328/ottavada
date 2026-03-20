import React, { useState } from "react";
import { ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import toast from "react-hot-toast";
import type { SongListItem } from "../types";

interface ConfirmationModal {
  isOpen: boolean;
  title: string;
  message: string;
  action: (() => Promise<void>) | null;
  isLoading: boolean;
}

interface SongRowProps {
  song: SongListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onAddFile: () => void;
  onAddDirectory: () => void;
  onEdit: () => void;
  onDelete: (songId: string) => Promise<void>;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  computerType?: string;
}

function SongRow({
  song,
  isExpanded,
  onToggle,
  onToggleFavorite,
  onAddFile,
  onAddDirectory,
  onEdit,
  onDelete,
  menuId,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
  computerType,
}: SongRowProps) {
  const [confirmModal, setConfirmModal] = useState<ConfirmationModal>({
    isOpen: false,
    title: "",
    message: "",
    action: null,
    isLoading: false,
  });

  const author = [song.composer, song.arranger].filter(Boolean).join(" / ");

  const handleDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: "Deletar Música",
      message: "Você realmente deseja deletar esta música? Esta ação não pode ser desfeita.",
      action: async () => {
        try {
          await onDelete(song.id);
          onMenuClose();
        } catch (err) {
          console.error("Failed to delete song:", err);
          toast.error("Erro ao deletar música");
        }
      },
      isLoading: false,
    });
  };

  const handleConfirm = async () => {
    if (!confirmModal.action) return;
    setConfirmModal({ ...confirmModal, isLoading: true });
    try {
      await confirmModal.action();
    } finally {
      setConfirmModal({
        isOpen: false,
        title: "",
        message: "",
        action: null,
        isLoading: false,
      });
    }
  };

  const handleCloseModal = () => {
    if (!confirmModal.isLoading) {
      setConfirmModal({
        isOpen: false,
        title: "",
        message: "",
        action: null,
        isLoading: false,
      });
    }
  };

  return (
    <>
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
            {computerType !== "Client" && (
              <>
                <ContextMenuItem
                  label="Adicionar arquivo"
                  onClick={(e) => { e.stopPropagation(); onAddFile(); onMenuClose(); }}
                />
                <ContextMenuItem
                  label="Adicionar diretório"
                  onClick={(e) => { e.stopPropagation(); onAddDirectory(); onMenuClose(); }}
                />
              </>
            )}
            {computerType === "Client" && (
              <>
                <ContextMenuItem
                  label="Adicionar arquivo (não permitido)"
                  onClick={(e) => { e.stopPropagation(); toast.error("Operação não permitida para cliente"); }}
                />
                <ContextMenuItem
                  label="Adicionar diretório (não permitido)"
                  onClick={(e) => { e.stopPropagation(); toast.error("Operação não permitida para cliente"); }}
                />
              </>
            )}
            <ContextMenuItem
              label="Editar"
              onClick={(e) => { e.stopPropagation(); onEdit(); onMenuClose(); }}
            />
            {computerType !== "Client" && (
              <ContextMenuItem
                label="Deletar"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                isLast={computerType !== "Client"}
              />
            )}
            {computerType === "Client" && (
              <ContextMenuItem
                label="Deletar (não permitido para cliente)"
                onClick={(e) => { e.stopPropagation(); toast.error("Operação não permitida para cliente"); }}
                isLast
              />
            )}
          </ContextMenu>
        </div>
      </td>
    </tr>

    {confirmModal.isOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-[#f8fafd] rounded-lg shadow-xl border border-[#c5cfdb] p-6 max-w-sm w-full mx-4">
          <h2 className="text-lg font-semibold text-[#2f4259] mb-3">
            {confirmModal.title}
          </h2>
          <p className="text-sm text-[#4a6278] mb-6">
            {confirmModal.message}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCloseModal}
              disabled={confirmModal.isLoading}
              className="px-4 py-2 text-sm font-medium text-[#344b61] border border-[#c5cfdb] rounded-lg hover:bg-[#eef2f6] disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirmModal.isLoading}
              className="px-4 py-2 text-sm font-medium bg-[#4f84d7] text-white rounded-lg hover:bg-[#3d6fb8] disabled:opacity-50 transition-colors"
            >
              {confirmModal.isLoading ? "Processando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
      )}

    </>
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
  disabled,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  isLast?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 hover:bg-[#f2f5fa] text-sm text-[#344b61] transition-colors ${
        isLast ? "" : "border-b border-[#e8ecf0]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}

export { ContextMenu, ContextMenuItem };
