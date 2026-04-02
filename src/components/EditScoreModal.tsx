import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { SongListItem, ScoreListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";

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
      setInstrumentName(normalizeScoreNameInput(instrument.name || ""));
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
        instrumentName: normalizeScoreNameForSave(instrumentName),
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

  if (!score || !instrument) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Partitura"
      maxWidth="max-w-lg"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
        />
      }
    >
      {/* Music Info - Read Only */}
      <FormField label="Música">
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
      </FormField>

      <FormField label="Nome do Instrumento">
        <TextInput
          value={instrumentName}
          onChange={(value) => setInstrumentName(normalizeScoreNameInput(value))}
          placeholder="Ex: Flauta, Violino, Piano"
          disabled={isSaving}
        />
      </FormField>

      <FormField label="Caminho do Arquivo" required>
        <div className="space-y-2">
          <div className="rounded border border-[#c5cfdb] bg-[#f5f7fa] p-3 min-h-[2.5rem] overflow-auto max-h-24">
            <p className="text-xs text-[#344b61] whitespace-pre-wrap break-all">
              {filePath || <span className="text-sm text-[#a3b5c7]">Nenhum arquivo selecionado</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSelectFile}
            disabled={isSaving}
            className="w-full px-4 py-2 rounded bg-[#f2f5fa] border border-[#c5cfdb] text-sm font-medium text-[#344b61] hover:bg-[#eef2f6] transition-colors disabled:opacity-50"
          >
            Alterar Arquivo
          </button>
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
