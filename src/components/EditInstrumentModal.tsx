import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { ScoreListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";

interface EditInstrumentModalProps {
  isOpen: boolean;
  instrument: ScoreListItem | null;
  onClose: () => void;
  onSave: (
    scoreFileId: string,
    instrumentName: string | null,
    filePath: string
  ) => Promise<void>;
}

export function EditInstrumentModal({
  isOpen,
  instrument,
  onClose,
  onSave,
}: EditInstrumentModalProps) {
  const [instrumentName, setInstrumentName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && instrument) {
      setInstrumentName(instrument.name || "");
      setFilePath(instrument.file_path || "");
      setError("");
    }
  }, [isOpen, instrument]);

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
    if (!instrument) return;

    const pathToSave = filePath || "";
    
    if (!pathToSave) {
      setError("O arquivo está vazio. Selecione um arquivo válido.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave(
        instrument.id,
        instrumentName.trim() || null,
        pathToSave
      );
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!instrument) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Partitura"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
        />
      }
    >
      <FormField label="Nome do Instrumento">
        <TextInput
          value={instrumentName}
          onChange={setInstrumentName}
          placeholder="Ex: Soprano, Alto Sax, Flauta..."
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
            className="w-full px-4 py-2 rounded bg-[#eef2f6] border border-[#c5cfdb] text-sm font-medium text-[#344b61] hover:bg-[#e8ecf0] transition-colors disabled:opacity-50"
          >
            Procurar Arquivo
          </button>
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
