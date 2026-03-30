import React, { useState } from "react";
import { FileMusic } from "lucide-react";
import toast from "react-hot-toast";
import * as api from "../api/commands";
import type { ScoreListItem } from "../types";
import { ContextMenu, ContextMenuItem } from "./ui/ContextMenu";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { useConfirmation } from "../hooks/useConfirmation";

interface ScoreRowProps {
  score: ScoreListItem;
  onSelectScore: () => void;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  onEdit: () => void;
  onStatusChange: (scoreId: string, status: "main") => Promise<void>;
  onDelete: (scoreId: string) => Promise<void>;
  computerType?: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-orange-100 p-2 rounded-full",
  pending: "bg-yellow-100 p-2 rounded-full",
  main: "bg-green-100 p-2 rounded-full",
  not_found: "bg-red-100 p-2 rounded-full",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  main: "Principal",
  not_found: "Não Encontrado",
};

function ScoreRow({
  score,
  onSelectScore,
  menuId,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
  onEdit,
  onStatusChange,
  onDelete,
  computerType,
}: ScoreRowProps) {
  const [isOpening, setIsOpening] = useState(false);
  const confirmation = useConfirmation();
  const isClient = computerType === "Client";
  const rawStatus = String(score.status ?? "");
  const statusKey = rawStatus
    // Convert camelCase / PascalCase to snake_case (e.g. NotFound -> not_found)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    // Replace spaces or dashes with underscore
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusKey === "not_found") {
      toast.error("Arquivo não encontrado");
      return;
    }
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
    confirmation.requestConfirmation(
      "Definir como Principal",
      "Você realmente deseja mudar o arquivo para \"Principal\"?",
      async () => {
        try {
          await onStatusChange(score.id, "main");
          onMenuClose();
        } catch (err) {
          console.error("Failed to set score as main:", err);
          toast.error("Erro ao definir como Principal");
        }
      }
    );
  };

  const handleDelete = () => {
    confirmation.requestConfirmation(
      "Deletar Partitura",
      "Você realmente deseja deletar esta partitura? Seu arquivo irá continuar localmente, será removido apenas do sistema.",
      async () => {
        try {
          await onDelete(score.id);
          onMenuClose();
        } catch (err) {
          console.error("Failed to delete score:", err);
          toast.error("Erro ao deletar partitura");
        }
      }
    );
  };

  return (
    <>
      <tr
        onClick={(e) => {
          e.stopPropagation();
          onSelectScore();
        }}
        onDoubleClick={statusKey === "not_found" ? undefined : handleDoubleClick}
        title={
          isOpening
            ? "Abrindo arquivo..."
            : statusKey === "not_found"
            ? "Arquivo não encontrado"
            : "Duplo clique para abrir"
        }
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
            <span className={`inline-block text-[#4a6278] ${STATUS_STYLES[statusKey] ?? ""}`}>
              {STATUS_LABELS[statusKey] ?? score.status}
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
                  disabled={statusKey === "not_found"}
                />
                {statusKey === "draft" && !isClient && (
                  <ContextMenuItem
                    label="Definir como Principal"
                    onClick={(e) => { e.stopPropagation(); handleSetAsMain(); }}
                  />
                )}
                {isClient ? (
                  <ContextMenuItem
                    label="Editar (não permitido para cliente)"
                    onClick={(e) => { e.stopPropagation(); toast.error("Operação não permitida para cliente"); }}
                  />
                ) : (
                  <ContextMenuItem
                    label="Editar"
                    onClick={(e) => { e.stopPropagation(); onEdit(); onMenuClose(); }}
                  />
                )}
                {isClient ? (
                  <ContextMenuItem
                    label="Deletar (não permitido para cliente)"
                    onClick={(e) => { e.stopPropagation(); toast.error("Operação não permitida para cliente"); }}
                    isLast
                  />
                ) : (
                  <ContextMenuItem
                    label="Deletar"
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    isLast
                  />
                )}
              </ContextMenu>
            </div>
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
}

export const MemoizedScoreRow = React.memo(ScoreRow, (prev, next) => {
  const norm = (s: any) =>
    String(s ?? "")
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[\s-]+/g, "_")
      .toLowerCase();

  return (
    prev.score.id === next.score.id &&
    prev.score.name === next.score.name &&
    norm(prev.score.status) === norm(next.score.status) &&
    prev.isMenuOpen === next.isMenuOpen
  );
});
