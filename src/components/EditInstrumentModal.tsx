import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import type { ScoreListItem } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";

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
  const [isOpeningScore, setIsOpeningScore] = useState(false);
  const [isOpeningLocation, setIsOpeningLocation] = useState(false);

  useEffect(() => {
    if (isOpen && instrument) {
      setInstrumentName(normalizeScoreNameInput(instrument.name || ""));
      setFilePath(instrument.file_path || "");
      setError("");
      setIsOpeningScore(false);
      setIsOpeningLocation(false);
    }
  }, [isOpen, instrument]);

  const handleOpenScore = async () => {
    if (!filePath.trim()) {
      setError("Selecione um arquivo para abrir a partitura");
      return;
    }

    setIsOpeningScore(true);
    setError("");

    try {
      await api.openFilePath(filePath.trim());
    } catch {
      setError("Não foi possível abrir a partitura selecionada");
    } finally {
      setIsOpeningScore(false);
    }
  };

  const handleOpenLocal = async () => {
    if (!filePath.trim()) {
      setError("Selecione um arquivo para abrir o local");
      return;
    }

    setIsOpeningLocation(true);
    setError("");

    try {
      await api.openFileLocation(filePath.trim());
    } catch {
      setError("Não foi possível abrir o local da partitura selecionada");
    } finally {
      setIsOpeningLocation(false);
    }
  };

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
        normalizeScoreNameForSave(instrumentName),
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
          onChange={(value) => setInstrumentName(normalizeScoreNameInput(value))}
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
            disabled={isSaving || isOpeningScore || isOpeningLocation}
            className="w-full px-4 py-2 rounded bg-[#eef2f6] border border-[#c5cfdb] text-sm font-medium text-[#344b61] hover:bg-[#e8ecf0] transition-colors disabled:opacity-50"
          >
            Procurar Arquivo
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenScore}
              disabled={isSaving || isOpeningScore || isOpeningLocation}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-[#d8e0ea] px-2 py-2 text-xs text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
              title="Abrir partitura"
            >
              {isOpeningScore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Abrir partitura
            </button>

            <button
              type="button"
              onClick={handleOpenLocal}
              disabled={isSaving || isOpeningScore || isOpeningLocation}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-[#d8e0ea] px-2 py-2 text-xs text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
              title="Abrir local"
            >
              {isOpeningLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              Abrir local
            </button>
          </div>
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
