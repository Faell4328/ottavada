import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Loader2, Trash2 } from "lucide-react";
import type { IndexedFile, ScoreListItem, SongListItem } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { getDirectoryPath, getFileName } from "../utils/paths";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";
import { getErrorMessage } from "../utils/errors";
import {
  describeScoreConflict,
  findExistingScoreConflict,
  formatScoreConflictSummary,
  summarizeScoreConflictsBySong,
} from "../utils/libraryDuplicates";
import { sortIndexedFileEntriesForReview } from "../utils/indexedFileReviewOrder";

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
  const [editingInstrumentIndex, setEditingInstrumentIndex] = useState<number | null>(null);
  const [removedFileIndices, setRemovedFileIndices] = useState<Set<number>>(new Set());

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
    () => files.map((file, idx) => ({ file, idx })).filter(({ idx }) => !removedFileIndices.has(idx)),
    [files, removedFileIndices]
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
    setEditingInstrumentIndex(null);
    setRemovedFileIndices(new Set());
  }, [files, isOpen]);

  const removeFile = (idx: number) => {
    setRemovedFileIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

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

    if (hasPendingIssues) {
      setError("Corrija as pendências antes de salvar");
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

  const visibleFiles = sortIndexedFileEntriesForReview(
    activeFileEntries,
    instrumentNames,
    editingInstrumentIndex
  );

  const reviewItems = useMemo(() => {
    const items: Array<
      | {
          kind: "single";
          file: IndexedFile;
          idx: number;
          conflict: ReturnType<typeof findExistingScoreConflict>;
          conflictMessage: string | null;
          isLocked: boolean;
        }
      | {
          kind: "group";
          normalizedInstrument: string;
          entries: Array<{ file: IndexedFile; idx: number }>;
        }
    > = [];
    const batchGroups = new Map<string, { normalizedInstrument: string; entries: Array<{ file: IndexedFile; idx: number }> }>();

    visibleFiles.forEach(({ file, idx }) => {
      const conflict = duplicateMap.get(idx) ?? null;
      const normalizedInstrument = normalizedInstrumentNames.get(idx);
      const isBatchDuplicate =
        normalizedInstrument !== null &&
        normalizedInstrument !== undefined &&
        (normalizedInstrumentCounts.get(normalizedInstrument) ?? 0) > 1;

      if (isBatchDuplicate && normalizedInstrument) {
        const existingGroup = batchGroups.get(normalizedInstrument);
        if (existingGroup) {
          existingGroup.entries.push({ file, idx });
          return;
        }

        const nextGroup = {
          normalizedInstrument,
          entries: [{ file, idx }],
        };
        batchGroups.set(normalizedInstrument, nextGroup);
        items.push({ kind: "group", ...nextGroup });
        return;
      }

      items.push({
        kind: "single",
        file,
        idx,
        conflict,
        conflictMessage: conflict ? describeScoreConflict(conflict, songName) : null,
        isLocked: conflict !== null,
      });
    });

    return items;
  }, [duplicateMap, normalizedInstrumentCounts, normalizedInstrumentNames, songName, visibleFiles]);

  const pendingIssueMessages = useMemo(() => {
    const messages: string[] = [];
    const scoreConflicts: NonNullable<ReturnType<typeof findExistingScoreConflict>>[] = [];

    reviewItems.forEach((item) => {
      if (item.kind === "group") {
        const firstEntry = item.entries[0];
        const instrumentName = firstEntry
          ? instrumentNames[firstEntry.idx] || firstEntry.file.instrument || item.normalizedInstrument
          : item.normalizedInstrument;

        messages.push(
          `${item.entries.length} partituras usam o mesmo instrumento (${instrumentName}). Renomeie ou delete uma delas para continuar.`
        );
        return;
      }

      if (item.conflict) {
        scoreConflicts.push(item.conflict);
      }
    });

    summarizeScoreConflictsBySong(scoreConflicts).forEach((summary) => {
      messages.push(formatScoreConflictSummary(summary));
    });

    return messages;
  }, [reviewItems]);

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
          confirmDisabled={hasPendingIssues || !hasAddableFiles}
        />
      }
    >
      {hasPendingIssues && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Revise as pendências abaixo antes de salvar.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {pendingIssueMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <FormField label="Nome da Musica">
        <TextInput value={songName} onChange={() => {}} placeholder="Nome da musica" readOnly />
      </FormField>

      <FormField label={`Partitura selecionada${activeFileEntries.length > 1 ? ` (${activeFileEntries.length})` : ""}`}>
        <div className="rounded border border-[#c5cfdb] bg-white p-3 space-y-4 max-h-120 overflow-y-auto">
          {reviewItems.map((item) => {
            if (item.kind === "group") {
              const firstEntry = item.entries[0];
              const instrumentName = firstEntry
                ? instrumentNames[firstEntry.idx] || firstEntry.file.instrument || item.normalizedInstrument
                : item.normalizedInstrument;

              return (
                <div key={item.normalizedInstrument} className="rounded border border-amber-200 bg-amber-50 p-2 space-y-3">
                    <p className="text-xs font-semibold text-amber-700">
                      {item.entries.length} partituras usam o mesmo instrumento ({instrumentName}). Renomeie ou delete uma delas para continuar.
                    </p>

                  {item.entries.map(({ file, idx }, index) => {
                    const fileName = getFileName(file.path) || file.name;
                    const directoryPath = getDirectoryPath(file.path);
                    const isBusy = openingScorePath === file.path || openingLocationPath === file.path;

                    return (
                      <div key={idx} className={index > 0 ? "border-t border-amber-200 pt-3" : ""}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs text-[#5d738b] font-semibold break-all whitespace-normal">
                              {fileName}
                            </p>
                            <p className="text-[11px] text-[#8b9db2] break-all whitespace-normal mt-0.5">
                              {directoryPath}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="p-1 text-[#8b9db2] hover:text-red-500 transition-colors"
                            title="Remover arquivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-2">
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
                          onFocus={() => setEditingInstrumentIndex(idx)}
                          onBlur={() => setEditingInstrumentIndex(null)}
                          placeholder="Nome do instrumento"
                          autoFocus={visibleFiles[0]?.idx === idx}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            }

            const fileName = getFileName(item.file.path) || item.file.name;
            const directoryPath = getDirectoryPath(item.file.path);
            const isBusy = openingScorePath === item.file.path || openingLocationPath === item.file.path;

            return (
              <div
                key={item.idx}
                className={item.conflictMessage ? "rounded border border-amber-200 bg-amber-50 p-2 space-y-2" : "space-y-2"}
              >
                {item.conflictMessage && (
                  <p className="text-xs font-semibold text-amber-700">
                    {item.conflictMessage}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs text-[#5d738b] font-semibold break-all whitespace-normal">
                      {fileName}
                    </p>
                    <p className="text-[11px] text-[#8b9db2] break-all whitespace-normal mt-0.5">
                      {directoryPath}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(item.idx)}
                    disabled={item.isLocked}
                    className="p-1 text-[#8b9db2] hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    title="Remover arquivo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenScore(item.file.path)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                    title="Abrir partitura"
                  >
                    {openingScorePath === item.file.path ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    Abrir partitura
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenLocal(item.file.path)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                    title="Abrir local"
                  >
                    {openingLocationPath === item.file.path ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="h-3.5 w-3.5" />
                    )}
                    Abrir local
                  </button>
                </div>

                <TextInput
                  value={instrumentNames[item.idx] || ""}
                  onChange={(value) => {
                    setInstrumentNames((prev) => ({
                      ...prev,
                      [item.idx]: normalizeScoreNameInput(value),
                    }));
                  }}
                  onFocus={() => setEditingInstrumentIndex(item.idx)}
                  onBlur={() => setEditingInstrumentIndex(null)}
                  placeholder="Nome do instrumento"
                  autoFocus={visibleFiles[0]?.idx === item.idx}
                  readOnly={item.isLocked}
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