import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { IndexedFile, ScoreListItem, SongListItem } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { getDirectoryPath, getFileName } from "../utils/paths";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";
import { getErrorMessage } from "../utils/errors";
import { describeScoreConflict, findExistingScoreConflictInSong } from "../utils/libraryDuplicates";

interface AddScoreToSongModalProps {
  isOpen: boolean;
  songName: string;
  file: IndexedFile | null;
  existingScores?: ScoreListItem[];
  onClose: () => void;
  onSave: (file: IndexedFile) => Promise<void>;
}

export function AddScoreToSongModal({
  isOpen,
  songName,
  file,
  existingScores,
  onClose,
  onSave,
}: AddScoreToSongModalProps) {
  const [instrumentName, setInstrumentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [openingScorePath, setOpeningScorePath] = useState<string | null>(null);
  const [openingLocationPath, setOpeningLocationPath] = useState<string | null>(null);
  const { state } = useAppState();
  const scoresForDuplicateCheck = existingScores ?? state.selectedSong?.scores ?? [];
  const scoreConflict = useMemo(
    () => {
      if (!file) {
        return null;
      }

      const currentSong: SongListItem = state.selectedSong
        ? { ...state.selectedSong, scores: scoresForDuplicateCheck }
        : {
            id: "",
            name: songName,
            composer: null,
            arranger: null,
            updated_at: "",
            is_favorite: false,
            category_ids: [],
            scores: scoresForDuplicateCheck,
          };

      return findExistingScoreConflictInSong(currentSong, file);
    },
    [file, scoresForDuplicateCheck, songName, state.selectedSong]
  );
  const isDuplicateScore = scoreConflict !== null;
  const conflictMessage = scoreConflict ? describeScoreConflict(scoreConflict) : null;

  useEffect(() => {
    if (!isOpen || !file) {
      return;
    }

    setInstrumentName(normalizeScoreNameInput(file.instrument || ""));
    setError("");
    setIsSaving(false);
    setOpeningScorePath(null);
    setOpeningLocationPath(null);
  }, [isOpen, file]);

  const handleOpenScore = async (path: string) => {
    setOpeningScorePath(path);
    setError("");

    try {
      await api.openFilePath(path);
    } catch {
      setError("Nao foi possivel abrir a partitura selecionada");
    } finally {
      setOpeningScorePath(null);
    }
  };

  const handleOpenLocal = async (path: string) => {
    setOpeningLocationPath(path);
    setError("");

    try {
      await api.openFileLocation(path);
    } catch {
      setError("Nao foi possivel abrir o local da partitura selecionada");
    } finally {
      setOpeningLocationPath(null);
    }
  };

  const handleSave = async () => {
    if (!file) {
      setError("Nenhum arquivo selecionado");
      return;
    }

    if (isDuplicateScore) {
      setError(describeScoreConflict(scoreConflict));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        ...file,
        name: songName,
        instrument: normalizeScoreNameForSave(instrumentName),
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!file) {
    return null;
  }

  const fileName = getFileName(file.path) || file.name;
  const directoryPath = getDirectoryPath(file.path);
  const isBusy = openingScorePath === file.path || openingLocationPath === file.path;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Partitura"
      maxWidth="max-w-lg"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={isDuplicateScore}
        />
      }
    >
      <FormField label="Nome da Musica">
        <TextInput
          value={songName}
          onChange={() => {}}
          placeholder="Nome da musica"
          readOnly
        />
      </FormField>

      <FormField label="Partitura selecionada">
        <div className="rounded border border-[#c5cfdb] bg-white p-3 space-y-3">
          <div className="min-w-0">
            {conflictMessage && (
              <p className="mb-1.5 text-xs font-semibold text-amber-700">
                {conflictMessage}
              </p>
            )}
            <p className="text-xs text-[#5d738b] font-semibold break-all whitespace-normal">
              {fileName}
            </p>
            <p className="text-[11px] text-[#8b9db2] break-all whitespace-normal mt-0.5">
              {directoryPath}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenScore(file.path)}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
              title="Abrir partitura"
            >
              {openingScorePath === file.path ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Abrir partitura
            </button>

            <button
              type="button"
              onClick={() => handleOpenLocal(file.path)}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
              title="Abrir local"
            >
              {openingLocationPath === file.path ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              Abrir local
            </button>
          </div>

          <TextInput
            value={instrumentName}
            onChange={(value) => setInstrumentName(normalizeScoreNameInput(value))}
            placeholder="Nome do instrumento"
            autoFocus
            readOnly={isDuplicateScore}
          />
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
