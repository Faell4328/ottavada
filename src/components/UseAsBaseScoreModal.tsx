import { useState, useEffect } from "react";
import type { ScoreListItem, SongListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { useTranslation } from "react-i18next";
import { normalizeScoreNameForSave, normalizeScoreNameInput } from "../utils/nameFormat";
import { findScoreNameConflictInSong } from "../utils/libraryDuplicates";

interface UseAsBaseScoreModalProps {
  isOpen: boolean;
  song: SongListItem | null;
  score: ScoreListItem | null;
  onClose: () => void;
  onSave: (
    sourceScoreId: string,
    newScoreName: string
  ) => Promise<void>;
}

export function UseAsBaseScoreModal({
  isOpen,
  song,
  score,
  onClose,
  onSave,
}: UseAsBaseScoreModalProps) {
  const [newScoreName, setNewScoreName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const nameConflict =
    song && score && newScoreName
      ? findScoreNameConflictInSong(song, newScoreName, score.id)
      : null;

  const hasNameConflict = nameConflict !== null;

  useEffect(() => {
    if (isOpen && score) {
      setNewScoreName(normalizeScoreNameInput(score.name || ""));
      setError("");
    }
  }, [isOpen, score]);

  const handleSave = async () => {
    if (!score) return;

    const nameToSave = newScoreName.trim();

    if (!nameToSave) {
      setError(t("useAsBaseScoreModal.nameRequired"));
      return;
    }

    if (hasNameConflict) {
      setError(t("useAsBaseScoreModal.nameConflictError"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const normalizedName = normalizeScoreNameForSave(nameToSave);

      if (!normalizedName) {
        setError(t("useAsBaseScoreModal.invalidName"));
        return;
      }

      await onSave(score.id, normalizedName);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("useAsBaseScoreModal.saveError");
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
      title={t("useAsBaseScoreModal.title")}
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={hasNameConflict || !newScoreName.trim()}
        />
      }
    >
      {hasNameConflict && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">{t("useAsBaseScoreModal.nameConflictTitle")}</p>
          <p>{t("useAsBaseScoreModal.nameConflictMessage")}</p>
        </div>
      )}

      <FormField label={t("useAsBaseScoreModal.nameLabel")}>
        <TextInput
          value={newScoreName}
          onChange={(value) => {
            setNewScoreName(value);
            setError("");
          }}
          placeholder={t("useAsBaseScoreModal.namePlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleSave();
            }
          }}
        />
      </FormField>

      {error && <ErrorMessage error={error} />}
    </Modal>
  );
}
