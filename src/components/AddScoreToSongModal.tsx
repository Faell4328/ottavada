import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import type { IndexedFile, ScoreListItem, SongListItem } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { getDirectoryPath, getFileName } from "../utils/paths";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";
import { getErrorMessage } from "../utils/errors";
import { describeScoreConflict, findExistingScoreConflict } from "../utils/libraryDuplicates";

interface AddScoreToSongModalProps {
  isOpen: boolean;
  songName: string;
  files: IndexedFile[];
  existingScores?: ScoreListItem[];
  existingSongs?: SongListItem[];
  onClose: () => void;
  onSave: (files: IndexedFile[]) => Promise<void>;
}

export function AddScoreToSongModal({
  isOpen,
  songName,
  files,
  existingScores,
  existingSongs,
  onClose,
  onSave,
}: AddScoreToSongModalProps) {
  const scoresForDuplicateCheck = existingScores ?? [];
  const [instrumentNames, setInstrumentNames] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [openingScorePath, setOpeningScorePath] = useState<string | null>(null);
  const [openingLocationPath, setOpeningLocationPath] = useState<string | null>(null);

  const currentSong = useMemo<SongListItem>(
    () =>
      ({
        id: "",
        name: songName,
        composer: null,
        arranger: null,
        updated_at: "",
        is_favorite: false,
        category_ids: [],
        scores: scoresForDuplicateCheck,
      }),
    [scoresForDuplicateCheck, songName]
  );

  const songsForDuplicateCheck = useMemo(
    () => existingSongs ?? [currentSong],
    [currentSong, existingSongs]
  );

  const activeFileEntries = useMemo(
    () => files.map((file, idx) => ({ file, idx })),
    [files]
  );

  const normalizedInstrumentNames = useMemo(() => {
    const map = new Map<number, string | null>();

    activeFileEntries.forEach(({ file, idx }) => {
      map.set(idx, normalizeScoreNameForSave(instrumentNames[idx] ?? file.instrument));
    });

    return map;
  }, [activeFileEntries, instrumentNames]);

  const normalizedInstrumentCounts = useMemo(() => {
    const counts = new Map<string, number>();

    normalizedInstrumentNames.forEach((normalizedInstrument) => {
      if (!normalizedInstrument) {
        return;
      }

      counts.set(normalizedInstrument, (counts.get(normalizedInstrument) ?? 0) + 1);
    });

    return counts;
  }, [normalizedInstrumentNames]);

  const duplicateMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof findExistingScoreConflict>>();

    activeFileEntries.forEach(({ file, idx }) => {
      map.set(idx, findExistingScoreConflict(songsForDuplicateCheck, file, songName));
    });

    return map;
  }, [activeFileEntries, songName, songsForDuplicateCheck]);

  const batchDuplicateMap = useMemo(() => {
    const map = new Map<number, boolean>();

    activeFileEntries.forEach(({ file, idx }) => {
      const normalizedInstrument = normalizeScoreNameForSave(instrumentNames[idx] ?? file.instrument);
      map.set(
        idx,
        normalizedInstrument !== null && (normalizedInstrumentCounts.get(normalizedInstrument) ?? 0) > 1
      );
    });

    return map;
  }, [activeFileEntries, instrumentNames, normalizedInstrumentCounts]);

  const duplicateEntries = activeFileEntries.filter(({ idx }) => {
    return duplicateMap.get(idx) !== null || batchDuplicateMap.get(idx) === true;
  });

  const addableEntries = activeFileEntries.filter(({ idx }) => {
    return duplicateMap.get(idx) === null && batchDuplicateMap.get(idx) !== true;
  });

  const hasAddableFiles = addableEntries.length > 0;
  const hasPendingIssues = duplicateEntries.length > 0;
  const pendingIssuesMessage =
    duplicateEntries.length === 1
      ? "Há uma partitura com nome duplicado ou já utilizada em outra música. Renomeie ou remova o arquivo antes de salvar."
      : `${duplicateEntries.length} partituras com nome duplicado ou já utilizadas em outra música. Renomeie ou remova os arquivos antes de salvar.`;

  useEffect(() => {
    if (!isOpen || files.length === 0) {
      return;
    }

    const names: Record<number, string> = {};
    files.forEach((file, idx) => {
      names[idx] = normalizeScoreNameInput(file.instrument || "");
    });

    setInstrumentNames(names);
    setError("");
    setIsSaving(false);
    setOpeningScorePath(null);
    setOpeningLocationPath(null);
  }, [files, isOpen]);

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
    if (activeFileEntries.length === 0) {
      setError("Nenhum arquivo selecionado");
      return;
    }

    if (!hasAddableFiles) {
      setError("Nenhuma partitura nova para adicionar");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const filesToSave = addableEntries.map(({ file, idx }) => ({
        ...file,
        name: songName,
        instrument: normalizeScoreNameForSave(instrumentNames[idx] ?? file.instrument),
      }));

      await onSave(filesToSave);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (files.length === 0) {
    return null;
  }

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
          confirmDisabled={!hasAddableFiles}
        />
      }
    >
      {hasPendingIssues && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Há pendências nas partituras selecionadas.</p>
          <p>{pendingIssuesMessage}</p>
        </div>
      )}

      <FormField label="Nome da Musica">
        <TextInput value={songName} onChange={() => {}} placeholder="Nome da musica" readOnly />
      </FormField>

      <FormField label={`Partitura selecionada${activeFileEntries.length > 1 ? ` (${activeFileEntries.length})` : ""}`}>
        {duplicateEntries.length > 0 && (
          <p className="mb-1.5 text-xs font-semibold text-amber-700">
            {duplicateEntries.length === 1
              ? "Essa partitura já foi adicionada"
              : `${duplicateEntries.length} partituras já foram adicionadas e serão ignoradas.`}
          </p>
        )}
        <div className="rounded border border-[#c5cfdb] bg-white p-3 space-y-4 max-h-75 overflow-y-auto">
          {activeFileEntries.map(({ file, idx }) => {
            const fileName = getFileName(file.path) || file.name;
            const directoryPath = getDirectoryPath(file.path);
            const conflict = duplicateMap.get(idx) ?? null;
            const normalizedInstrument = normalizedInstrumentNames.get(idx);
            const isBatchDuplicate =
              normalizedInstrument !== null &&
              normalizedInstrument !== undefined &&
              (normalizedInstrumentCounts.get(normalizedInstrument) ?? 0) > 1;
            const isLocked = conflict !== null;
            const isBusy = openingScorePath === file.path || openingLocationPath === file.path;
            const conflictMessage = conflict ? describeScoreConflict(conflict, songName) : null;
            const batchConflictMessage = isBatchDuplicate
              ? "Essa partitura possui o mesmo nome de outra partitura nesta seleção e não será salva até ser renomeada ou removida."
              : null;

            return (
              <div key={idx} className="space-y-2">
                <div className="min-w-0">
                  {(conflictMessage || batchConflictMessage) && (
                    <p className="mb-1.5 text-xs font-semibold text-amber-700">
                      {conflictMessage || batchConflictMessage}
                    </p>
                  )}
                  <p className="text-xs text-[#5d738b] font-semibold break-all whitespace-normal">
                    {fileName}
                  </p>
                  <p className="text-[11px] text-[#8b9db2] break-all whitespace-normal mt-0.5">
                    {directoryPath}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
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
                  value={instrumentNames[idx] || ""}
                  onChange={(value) => {
                    setInstrumentNames((prev) => ({
                      ...prev,
                      [idx]: normalizeScoreNameInput(value),
                    }));
                  }}
                  placeholder="Nome do instrumento"
                  autoFocus={idx === 0}
                  readOnly={isLocked}
                />
              </div>
            );
          })}
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}