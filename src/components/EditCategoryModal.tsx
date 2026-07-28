import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";

interface EditCategoryModalProps {
  isOpen: boolean;
  category: { id: string; name: string } | null;
  onClose: () => void;
  onSave: (categoryId: string, name: string) => Promise<void>;
}

export function EditCategoryModal({ isOpen, category, onClose, onSave }: EditCategoryModalProps) {
  const { t } = useTranslation();
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
      setError(t("editCategoryModal.nameRequired"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave(category.id, nextName);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("editCategoryModal.saveError");
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
      title={t("editCategoryModal.title")}
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={name.trim().length === 0}
        />
      }
    >
      <FormField label={t("editCategoryModal.nameLabel")} required>
        <TextInput
          value={name}
          onChange={setName}
          placeholder={t("editCategoryModal.namePlaceholder")}
          disabled={isSaving}
          autoFocus
        />
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}