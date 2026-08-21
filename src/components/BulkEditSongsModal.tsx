import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppState } from "../context/AppContext";
import { Modal, ModalFooterButtons, FormField, TextInput, AutocompleteInput, ErrorMessage } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import { normalizeSongNameForSave, normalizeSongNameInput } from "../utils/nameFormat";
import { getUniqueSongAuthors } from "../utils/songSearch";
import type { SongListItem } from "../types";

interface BulkEditSongsModalProps {
  isOpen: boolean;
  songs: SongListItem[];
  onClose: () => void;
  onSave: (data: {
    songId: string;
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => Promise<void>;
}

export function BulkEditSongsModal({
  isOpen,
  songs,
  onClose,
  onSave,
}: BulkEditSongsModalProps) {
  const { t } = useTranslation();
  const { state } = useAppState();
  const visibleCategories = state.categories.filter(
    (category) => category.name.toLowerCase() !== "uncategorized"
  );
  const composerSuggestions = useMemo(
    () => getUniqueSongAuthors(state.songs, "composer"),
    [state.songs]
  );
  const arrangerSuggestions = useMemo(
    () => getUniqueSongAuthors(state.songs, "arranger"),
    [state.songs]
  );

  const [index, setIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const currentSong = songs[index];

  useEffect(() => {
    if (isOpen) {
      setIndex(0);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentSong) {
      setTitle(currentSong.name || "");
      setComposer(currentSong.composer || "");
      setArranger(currentSong.arranger || "");
      setSelectedCategories(currentSong.category_ids || []);
      setError("");
    }
  }, [currentSong]);

  if (!currentSong) return null;

  const isLast = index >= songs.length - 1;
  const total = songs.length;

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    const normalizedTitle = normalizeSongNameForSave(title);

    if (!normalizedTitle) {
      setError(t("bulkEditSongsModal.titleRequired"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        songId: currentSong.id,
        title: normalizedTitle,
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
        categoryIds: selectedCategories,
      });

      if (isLast) {
        onClose();
      } else {
        setIndex((prev) => prev + 1);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("bulkEditSongsModal.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("bulkEditSongsModal.title")}
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel={
            isLast
              ? t("bulkEditSongsModal.finish")
              : t("bulkEditSongsModal.saveAndNext")
          }
          isSaving={isSaving}
        />
      }
    >
      <div className="mb-3 text-xs font-semibold text-[#4a6278]">
        {t("bulkEditSongsModal.progress", {
          current: index + 1,
          total,
        })}
      </div>

      <FormField label={t("bulkEditSongsModal.titleLabel")} required>
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder={t("bulkEditSongsModal.titlePlaceholder")}
          disabled={isSaving}
        />
      </FormField>

      <FormField label={t("bulkEditSongsModal.composerLabel")}>
        <AutocompleteInput
          value={composer}
          onChange={setComposer}
          placeholder={t("bulkEditSongsModal.composerPlaceholder")}
          disabled={isSaving}
          suggestions={composerSuggestions}
        />
      </FormField>

      <FormField label={t("bulkEditSongsModal.arrangerLabel")}>
        <AutocompleteInput
          value={arranger}
          onChange={setArranger}
          placeholder={t("bulkEditSongsModal.arrangerPlaceholder")}
          disabled={isSaving}
          suggestions={arrangerSuggestions}
        />
      </FormField>

      <FormField label={t("bulkEditSongsModal.categoriesLabel")}>
        <CategoryCheckboxList
          categories={visibleCategories}
          selectedIds={selectedCategories}
          onToggle={toggleCategory}
          disabled={isSaving}
        />
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
