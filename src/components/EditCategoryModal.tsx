import { useEffect, useState } from "react";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";

interface EditCategoryModalProps {
  isOpen: boolean;
  category: { id: string; name: string } | null;
  onClose: () => void;
  onSave: (categoryId: string, name: string) => Promise<void>;
}

export function EditCategoryModal({ isOpen, category, onClose, onSave }: EditCategoryModalProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && category) {
      setName(category.name);
      setError("");
      setIsSaving(false);
    }
  }, [category, isOpen]);

  const handleSave = async () => {
    if (!category) return;

    const nextName = name.trim();
    if (!nextName) {
      setError("O nome da categoria não pode ficar vazio.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave(category.id, nextName);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!category) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Categoria"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={name.trim().length === 0}
        />
      }
    >
      <FormField label="Nome da Categoria" required>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="Digite o novo nome"
          disabled={isSaving}
          autoFocus
        />
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}