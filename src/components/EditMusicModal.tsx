import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppState } from "../context/AppContext";
import type { SongListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage, AutocompleteInput } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import { normalizeSongNameForSave, normalizeSongNameInput } from "../utils/nameFormat";
import { getUniqueSongAuthors } from "../utils/songSearch";
import * as api from "../api/commands";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return fallback;
}

interface EditMusicModalProps {
  isOpen: boolean;
  score: SongListItem | null;
  onClose: () => void;
  onSave: (data: {
    songId: string;
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => Promise<void>;
}

export function EditMusicModal({
  isOpen,
  score,
  onClose,
  onSave,
}: EditMusicModalProps) {
  const { t } = useTranslation();
  const { state } = useAppState();
  const visibleCategories = state.categories.filter(
    (category) => category.name.toLowerCase() !== "sem categoria"
  );
  const [allSongSuggestions, setAllSongSuggestions] = useState(state.songs);
  const composerSuggestions = useMemo(
    () => getUniqueSongAuthors(allSongSuggestions, "composer"),
    [allSongSuggestions]
  );
  const arrangerSuggestions = useMemo(
    () => getUniqueSongAuthors(allSongSuggestions, "arranger"),
    [allSongSuggestions]
  );
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const generationRef = useRef(0);

  useEffect(() => {
    if (isOpen && score) {
      setTitle(score.name || "");
      setComposer(score.composer || "");
      setArranger(score.arranger || "");
      setSelectedCategories(score.category_ids || []);
      setError("");
    }
  }, [isOpen, score]);

  useEffect(() => {
    if (!isOpen || !score) {
      return;
    }

    const generation = ++generationRef.current;

    void (async () => {
      try {
        const [songs, fullSong] = await Promise.all([
          api.getAllSongSummaries(),
          api.getSongListItemById(score.id),
        ]);

        if (generation !== generationRef.current) return;

        setAllSongSuggestions(songs);
        setTitle(fullSong.name || score.name || "");
        setComposer(fullSong.composer || score.composer || "");
        setArranger(fullSong.arranger || score.arranger || "");
        setSelectedCategories(fullSong.category_ids || score.category_ids || []);
      } catch (error) {
        if (generation !== generationRef.current) return;

        console.error("Failed to load autocomplete suggestions:", error);
        setAllSongSuggestions(state.songs);
        setSelectedCategories(score.category_ids || []);
      }
    })();
  }, [isOpen, score, state.songs]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    const normalizedTitle = normalizeSongNameForSave(title);

    if (!score || !normalizedTitle) {
      setError(t("editMusicModal.titleRequired"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        songId: score.id,
        title: normalizedTitle,
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
        categoryIds: selectedCategories,
      });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t("editMusicModal.saveError")));
    } finally {
      setIsSaving(false);
    }
  };

  if (!score) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("editMusicModal.title")}
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
        />
      }
    >
      <FormField label={t("editMusicModal.titleLabel")} required>
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder={t("editMusicModal.titlePlaceholder")}
          disabled={isSaving}
        />
      </FormField>

      <FormField label={t("editMusicModal.composerLabel")}>
        <AutocompleteInput
          value={composer}
          onChange={setComposer}
          placeholder={t("editMusicModal.composerPlaceholder")}
          disabled={isSaving}
          suggestions={composerSuggestions}
        />
      </FormField>

      <FormField label={t("editMusicModal.arrangerLabel")}>
        <AutocompleteInput
          value={arranger}
          onChange={setArranger}
          placeholder={t("editMusicModal.arrangerPlaceholder")}
          disabled={isSaving}
          suggestions={arrangerSuggestions}
        />
      </FormField>

      <FormField label={t("editMusicModal.categoriesLabel")}>
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
