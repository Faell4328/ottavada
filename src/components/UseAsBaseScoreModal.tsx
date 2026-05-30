import { useState, useEffect } from "react";
import type { ScoreListItem, SongListItem } from "../types";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
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
      setError("Digite um nome para a nova partitura");
      return;
    }

    if (hasNameConflict) {
      setError("Já existe uma partitura com esse nome");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const normalizedName = normalizeScoreNameForSave(nameToSave);

      if (!normalizedName) {
        setError("Digite um nome válido para a nova partitura");
        return;
      }

      await onSave(score.id, normalizedName);
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
      title="Usar como base"
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
          <p className="font-semibold">Nome duplicado</p>
          <p>Já existe outra partitura com esse nome. Escolha outro nome.</p>
        </div>
      )}

      <FormField label="Nome da Nova Partitura">
        <TextInput
          value={newScoreName}
          onChange={(value) => {
            setNewScoreName(value);
            setError("");
          }}
          placeholder="Ex: Flauta - Base"
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
