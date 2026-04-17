import { useState, useEffect, useMemo } from "react";
import { ExternalLink, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { IndexedFile, SongListItem } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import { getDirectoryPath, getFileName } from "../utils/paths";
import {
  normalizeScoreNameForSave,
  normalizeScoreNameInput,
  normalizeSongNameForSave,
  normalizeSongNameInput,
} from "../utils/nameFormat";
import { sortIndexedFileEntriesForReview } from "../utils/indexedFileReviewOrder";
import {
  describeScoreConflict,
  findSongByName,
  type ScoreConflict,
  formatScoreConflictSummary,
  summarizeScoreConflictsBySong,
} from "../utils/libraryDuplicates";
import { analyzeAddFilesReview } from "../utils/addFilesReview";

interface AddFilesModalProps {
  isOpen: boolean;
  files: IndexedFile[];
  existingSongs?: SongListItem[];
  onClose: () => void;
  onSuccess: (addedCount: number) => Promise<void>;
  defaultCategoryIds?: string[];
}

const EMPTY_CATEGORY_IDS: string[] = [];

export function AddFilesModal({
  isOpen,
  files,
  existingSongs,
  onClose,
  onSuccess,
  defaultCategoryIds = EMPTY_CATEGORY_IDS,
}: AddFilesModalProps) {
  const { state } = useAppState();
  const visibleCategories = state.categories.filter(
    (category) => category.name.toLowerCase() !== "sem categoria"
  );
  const songsForDuplicateCheck = existingSongs ?? state.songs;
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [instrumentNames, setInstrumentNames] = useState<Record<number, string>>({});
  const [removedFileIndices, setRemovedFileIndices] = useState<Set<number>>(new Set());
  const [editingInstrumentIndex, setEditingInstrumentIndex] = useState<number | null>(null);
  const [openingScorePath, setOpeningScorePath] = useState<string | null>(null);
  const [openingLocationPath, setOpeningLocationPath] = useState<string | null>(null);
  const normalizedTitle = useMemo(() => normalizeSongNameForSave(title), [title]);
  const existingSong = useMemo(
    () => findSongByName(songsForDuplicateCheck, normalizedTitle),
    [normalizedTitle, songsForDuplicateCheck]
  );
  const activeFileEntries = useMemo(
    () => files.map((file, idx) => ({ file, idx })).filter(({ idx }) => !removedFileIndices.has(idx)),
    [files, removedFileIndices]
  );
  const {
    normalizedInstrumentNames,
    normalizedInstrumentCounts,
    duplicateMap,
    duplicateEntries,
    addableEntries,
  } = useMemo(
    () =>
      analyzeAddFilesReview(
        activeFileEntries,
        instrumentNames,
        songsForDuplicateCheck,
        normalizedTitle
      ),
    [activeFileEntries, instrumentNames, normalizedTitle, songsForDuplicateCheck]
  );
  const hasAddableFiles = addableEntries.length > 0;
  const isDuplicateSong = existingSong !== null;
  const hasPendingIssues = isDuplicateSong || duplicateEntries.length > 0;

  useEffect(() => {
    if (isOpen && files.length > 0) {
      setTitle(normalizeSongNameInput(files[0].name || ""));
      setComposer("");
      setArranger("");
      setSelectedCategories([...defaultCategoryIds]);
      setError("");
      setRemovedFileIndices(new Set());
      setEditingInstrumentIndex(null);
      setOpeningScorePath(null);
      setOpeningLocationPath(null);
      
      const names: Record<number, string> = {};
      files.forEach((file, idx) => {
        names[idx] = normalizeScoreNameInput(file.instrument || "");
      });
      setInstrumentNames(names);
    }
  }, [defaultCategoryIds, files, isOpen]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const updateInstrumentName = (idx: number, name: string) => {
    setInstrumentNames((prev) => ({
      ...prev,
      [idx]: normalizeScoreNameInput(name),
    }));
  };

  const removeFile = (idx: number) => {
    setRemovedFileIndices((prev) => {
      const newSet = new Set(prev);
      newSet.add(idx);
      return newSet;
    });
  };

  const handleOpenScore = async (path: string) => {
    setOpeningScorePath(path);
    setError("");

    try {
      await api.openFilePath(path);
    } catch {
      setError("Não foi possível abrir a partitura selecionada");
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
      setError("Não foi possível abrir o local da partitura selecionada");
    } finally {
      setOpeningLocationPath(null);
    }
  };

  const handleSave = async () => {
    if (!normalizedTitle) {
      setError("O título da música é obrigatório");
      return;
    }

    if (activeFileEntries.length === 0) {
      setError("Adicione pelo menos um arquivo");
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
      const filteredFiles = addableEntries.map(({ file, idx }) => {
        return {
          path: file.path,
          name: normalizedTitle,
          instrument: normalizeScoreNameForSave(
            instrumentNames[idx] ?? file.instrument
          ),
          extension: file.extension,
        };
      });

      const importResult = await api.importIndexedFilesWithMetadata(
        filteredFiles,
        selectedCategories,
        composer.trim() || null,
        arranger.trim() || null
      );

      await onSuccess(importResult.added_count);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const instrumentCount = activeFileEntries.length;
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
          conflict: ScoreConflict | null;
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
        conflictMessage: conflict ? describeScoreConflict(conflict, normalizedTitle) : null,
        isLocked: conflict !== null,
      });
    });

    return items;
  }, [duplicateMap, normalizedInstrumentCounts, normalizedInstrumentNames, normalizedTitle, visibleFiles]);

  const pendingIssueMessages = useMemo(() => {
    const messages: string[] = [];
    const scoreConflicts: ScoreConflict[] = [];

    if (isDuplicateSong) {
      messages.push(
        `A música ${existingSong?.name ?? normalizedTitle} já existe. Altere o nome da música para continuar.`
      );
    }

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
  }, [existingSong?.name, isDuplicateSong, instrumentNames, reviewItems]);

  if (files.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Partitura(s)"
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
      {hasPendingIssues && pendingIssueMessages.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Revise as pendências abaixo antes de salvar.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {pendingIssueMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <FormField label="Nome da Música" required>
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder="Nome da música"
          autoFocus
          readOnly={isDuplicateSong}
        />
      </FormField>

      {!isDuplicateSong && (
        <>
          <FormField label="Compositor">
            <TextInput
              value={composer}
              onChange={setComposer}
              placeholder="Nome do compositor"
            />
          </FormField>

          <FormField label="Arranjador">
            <TextInput
              value={arranger}
              onChange={setArranger}
              placeholder="Nome do arranjador"
            />
          </FormField>

          {visibleCategories.length > 0 && (
            <FormField label="Categorias">
              <CategoryCheckboxList
                categories={visibleCategories}
                selectedIds={selectedCategories}
                onToggle={toggleCategory}
              />
            </FormField>
          )}
        </>
      )}

      {instrumentCount > 0 && (
        <FormField label={`Instrumentos a adicionar (${instrumentCount})`}>
          <div className="rounded border border-[#c5cfdb] bg-white p-3 space-y-4 max-h-120 overflow-y-auto">
            {reviewItems.map((item) => {
              if (item.kind === "group") {
                return (
                  <div key={item.normalizedInstrument} className="rounded border border-amber-200 bg-amber-50 p-2 space-y-3">
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
                            onChange={(val) => updateInstrumentName(idx, val)}
                            onFocus={() => setEditingInstrumentIndex(idx)}
                            onBlur={() => setEditingInstrumentIndex(null)}
                            placeholder="Nome do instrumento"
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

                  <div className="flex items-center gap-2">
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
                    onChange={(val) => updateInstrumentName(item.idx, val)}
                    onFocus={() => setEditingInstrumentIndex(item.idx)}
                    onBlur={() => setEditingInstrumentIndex(null)}
                    placeholder="Nome do instrumento"
                    readOnly={item.isLocked}
                  />
                </div>
              );
            })}
          </div>
        </FormField>
      )}

      <ErrorMessage error={error} />
    </Modal>
  );
}
