import React, { useState } from "react";
import { FileMusic } from "lucide-react";
import toast from "react-hot-toast";
import * as api from "../api/commands";
import type { ScoreListItem } from "../types";
import { ContextMenu, ContextMenuItem } from "./SongRow";

interface ScoreRowProps {
  score: ScoreListItem;
  onSelectScore: () => void;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  onEdit: () => void;
  onStatusChange: (scoreId: string, status: "Main" | "Draft" | "Pending") => Promise<void>;
}

interface ConfirmationModal {
  isOpen: boolean;
  title: string;
  message: string;
  action: (() => Promise<void>) | null;
  isLoading: boolean;
}

function ScoreRow({
  score,
  onSelectScore,
  menuId,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
  onEdit,
  onStatusChange,
}: ScoreRowProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmationModal>({
    isOpen: false,
    title: "",
    message: "",
    action: null,
    isLoading: false,
  });

  const getStatusLabel = () => {
    switch (score.status) {
      case "Draft":
        return "Rascunho";
      case "Pending":
        return "Pendente";
      case "Main":
        return "Principal";
      case "NotFound":
        return "Não Encontrado";
      default:
        return score.status;
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpening(true);
    try {
      await api.openFile(score.id);
    } catch (err) {
      console.error("Failed to open file:", err);
      toast.error("Erro ao abrir arquivo");
    } finally {
      setIsOpening(false);
    }
  };

  const handleSetAsMain = () => {
    setConfirmModal({
      isOpen: true,
      title: "Definir como Principal",
      message: "Você realmente deseja mudar o arquivo para \"Principal\"?",
      action: async () => {
        try {
          await onStatusChange(score.id, "Main");
          onMenuClose();
        } catch (err) {
          console.error("Failed to set score as main:", err);
          toast.error("Erro ao definir como Principal");
        }
      },
      isLoading: false,
    });
  };

  const handleSetAsDraft = () => {
    setConfirmModal({
      isOpen: true,
      title: "Definir como Rascunho",
      message: "Você realmente deseja mudar o arquivo para \"Rascunho\"?",
      action: async () => {
        try {
          await onStatusChange(score.id, "Draft");
          onMenuClose();
        } catch (err) {
          console.error("Failed to set score as draft:", err);
          toast.error("Erro ao definir como Rascunho");
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
        onClick={(e) => {
          e.stopPropagation();
          onSelectScore();
        }}
        onDoubleClick={handleDoubleClick}
        title={isOpening ? "Abrindo arquivo..." : "Duplo clique para abrir"}
        className={`border-b border-[#d8e0ea] text-sm text-[#4a6278] cursor-pointer transition-colors ${isOpening ? "opacity-60" : ""}`}
      >
        <td className="px-3.5 py-1.5 pl-9">
          <span className="flex items-center gap-1.5">
            <FileMusic className={`h-3.5 w-3.5 text-[#8fa3b8] ${isOpening ? "animate-pulse" : ""}`} />
            {score.name ?? "Sem instrumento"}
          </span>
        </td>
        <td className="px-3.5 py-1.5 text-xs text-[#8b9db2]">.{score.file_extension}</td>
        <td className="px-2 py-1.5 text-xs font-medium">
          <div className="flex items-center justify-between">
            <span 
              className={`inline-block text-[#4a6278] 
                ${score.status === "Draft" && "bg-orange-100 p-2 rounded-full"}
                ${score.status === "Pending" && "bg-yellow-100 p-2 rounded-full"}
                ${score.status === "Main" && "bg-green-100 p-2 rounded-full"}
                ${score.status === "NotFound" && "bg-red-100 p-2 rounded-full"}
              `}>
              {getStatusLabel()}
            </span>

            <div className="flex items-center justify-end px-3">
              <ContextMenu
                isOpen={isMenuOpen}
                onToggle={(e) => {
                  e.stopPropagation();
                  isMenuOpen ? onMenuClose() : onMenuOpen(menuId);
                }}
              >
                <ContextMenuItem
                  label="Abrir"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDoubleClick(e);
                    onMenuClose();
                  }}
                  disabled={score.status === "NotFound"}
                />
                {score.status === "Draft" && (
                  <ContextMenuItem
                    label="Definir como Principal"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetAsMain();
                    }}
                  />
                )}
                {score.status === "Main" && (
                  <ContextMenuItem
                    label="Definir como Rascunho"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetAsDraft();
                    }}
                  />
                )}
                <ContextMenuItem
                  label="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                    onMenuClose();
                  }}
                  isLast
                />
              </ContextMenu>
            </div>
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

export const MemoizedScoreRow = React.memo(ScoreRow, (prev, next) => {
  return (
    prev.score.id === next.score.id &&
    prev.score.name === next.score.name &&
    prev.score.status === next.score.status &&
    prev.isMenuOpen === next.isMenuOpen
  );
});
