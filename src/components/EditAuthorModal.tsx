import { useEffect, useState } from "react";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { useTranslation } from "react-i18next";

interface EditAuthorModalProps {
  isOpen: boolean;
  author: { kind: "composer" | "arranger"; name: string } | null;
  onClose: () => void;
  onSave: (kind: "composer" | "arranger", oldName: string, newName: string) => Promise<void>;
}

export function EditAuthorModal({ isOpen, author, onClose, onSave }: EditAuthorModalProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && author) {
      setName(author.name);
      setError("");
      setIsSaving(false);
    }
  }, [author, isOpen]);

  const handleSave = async () => {
    if (!author) return;

    const nextName = name.trim();
    if (!nextName) {
      setError(t("editAuthorModal.nameRequired"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave(author.kind, author.name, nextName);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("editAuthorModal.saveError");
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!author) return null;

  //const title = author.kind === "composer" ? "Editar Compositor" : "Editar Arranjador";
  //const label = author.kind === "composer" ? "Nome do Compositor" : "Nome do Arranjador";
  const title = author.kind === "composer" ? t("editAuthorModal.editComposerTitle"): t("editAuthorModal.editArrangerTitle");
  const label = author.kind === "composer" ? t("editAuthorModal.nameComposerLabel"): t("editAuthorModal.nameArrangerLabel");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={name.trim().length === 0}
        />
      }
    >
      <FormField label={label} required>
        <TextInput
          value={name}
          onChange={setName}
          placeholder={author.kind === "composer" ? t("editAuthorModal.nameComposerPlaceholder") : t("editAuthorModal.nameArrangerPlaceholder")}
          disabled={isSaving}
          autoFocus
        />
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
