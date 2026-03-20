import { useState, useEffect } from "react";
import { useAppState } from "../context/AppContext";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";

interface AddMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => Promise<void>;
}

export function AddMusicModal({
  isOpen,
  onClose,
  onSave,
}: AddMusicModalProps) {
  const { state } = useAppState();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setComposer("");
      setArranger("");
      setSelectedCategories([]);
      setError("");
    }
  }, [isOpen]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Digite o título da música");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        title: title.trim(),
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
          confirmLabel="Salvar"
          savingLabel="Criando..."
        />
      }
    >
      <FormField label="Nome da Música" required>
        <TextInput
          value={title}
          onChange={setTitle}
          placeholder="Nome da música"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />
      </FormField>

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

      {state.categories.length > 0 && (
        <FormField label="Categorias">
          <CategoryCheckboxList
            categories={state.categories}
            selectedIds={selectedCategories}
            onToggle={toggleCategory}
          />
        </FormField>
      )}

      <ErrorMessage error={error} />
    </Modal>
  );
}
