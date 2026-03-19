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
}

function ScoreRow({
  score,
  onSelectScore,
  menuId,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
  onEdit,
}: ScoreRowProps) {
  const [isOpening, setIsOpening] = useState(false);

  const getStatusLabel = () => {
    switch (score.status) {
      case "Draft":
        return "Rascunho";
      case "Pending":
        return "Pendente";
      case "Main":
        return "Principal";
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

  return (
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
            className={`{inline-block text-[#4a6278] 
              ${score.status === "Draft" && "bg-orange-100 p-2 rounded-full"}
              ${score.status === "Pending" && "bg-yellow-100 p-2 rounded-full"}
              ${score.status === "Main" && "bg-green-100 p-2 rounded-full"}
            }`}>
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
              />
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
