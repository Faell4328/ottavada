import React, { useState } from "react";
import { FileMusic } from "lucide-react";
import toast from "react-hot-toast";
import * as api from "../api/commands";
import type { ScoreListItem } from "../types";
import { ContextMenu, ContextMenuItem } from "./ui/ContextMenu";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { useConfirmation } from "../hooks/useConfirmation";
import { isClientComputer } from "../utils/computer";
import {
  getScoreStatusBadgeClass,
  getScoreStatusLabel,
  normalizeScoreStatus,
} from "../utils/scoreStatus";

export interface ScoreRowProps {
  score: ScoreListItem;
  displayIndex: number;
  onSelectScore: () => void;
  menuId: string;
  isMenuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  onEdit: () => void;
  onStatusChange: (scoreId: string, status: "main" | "draft" | "ignored") => Promise<void>;
  onDelete: (scoreId: string) => Promise<void>;
  onUseAsBase: () => void;
  computerType?: string;
  isLocked: boolean;
}

function ScoreRow({
  score,
  displayIndex,
  onSelectScore,
  menuId,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
  onEdit,
  onStatusChange,
  onDelete,
  onUseAsBase,
  computerType,
  isLocked,
}: ScoreRowProps) {
  const [isOpening, setIsOpening] = useState(false);
  const confirmation = useConfirmation();
  const isClient = isClientComputer(computerType);
  const isActionLocked = isClient || isLocked;
  const statusKey = normalizeScoreStatus(score.status);
  const rowBackgroundClass = displayIndex % 2 === 0 ? "bg-[#f4f7fb]" : "bg-[#fff]";

  const openScoreFile = async () => {
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

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await openScoreFile();
  };

  const requestStatusChange = (
    nextStatus: "main" | "draft" | "ignored",
    title: string,
    message: string,
    errorMessage: string
  ) => {
    confirmation.requestConfirmation(
      title,
      message,
      async () => {
        try {
          await onStatusChange(score.id, nextStatus);
          onMenuClose();
        } catch (err) {
          console.error("Failed to change score status:", err);
          toast.error(errorMessage);
        }
      }
    );
  };

  const renderStatusAction = () => {
    if (statusKey === "main") {
      return (
        <>
          <ContextMenuItem
            label="Definir como Rascunho"
            onClick={(e) => {
              e.stopPropagation();
              requestStatusChange(
                "draft",
                "Definir como Rascunho",
                'Você realmente deseja mudar o arquivo para "Rascunho"?',
                "Erro ao definir como Rascunho"
              );
            }}
            disabled={isActionLocked}
          />
          <ContextMenuItem
            label="Definir como Ignorar"
            onClick={(e) => {
              e.stopPropagation();
              requestStatusChange(
                "ignored",
                "Definir como Ignorar",
                'Você realmente deseja marcar esta partitura como "Ignorada"?',
                "Erro ao definir como Ignorar"
              );
            }}
            disabled={isActionLocked}
          />
        </>
      );
    }

    if (statusKey === "draft") {
      return (
        <>
          <ContextMenuItem
            label="Definir como Principal"
            onClick={(e) => {
              e.stopPropagation();
              requestStatusChange(
                "main",
                "Definir como Principal",
                'Você realmente deseja mudar o arquivo para "Principal"?',
                "Erro ao definir como Principal"
              );
            }}
            disabled={isActionLocked}
          />
          <ContextMenuItem
            label="Definir como Ignorar"
            onClick={(e) => {
              e.stopPropagation();
              requestStatusChange(
                "ignored",
                "Definir como Ignorar",
                'Você realmente deseja marcar esta partitura como "Ignorada"?',
                "Erro ao definir como Ignorar"
              );
            }}
            disabled={isActionLocked}
          />
        </>
      );
    }

    return (
      <>
        <ContextMenuItem
          label="Definir como Principal"
          onClick={(e) => {
            e.stopPropagation();
            requestStatusChange(
              "main",
              "Definir como Principal",
              'Você realmente deseja mudar o arquivo para "Principal"?',
              "Erro ao definir como Principal"
            );
          }}
          disabled={isActionLocked}
        />
        <ContextMenuItem
          label="Definir como Rascunho"
          onClick={(e) => {
            e.stopPropagation();
            requestStatusChange(
              "draft",
              "Definir como Rascunho",
              'Você realmente deseja reativar esta partitura como "Rascunho"?',
              "Erro ao definir como Rascunho"
            );
          }}
          disabled={isActionLocked}
        />
      </>
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
        onDoubleClick={handleDoubleClick}
        title={isOpening ? "Abrindo arquivo..." : "Duplo clique para abrir"}
        style={{
          contentVisibility: "auto",
          containIntrinsicSize: "34px",
        }}
        className={`border-b border-[#d8e0ea] text-sm text-[#4a6278] cursor-pointer transition-colors ${rowBackgroundClass} ${isOpening ? "opacity-60" : ""}`}
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
            <span className={`inline-block text-[#4a6278] ${getScoreStatusBadgeClass(statusKey)}`}>
              {getScoreStatusLabel(score.status)}
            </span>

            <div className="flex items-center justify-end px-3">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      void openScoreFile();
                      onMenuClose();
                    }}
                    disabled={isActionLocked}
                    isLast
                  />
                ) : (
                  <>
                    <ContextMenuItem
                      label="Abrir"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openScoreFile();
                        onMenuClose();
                      }}
                      disabled={isActionLocked}
                    />
                    {renderStatusAction()}
                    <ContextMenuItem
                      label="Editar"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                        onMenuClose();
                      }}
                      disabled={isActionLocked}
                    />
                    <ContextMenuItem
                      label="Usar Como Base"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseAsBase();
                        onMenuClose();
                      }}
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

export function areScoreRowPropsEqual(prev: ScoreRowProps, next: ScoreRowProps) {
  return (
    prev.score.id === next.score.id &&
    prev.score.name === next.score.name &&
    normalizeScoreStatus(prev.score.status) === normalizeScoreStatus(next.score.status) &&
    prev.displayIndex === next.displayIndex &&
    prev.isMenuOpen === next.isMenuOpen &&
    prev.isLocked === next.isLocked &&
    prev.computerType === next.computerType
  );
}

export const MemoizedScoreRow = React.memo(ScoreRow, areScoreRowPropsEqual);
