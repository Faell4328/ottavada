import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../context/AppContext";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage, AutocompleteInput } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import {
  normalizeSongNameForSave,
  normalizeSongNameInput,
} from "../utils/nameFormat";
import { describeExistingSongWarning, findSongByName } from "../utils/libraryDuplicates";
import { getUniqueSongAuthors } from "../utils/songSearch";

interface AddMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => Promise<void>;
  defaultCategoryIds?: string[];
}

export function AddMusicModal({
  isOpen,
  onClose,
  onSave,
  defaultCategoryIds = [],
}: AddMusicModalProps) {
  const { state } = useAppState();
  const visibleCategories = state.categories.filter(
    (category) => category.name.toLowerCase() !== "sem categoria"
  );
  const composerSuggestions = useMemo(() => getUniqueSongAuthors(state.songs, "composer"), [state.songs]);
  const arrangerSuggestions = useMemo(() => getUniqueSongAuthors(state.songs, "arranger"), [state.songs]);
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const normalizedTitle = useMemo(() => normalizeSongNameForSave(title), [title]);
  const existingSong = useMemo(
    () => findSongByName(state.songs, normalizedTitle),
    [normalizedTitle, state.songs]
  );
  const isDuplicateSong = existingSong !== null;

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setComposer("");
      setArranger("");
      setSelectedCategories(defaultCategoryIds);
      setError("");
    }
  }, [defaultCategoryIds, isOpen]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!normalizedTitle) {
      setError("Digite o título da música");
      return;
    }

    if (isDuplicateSong) {
      setError(describeExistingSongWarning());
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        title: normalizedTitle,
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
        categoryIds: selectedCategories,
      });
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao criar música";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Música"
      maxWidth="max-w-sm"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={isDuplicateSong}
          confirmLabel="Salvar"
          savingLabel="Criando..."
        />
      }
    >
      <FormField label="Nome da Música" required>
        {isDuplicateSong && (
          <p className="mb-1.5 text-xs font-semibold text-amber-700">
            {describeExistingSongWarning()}
          </p>
        )}
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder="Nome da música"
          autoFocus
          readOnly={isDuplicateSong}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />
      </FormField>

      <FormField label="Compositor">
        <AutocompleteInput
          value={composer}
          onChange={setComposer}
          placeholder="Nome do compositor"
          suggestions={composerSuggestions}
        />
      </FormField>

      <FormField label="Arranjador">
        <AutocompleteInput
          value={arranger}
          onChange={setArranger}
          placeholder="Nome do arranjador"
          suggestions={arrangerSuggestions}
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

      <ErrorMessage error={error} />
    </Modal>
  );
}
