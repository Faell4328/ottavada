import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileEdit,
  Archive,
  Trash2,
  ArrowUpCircle,
  History,
} from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { FileVersion } from "../types";

export default function VersionPanel() {
  const { state, promoteDraft, deleteVersion } = useAppState();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!state.selectedFile) {
    return (
      <aside className="flex w-[300px] flex-col items-center justify-center bg-[#eff3f8] p-3 text-[#8b9db2]">
        <History className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm text-center">
          Selecione um instrumento para ver o histórico de versões
        </p>
      </aside>
    );
  }

  const instrumentLabel =
    state.selectedFile.instrument ?? "Sem instrumento";
  const hasDraft = state.versions.some((v) => v.status === "Draft");

  async function handleDelete(versionId: string) {
    await deleteVersion(versionId);
    setConfirmDeleteId(null);
  }

  return (
    <aside className="flex w-[300px] flex-col bg-[#eff3f8] p-3">
      {/* Header */}
      <div className="mb-2.5 text-[#2f455e]">
        <div className="text-xs font-semibold">Histórico de Versões:</div>
        <div className="text-base font-bold">
          {state.selectedScore?.title} — {instrumentLabel}
        </div>
      </div>

      {/* Version list */}
      <div className="flex flex-1 flex-col gap-2 overflow-auto">
        {state.versions.length === 0 ? (
          <p className="text-xs text-[#8b9db2] text-center py-4">
            Nenhuma versão registrada
          </p>
        ) : (
          state.versions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              isConfirmingDelete={confirmDeleteId === version.id}
              onDelete={() => {
                if (confirmDeleteId === version.id) {
                  handleDelete(version.id);
                } else {
                  setConfirmDeleteId(version.id);
                }
              }}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-col gap-1.5">
        {hasDraft && (
          <button
            type="button"
            onClick={() => {
              const draft = state.versions.find((v) => v.status === "Draft");
              if (draft) promoteDraft(draft.id);
            }}
            className="flex h-9 items-center justify-center gap-2 rounded border border-[#4f84d7] bg-[#4f84d7] px-3 text-[13px] font-semibold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Definir Nova Versão
          </button>
        )}
      </div>
    </aside>
  );
}

function VersionCard({
  version,
  isConfirmingDelete,
  onDelete,
  onCancelDelete,
}: {
  version: FileVersion;
  isConfirmingDelete: boolean;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  const statusConfig = getStatusConfig(version.status);

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-all ${statusConfig.style}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <statusConfig.icon
          className={`h-4 w-4 shrink-0 ${statusConfig.iconColor}`}
        />
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight truncate">
            {version.label ?? `V${version.version_number}`}
          </div>
          <div
            className={`text-[11px] ${
              version.status === "Current" ? "text-white/80" : "text-[#6b849e]"
            }`}
          >
            {formatDate(version.created_at)}
            {version.is_compressed && " (compactado)"}
          </div>
        </div>
      </div>

      {version.status !== "Current" && (
        <div className="flex items-center gap-1 ml-2">
          {isConfirmingDelete ? (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="text-[10px] text-red-500 hover:text-red-600 bg-transparent border-0 cursor-pointer font-bold"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="text-[10px] text-[#8b9db2] hover:text-[#6b849e] bg-transparent border-0 cursor-pointer"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded bg-transparent hover:bg-black/5 border-0 cursor-pointer transition-colors"
              title="Deletar versão"
            >
              <Trash2 className="h-3.5 w-3.5 text-[#8b9db2] hover:text-red-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusConfig(status: FileVersion["status"]) {
  switch (status) {
    case "Current":
      return {
        icon: CheckCircle2,
        iconColor: "text-white",
        style:
          "bg-gradient-to-b from-[#4f84d7] to-[#2d62b8] text-white border-transparent",
      };
    case "Draft":
      return {
        icon: FileEdit,
        iconColor: "text-amber-500",
        style: "bg-white border-amber-300 text-[#34485d]",
      };
    case "Compressed":
      return {
        icon: Archive,
        iconColor: "text-blue-400",
        style: "bg-[#f5f8fc] border-[#cad4df] text-[#34485d]",
      };
    default:
      return {
        icon: Circle,
        iconColor: "text-green-500",
        style: "bg-[#f7fafe] border-[#cad4df] text-[#34485d]",
      };
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
