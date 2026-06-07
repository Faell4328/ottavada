import { useState, useEffect, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import type { SongListItem, ScoreListItem } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";
import { findScoreNameConflictInSong } from "../utils/libraryDuplicates";
import { isSupportedScoreFilePath } from "../utils/paths";

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
  const [isOpeningScore, setIsOpeningScore] = useState(false);
  const [isOpeningLocation, setIsOpeningLocation] = useState(false);

  const nameConflict = useMemo(() => {
    if (!score || !instrument) {
      return null;
    }

    return findScoreNameConflictInSong(score, instrumentName, instrument.id);
  }, [instrument, instrumentName, score]);
  const hasNameConflict = nameConflict !== null;

  useEffect(() => {
    if (isOpen && score && instrument) {
      setInstrumentName(normalizeScoreNameInput(instrument.name || ""));
      setFilePath(instrument.file_path || "");
      setError("");
      setIsOpeningScore(false);
      setIsOpeningLocation(false);
    }
  }, [isOpen, score, instrument]);

  const handleOpenScore = async () => {
    const selectedPath = filePath.trim();

    if (!selectedPath && !instrument) {
      setError("Selecione um arquivo para abrir a partitura");
      return;
    }

    setIsOpeningScore(true);
    setError("");

    try {
      if (selectedPath && isSupportedScoreFilePath(selectedPath)) {
        await api.openFilePath(selectedPath);
      } else {
        await api.openFile(instrument?.id ?? "");
      }
    } catch {
      setError("Não foi possível abrir a partitura selecionada");
    } finally {
      setIsOpeningScore(false);
    }
  };

  const handleOpenLocal = async () => {
    const selectedPath = filePath.trim();

    if (!selectedPath && !instrument) {
      setError("Selecione um arquivo para abrir o local");
      return;
    }

    setIsOpeningLocation(true);
    setError("");

    try {
      if (selectedPath && isSupportedScoreFilePath(selectedPath)) {
        await api.openFileLocation(selectedPath);
      } else {
        await api.openFileLocation(instrument?.id ?? "");
      }
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
            extensions: ["pdf", "PDF", "mus", "MUS", "musx", "MUSX", "mscx", "MSCX", "mscz", "MSCZ", "xml", "XML", "musicxml", "MUSICXML", "sib", "SIB", "enc", "ENC", "mid", "MID", "midi", "MIDI"],
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

    if (hasNameConflict) {
      setError("Já existe uma partitura com esse nome nesta música");
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
          confirmDisabled={hasNameConflict}
        />
      }
    >
      {hasNameConflict && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Há uma pendência nesta partitura.</p>
          <p>Já existe outra partitura com esse nome nesta música. Renomeie antes de salvar.</p>
        </div>
      )}

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
            disabled={isSaving || isOpeningScore || isOpeningLocation}
            className="w-full px-4 py-2 rounded bg-[#f2f5fa] border border-[#c5cfdb] text-sm font-medium text-[#344b61] hover:bg-[#eef2f6] transition-colors disabled:opacity-50"
          >
            Alterar Arquivo
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
              Abrir 
            </button>
          </div>
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
