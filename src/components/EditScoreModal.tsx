import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { SongListItem, ScoreListItem } from "../types";

interface EditScoreModalProps {
  isOpen: boolean;
  score: SongListItem | null;
  instrument: ScoreListItem | null;
  onClose: () => void;
  onSave: (data: {
    songId: string;
    scoreFileId: string;
    instrumentName: string | null;
    filePath: string;
  }) => Promise<void>;
}

export function EditScoreModal({
  isOpen,
  score,
  instrument,
  onClose,
  onSave,
}: EditScoreModalProps) {
  const [instrumentName, setInstrumentName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && score && instrument) {
      setInstrumentName(instrument.name || "");
      setFilePath(instrument.file_path || "");
      setError("");
    }
  }, [isOpen, score, instrument]);

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [
          {
            name: "Partituras",
            extensions: ["pdf", "PDF", "mus", "MUS", "musx", "MUSX"],
          },
        ],
      });

      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setFilePath(path);
      }
    } catch (err) {
      console.error("Failed to select file:", err);
      setError("Erro ao selecionar arquivo");
    }
  };

  const handleSave = async () => {
    if (!score || !instrument) return;

    if (!filePath.trim()) {
      setError("O arquivo é obrigatório");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        songId: score.id,
        scoreFileId: instrument.id,
        instrumentName: instrumentName.trim() || null,
        filePath: filePath.trim(),
      });
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !score || !instrument) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e0e8f0]">
          <h2 className="text-lg font-bold text-[#2f4259]">Editar Partitura</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f2f5fa] transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5 text-[#8b9db2]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Music Info - Read Only */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Música
            </label>
            <div className="rounded border border-[#c5cfdb] bg-[#f5f7fa] p-3">
              <p className="text-sm text-[#344b61] font-medium">{score.name}</p>
              {score.composer && (
                <p className="text-xs text-[#8b9db2] mt-1">
                  Compositor: {score.composer}
                </p>
              )}
              {score.arranger && (
                <p className="text-xs text-[#8b9db2]">
                  Arranjador: {score.arranger}
                </p>
              )}
            </div>
          </div>

          {/* Instrument Name */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Nome do Instrumento
            </label>
            <input
              type="text"
              value={instrumentName}
              onChange={(e) => setInstrumentName(e.target.value)}
              className="w-full rounded border border-[#c5cfdb] px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
              placeholder="Ex: Flauta, Violino, Piano"
              disabled={isSaving}
            />
          </div>

          {/* File Path */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Caminho do Arquivo *
            </label>
            <div className="space-y-2">
              {filePath && (
                <div className="rounded border border-[#c5cfdb] bg-[#f5f7fa] p-3 min-h-[2.5rem] overflow-auto max-h-24">
                  <p className="text-xs text-[#344b61] whitespace-pre-wrap break-all">
                    {filePath}
                  </p>
                </div>
              )}
              {!filePath && (
                <div className="rounded border border-[#c5cfdb] bg-[#f5f7fa] p-3 min-h-[2.5rem] flex items-center">
                  <p className="text-sm text-[#a3b5c7]">
                    Nenhum arquivo selecionado
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleSelectFile}
                disabled={isSaving}
                className="w-full px-4 py-2 rounded bg-[#f2f5fa] border border-[#c5cfdb] text-sm font-medium text-[#344b61] hover:bg-[#eef2f6] transition-colors disabled:opacity-50"
              >
                Alterar Arquivo
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded bg-red-50 border border-red-200 p-2.5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[#e0e8f0]">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-[#c5cfdb] px-3 py-2 text-sm font-medium text-[#344b61] hover:bg-[#f2f5fa] transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded bg-[#5c9ae6] px-3 py-2 text-sm font-medium text-white hover:bg-[#4a84c7] transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
