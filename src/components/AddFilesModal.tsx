import { useState, useEffect, useMemo } from "react";
import {
  Ban,
  ExternalLink,
  FolderOpen,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { IndexedFile, SongListItem } from "../types";
import * as api from "../api/commands";
import {
  Modal,
  ModalFooterButtons,
  FormField,
  TextInput,
  ErrorMessage,
  AutocompleteInput,
} from "./ui";
import { useScrollLock } from "../hooks/useScrollLock";
import { DeleteFileConfirmationModal } from "./DeleteFileConfirmationModal";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import { getDirectoryPath, getFileName } from "../utils/paths";
import {
  normalizeScoreNameForSave,
  normalizeScoreNameInput,
  normalizeSongNameForSave,
  normalizeSongNameInput,
} from "../utils/nameFormat";
import { sortIndexedFileEntriesForReview } from "../utils/indexedFileReviewOrder";
import { getUniqueSongAuthors } from "../utils/songSearch";
import {
  describeScoreConflict,
  findSongByNameComposerArranger,
  type ScoreConflict,
  formatScoreConflictSummary,
  summarizeScoreConflictsBySong,
} from "../utils/libraryDuplicates";
import { analyzeAddFilesReview } from "../utils/addFilesReview";
import { useTranslation } from "react-i18next";

interface AddFilesModalProps {
  isOpen: boolean;
  files: IndexedFile[];
  existingSongs?: SongListItem[];
  onClose: () => void;
  onCancel?: () => void;
  onSuccess: (addedCount: number) => Promise<void>;
  defaultCategoryIds?: string[];
  progress?: { current: number; total: number };
}

const EMPTY_CATEGORY_IDS: string[] = [];

export function AddFilesModal({
  isOpen,
  files,
  existingSongs,
  onClose,
  onCancel,
  onSuccess,
  defaultCategoryIds = EMPTY_CATEGORY_IDS,
  progress,
}: AddFilesModalProps) {
  const { state } = useAppState();
  const { t } = useTranslation();
  const visibleCategories = state.categories.filter(
    (category) => category.name.toLowerCase() !== "uncategorized",
  );
  const songsForDuplicateCheck = existingSongs ?? state.songs;
  const [allSongSuggestions, setAllSongSuggestions] = useState(state.songs);
  const composerSuggestions = useMemo(
    () => getUniqueSongAuthors(allSongSuggestions, "composer"),
    [allSongSuggestions],
  );
  const arrangerSuggestions = useMemo(
    () => getUniqueSongAuthors(allSongSuggestions, "arranger"),
    [allSongSuggestions],
  );
  const [title, setTitle] = useState(() =>
    files.length > 0 ? normalizeSongNameInput(files[0].name || "") : "",
  );
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => [
    ...defaultCategoryIds,
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [instrumentNames, setInstrumentNames] = useState<
    Record<number, string>
  >(() => {
    const names: Record<number, string> = {};
    files.forEach((file, idx) => {
      names[idx] = normalizeScoreNameInput(file.instrument || "");
    });
    return names;
  });
  const [reviewInstrumentNames, setReviewInstrumentNames] = useState<
    Record<number, string>
  >(() => {
    const names: Record<number, string> = {};
    files.forEach((file, idx) => {
      names[idx] = normalizeScoreNameInput(file.instrument || "");
    });
    return names;
  });

  const [removedFileIndices, setRemovedFileIndices] = useState<Set<number>>(
    new Set(),
  );
  const [ignoredFileIndices, setIgnoredFileIndices] = useState<Set<number>>(
    new Set(),
  );
  const [pendingDeleteFile, setPendingDeleteFile] = useState<{
    idx: number;
    path: string;
    fileName: string;
  } | null>(null);
  const [openingScorePath, setOpeningScorePath] = useState<string | null>(null);
  const [openingLocationPath, setOpeningLocationPath] = useState<string | null>(
    null,
  );
  useScrollLock(pendingDeleteFile !== null);
  const normalizedTitle = useMemo(
    () => normalizeSongNameForSave(title),
    [title],
  );
  const existingSong = useMemo(
    () => findSongByNameComposerArranger(songsForDuplicateCheck, normalizedTitle, composer, arranger),
    [normalizedTitle, composer, arranger, songsForDuplicateCheck],
  );
  const fileEntries = useMemo(
    () =>
      files
        .map((file, idx) => ({ file, idx }))
        .filter(({ idx }) => !removedFileIndices.has(idx)),
    [files, removedFileIndices],
  );
  const reviewableFileEntries = useMemo(
    () => fileEntries.filter(({ idx }) => !ignoredFileIndices.has(idx)),
    [fileEntries, ignoredFileIndices],
  );
  const {
    normalizedInstrumentNames,
    normalizedInstrumentCounts,
    duplicateMap,
    duplicateEntries,
  } = useMemo(
    () =>
      analyzeAddFilesReview(
        reviewableFileEntries,
        reviewInstrumentNames,
        songsForDuplicateCheck,
        normalizedTitle,
        composer,
        arranger,
      ),
    [
      normalizedTitle,
      composer,
      arranger,
      reviewInstrumentNames,
      reviewableFileEntries,
      songsForDuplicateCheck,
    ],
  );
  const hasFilesToImport = fileEntries.length > 0;
  const isDuplicateSong = existingSong !== null;
  const hasPendingIssues = isDuplicateSong || (!isDuplicateSong && duplicateEntries.length > 0);

  useEffect(() => {
    if (isOpen && files.length > 0) {
      setAllSongSuggestions(state.songs);

      void (async () => {
        try {
          setAllSongSuggestions(await api.getAllSongSummaries());
        } catch (error) {
          console.error("Failed to load autocomplete suggestions:", error);
          setAllSongSuggestions(state.songs);
        }
      })();
    }
  }, [isOpen, files.length, state.songs]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const updateInstrumentName = (idx: number, name: string) => {
    setInstrumentNames((prev) => ({
      ...prev,
      [idx]: normalizeScoreNameInput(name),
    }));
  };

  const clearInstrumentName = (idx: number) => {
    setInstrumentNames((prev) => ({
      ...prev,
      [idx]: "",
    }));

    setReviewInstrumentNames((prev) => ({
      ...prev,
      [idx]: "",
    }));
  };

  const commitInstrumentName = (idx: number) => {
    const nextValue = normalizeScoreNameInput(instrumentNames[idx] ?? "");

    setReviewInstrumentNames((prev) => {
      if ((prev[idx] ?? "") === nextValue) {
        return prev;
      }

      return {
        ...prev,
        [idx]: nextValue,
      };
    });
  };

  const ignoreFile = (idx: number) => {
    clearInstrumentName(idx);

    setIgnoredFileIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const unignoreFile = (idx: number) => {
    setIgnoredFileIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  const openDeleteFileModal = (idx: number, path: string, fileName: string) => {
    setPendingDeleteFile({ idx, path, fileName });
  };

  const closeDeleteFileModal = () => {
    setPendingDeleteFile(null);
  };

  const deleteSelectedFile = async () => {
    if (!pendingDeleteFile) {
      return;
    }

    try {
      await api.deleteFilePath(pendingDeleteFile.path);
      setRemovedFileIndices((prev) => {
        const next = new Set(prev);
        next.add(pendingDeleteFile.idx);
        return next;
      });
      setIgnoredFileIndices((prev) => {
        const next = new Set(prev);
        next.delete(pendingDeleteFile.idx);
        return next;
      });
      setPendingDeleteFile(null);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : t("addFilesModal.deleteFileError");
      setError(errorMsg);
    }
  };

  const handleOpenScore = async (path: string) => {
    setOpeningScorePath(path);
    setError("");

    try {
      await api.openFilePath(path);
    } catch {
      setError(t("editScoreModal.openScoreError"));
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
      setError(t("editScoreModal.openLocalError"));
    } finally {
      setOpeningLocationPath(null);
    }
  };

  const handleSave = async () => {
    if (!normalizedTitle) {
      setError(t("addFilesModal.titleRequired"));
      return;
    }

    if (fileEntries.length === 0) {
      setError(t("addFilesModal.noFilesSelected"));
      return;
    }

    if (hasPendingIssues) {
      setError(t("addFilesModal.pendingIssues"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const filteredFiles = fileEntries.map(({ file, idx }) => {
        const status: IndexedFile["status"] = ignoredFileIndices.has(idx)
          ? "ignored"
          : "main";

        return {
          path: file.path,
          name: normalizedTitle,
          instrument: normalizeScoreNameForSave(
            instrumentNames[idx] ?? file.instrument,
          ),
          extension: file.extension,
          status,
        };
      });

      const importResult = await api.importIndexedFilesWithMetadata(
        filteredFiles,
        selectedCategories,
        composer.trim() || null,
        arranger.trim() || null,
      );

      await onSuccess(importResult.added_count);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("addFilesModal.saveError");
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const instrumentCount = fileEntries.length;
  const visibleFiles = sortIndexedFileEntriesForReview(
    fileEntries,
    reviewInstrumentNames,
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
        isIgnored: boolean;
      }
      | {
        kind: "group";
        normalizedInstrument: string;
        entries: Array<{ file: IndexedFile; idx: number }>;
      }
    > = [];
    const batchGroups = new Map<
      string,
      {
        normalizedInstrument: string;
        entries: Array<{ file: IndexedFile; idx: number }>;
      }
    >();

    visibleFiles.forEach(({ file, idx }) => {
      const isIgnored = ignoredFileIndices.has(idx);
      const conflict = isIgnored || isDuplicateSong ? null : (duplicateMap.get(idx) ?? null);
      const normalizedInstrument = isIgnored
        ? null
        : normalizedInstrumentNames.get(idx);
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
        conflictMessage: conflict
          ? describeScoreConflict(conflict, normalizedTitle)
          : null,
        isLocked: conflict !== null,
        isIgnored,
      });
    });

    return items;
  }, [
    duplicateMap,
    ignoredFileIndices,
    isDuplicateSong,
    normalizedInstrumentCounts,
    normalizedInstrumentNames,
    normalizedTitle,
    visibleFiles,
  ]);

  const pendingIssueMessages = useMemo(() => {
    const messages: string[] = [];

    if (isDuplicateSong) {
      messages.push(
        t("addFilesModal.duplicateSong", { name: existingSong?.name ?? normalizedTitle }),
      );
      return messages;
    }

    const scoreConflicts: ScoreConflict[] = [];

    reviewItems.forEach((item) => {
      if (item.kind === "group") {
        const firstEntry = item.entries[0];
        const instrumentName = firstEntry
          ? reviewInstrumentNames[firstEntry.idx] ||
          firstEntry.file.instrument ||
          item.normalizedInstrument
          : item.normalizedInstrument;

        messages.push(
          t("addFilesModal.twoScoresSameInstrument", { count: item.entries.length, instrument: instrumentName }),
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
  }, [existingSong?.name, isDuplicateSong, reviewInstrumentNames, reviewItems]);

  if (files.length === 0) return null;

  const modalTitle =
    progress && progress.total > 1
      ? `${t("addFilesModal.title")} (${progress.current}/${progress.total})`
      : t("addFilesModal.title");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="max-w-lg"
      footer={
        <ModalFooterButtons
          onCancel={onCancel ?? onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={hasPendingIssues || !hasFilesToImport}
        />
      }
    >
      {hasPendingIssues && pendingIssueMessages.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">
              {t("addFilesModal.reviewPending")}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {pendingIssueMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <FormField label={t("addFilesModal.labelSongName")} required>
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder={t("editMusicModal.titlePlaceholder")}
          autoFocus
        />
      </FormField>

      <FormField label={t("addFilesModal.labelComposer")}>
        <AutocompleteInput
          value={composer}
          onChange={setComposer}
          placeholder={t("editMusicModal.composerPlaceholder")}
          suggestions={composerSuggestions}
        />
      </FormField>

      <FormField label={t("addFilesModal.labelArranger")}>
        <AutocompleteInput
          value={arranger}
          onChange={setArranger}
          placeholder={t("editMusicModal.arrangerPlaceholder")}
          suggestions={arrangerSuggestions}
        />
      </FormField>

      {visibleCategories.length > 0 && (
        <FormField label={t("addFilesModal.labelCategories")}>
          <CategoryCheckboxList
            categories={visibleCategories}
            selectedIds={selectedCategories}
            onToggle={toggleCategory}
          />
        </FormField>
      )}

      {instrumentCount > 0 && (
        <FormField label={t("addFilesModal.labelInstrumentsToAdd", { count: instrumentCount })}>
          <div className="rounded border border-[#c5cfdb] bg-white p-3 space-y-4 max-h-80 overflow-y-auto">
            {reviewItems.map((item) => {
              if (item.kind === "group") {
                return (
                  <div
                    key={item.normalizedInstrument}
                    className="rounded border border-amber-200 bg-amber-50 p-2 space-y-3"
                  >
                    {item.entries.map(({ file, idx }, index) => {
                      const fileName = getFileName(file.path) || file.name;
                      const directoryPath = getDirectoryPath(file.path);
                      const isBusy =
                        openingScorePath === file.path ||
                        openingLocationPath === file.path;
                      const isIgnored = ignoredFileIndices.has(idx);
                      const conflict = isIgnored
                        ? null
                        : (duplicateMap.get(idx) ?? null);
                      const isLocked = conflict !== null;

                      return (
                        <div
                          key={idx}
                          className={
                            index > 0 ? "border-t border-amber-200 pt-3" : ""
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-xs text-[#5d738b] font-semibold break-all whitespace-normal">
                                {fileName}
                              </p>
                              <p className="text-[11px] text-[#8b9db2] break-all whitespace-normal mt-0.5">
                                {directoryPath}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => ignoreFile(idx)}
                                className="p-1 text-[#8b9db2] hover:text-[#4f84d7] transition-colors"
                                title={t("addFilesModal.titleIgnoreFile")}
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openDeleteFileModal(idx, file.path, fileName)
                                }
                                className="p-1 text-[#8b9db2] hover:text-red-500 transition-colors"
                                title={t("addFilesModal.titleMoveToTrash")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            <button
                              type="button"
                              onClick={() => handleOpenScore(file.path)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                              title={t("addFilesModal.titleOpenScore")}
                            >
                              {openingScorePath === file.path ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ExternalLink className="h-3.5 w-3.5" />
                              )}
                              {t("addFilesModal.btnOpenScore")}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenLocal(file.path)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                              title={t("addFilesModal.titleOpenLocal")}
                            >
                              {openingLocationPath === file.path ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FolderOpen className="h-3.5 w-3.5" />
                              )}
                              {t("addFilesModal.btnOpenLocal")}
                            </button>
                          </div>

                          <TextInput
                            value={instrumentNames[idx] || ""}
                            onChange={(val) => {
                              if (!isIgnored) {
                                updateInstrumentName(idx, val);
                              }
                            }}
                            onBlur={() => {
                              commitInstrumentName(idx);
                            }}
                            placeholder={t("addFilesModal.placeholderInstrumentName")}
                            autoFocus={visibleFiles[0]?.idx === idx}
                            disabled={isIgnored}
                            readOnly={isLocked}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const fileName = getFileName(item.file.path) || item.file.name;
              const directoryPath = getDirectoryPath(item.file.path);
              const isBusy =
                openingScorePath === item.file.path ||
                openingLocationPath === item.file.path;

              return (
                <div
                  key={item.idx}
                  className={
                    item.conflictMessage
                      ? "rounded border border-amber-200 bg-amber-50 p-2 space-y-2"
                      : "space-y-2"
                  }
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
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          item.isIgnored
                            ? unignoreFile(item.idx)
                            : ignoreFile(item.idx)
                        }
                        className={`p-1 transition-colors ${item.isIgnored ? "text-[#4f84d7] hover:text-[#345f9e]" : "text-[#8b9db2] hover:text-[#4f84d7]"}`}
                        title={
                          item.isIgnored
                            ? t("addFilesModal.titleUnignoreFile")
                            : t("addFilesModal.titleIgnoreFile")
                        }
                      >
                        {item.isIgnored ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openDeleteFileModal(
                            item.idx,
                            item.file.path,
                            fileName,
                          )
                        }
                        disabled={item.isLocked}
                        className="p-1 text-[#8b9db2] hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        title={t("addFilesModal.titleMoveToTrash")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {item.isIgnored && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {t("addFilesModal.badgeIgnored")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenScore(item.file.path)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                      title={t("addFilesModal.titleOpenScore")}
                    >
                      {openingScorePath === item.file.path ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      {t("addFilesModal.btnOpenScore")}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLocal(item.file.path)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                      title={t("addFilesModal.titleOpenLocal")}
                    >
                      {openingLocationPath === item.file.path ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5" />
                      )}
                      {t("addFilesModal.btnOpen")}
                    </button>
                  </div>

                  <TextInput
                    value={instrumentNames[item.idx] || ""}
                    onChange={(val) => {
                      if (!item.isIgnored) {
                        updateInstrumentName(item.idx, val);
                      }
                    }}
                    onBlur={() => {
                      commitInstrumentName(item.idx);
                    }}
                    placeholder={t("addFilesModal.placeholderInstrumentName")}
                    autoFocus={visibleFiles[0]?.idx === item.idx}
                    disabled={item.isIgnored}
                    readOnly={item.isLocked}
                  />
                </div>
              );
            })}
          </div>
        </FormField>
      )}

      {pendingDeleteFile && (
        <DeleteFileConfirmationModal
          fileName={pendingDeleteFile.fileName}
          onCancel={closeDeleteFileModal}
          onIgnore={() => {
            ignoreFile(pendingDeleteFile.idx);
            closeDeleteFileModal();
          }}
          onConfirm={() => {
            void deleteSelectedFile();
          }}
        />
      )}

      <ErrorMessage error={error} />
    </Modal>
  );
}
