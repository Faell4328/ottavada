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
  onStatusChange: (scoreId: string, status: "Main" | "Draft" | "Pending") => Promise<void>;
  onDelete: (scoreId: string) => Promise<void>;
  computerType?: string;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-orange-100 p-2 rounded-full",
  Pending: "bg-yellow-100 p-2 rounded-full",
  Main: "bg-green-100 p-2 rounded-full",
  NotFound: "bg-red-100 p-2 rounded-full",
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "Rascunho",
  Pending: "Pendente",
  Main: "Principal",
  NotFound: "Não Encontrado",
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

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (score.status === "NotFound") {
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
          await onStatusChange(score.id, "Main");
          onMenuClose();
        } catch (err) {
          console.error("Failed to set score as main:", err);
          toast.error("Erro ao definir como Principal");
        }
      }
    );
  };

  const handleSetAsDraft = () => {
    confirmation.requestConfirmation(
      "Definir como Rascunho",
      "Você realmente deseja mudar o arquivo para \"Rascunho\"?",
      async () => {
        try {
          await onStatusChange(score.id, "Draft");
          onMenuClose();
        } catch (err) {
          console.error("Failed to set score as draft:", err);
          toast.error("Erro ao definir como Rascunho");
        }
      }
    );
  };

  const handleDelete = () => {
    confirmation.requestConfirmation(
      "Deletar Partitura",
      "Você realmente deseja deletar esta partitura? Esta ação não pode ser desfeita.",
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
        onDoubleClick={score.status === "NotFound" ? undefined : handleDoubleClick}
        title={
          isOpening
            ? "Abrindo arquivo..."
            : score.status === "NotFound"
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
            <span className={`inline-block text-[#4a6278] ${STATUS_STYLES[score.status] ?? ""}`}>
              {STATUS_LABELS[score.status] ?? score.status}
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
                {score.status === "Draft" && !isClient && (
                  <ContextMenuItem
                    label="Definir como Principal"
                    onClick={(e) => { e.stopPropagation(); handleSetAsMain(); }}
                  />
                )}
                {score.status === "Main" && !isClient && (
                  <ContextMenuItem
                    label="Definir como Rascunho"
                    onClick={(e) => { e.stopPropagation(); handleSetAsDraft(); }}
                  />
                )}
                <ContextMenuItem
                  label="Editar"
                  onClick={(e) => { e.stopPropagation(); onEdit(); onMenuClose(); }}
                />
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
  return (
    prev.score.id === next.score.id &&
    prev.score.name === next.score.name &&
    prev.score.status === next.score.status &&
    prev.isMenuOpen === next.isMenuOpen
  );
});
