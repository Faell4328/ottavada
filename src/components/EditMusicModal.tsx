import { useState, useEffect, useMemo, useRef } from "react";
import { useAppState } from "../context/AppContext";
import type { SongListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage, AutocompleteInput } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import { normalizeSongNameForSave, normalizeSongNameInput } from "../utils/nameFormat";
import { getUniqueSongAuthors } from "../utils/songSearch";
import * as api from "../api/commands";

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
      setError("O título é obrigatório");
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
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!score) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Música"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
        />
      }
    >
      <FormField label="Título" required>
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder="Nome da música"
          disabled={isSaving}
        />
      </FormField>

      <FormField label="Compositor">
        <AutocompleteInput
          value={composer}
          onChange={setComposer}
          placeholder="Nome do compositor"
          disabled={isSaving}
          suggestions={composerSuggestions}
        />
      </FormField>

      <FormField label="Arranjador">
        <AutocompleteInput
          value={arranger}
          onChange={setArranger}
          placeholder="Nome do arranjador"
          disabled={isSaving}
          suggestions={arrangerSuggestions}
        />
      </FormField>

      <FormField label="Categorias (múltiplas seleções)">
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
