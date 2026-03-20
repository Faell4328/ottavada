import { useState, useEffect } from "react";
import { useAppState } from "../context/AppContext";
import type { SongListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";

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
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && score) {
      setTitle(score.name || "");
      setComposer(score.composer || "");
      setArranger(score.arranger || "");
      setSelectedCategories(score.category_ids || []);
      setError("");
    }
  }, [isOpen, score]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!score || !title.trim()) {
      setError("O título é obrigatório");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        songId: score.id,
        title: title.trim(),
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
          onChange={setTitle}
          placeholder="Nome da música"
          disabled={isSaving}
        />
      </FormField>

      <FormField label="Compositor">
        <TextInput
          value={composer}
          onChange={setComposer}
          placeholder="Nome do compositor"
          disabled={isSaving}
        />
      </FormField>

      <FormField label="Arranjador">
        <TextInput
          value={arranger}
          onChange={setArranger}
          placeholder="Nome do arranjador"
          disabled={isSaving}
        />
      </FormField>

      <FormField label="Categorias (múltiplas seleções)">
        <CategoryCheckboxList
          categories={state.categories}
          selectedIds={selectedCategories}
          onToggle={toggleCategory}
          disabled={isSaving}
        />
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
