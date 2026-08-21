import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import type { SongListItem, ScoreListItem } from "../types";
import * as api from "../api/commands";
import {
  Modal,
  ModalFooterButtons,
  FormField,
  TextInput,
  ErrorMessage,
} from "./ui";
import {
  normalizeScoreNameForSave,
  normalizeScoreNameInput,
} from "../utils/nameFormat";
import { findScoreNameConflictInSong } from "../utils/libraryDuplicates";

interface EditScoreModalProps {
  isOpen: boolean;
  score: SongListItem | null;
  instrument: ScoreListItem | null;
  onClose: () => void;
  onSave: (data: {
    songId: string;
    scoreFileId: string;
    instrumentName: string | null;
  }) => Promise<void>;
}

export function EditScoreModal({
  isOpen,
  score,
  instrument,
  onClose,
  onSave,
}: EditScoreModalProps) {
  const { t } = useTranslation();
  const [instrumentName, setInstrumentName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [isOpeningScore, setIsOpeningScore] = useState(false);
  const [isOpeningLocation, setIsOpeningLocation] = useState(false);

  const nameConflict = useMemo(() => {
    if (!score || !instrument) {
      return null;
    }

    return findScoreNameConflictInSong(score, instrumentName, instrument.id);
  }, [instrument, instrumentName, score]);
  const hasNameConflict = nameConflict !== null;

  useEffect(() => {
    if (isOpen && score && instrument) {
      setInstrumentName(normalizeScoreNameInput(instrument.name || ""));
      setFilePath(instrument.file_path || "");
      setError("");
      setIsOpeningScore(false);
      setIsOpeningLocation(false);
    }
  }, [isOpen, score, instrument]);

  const handleOpenScore = async () => {
    const selectedPath = filePath.trim();

    if (!selectedPath && !instrument) {
      setError(t("editScoreModal.selectFileError"));
      return;
    }

    setIsOpeningScore(true);
    setError("");

    try {
      if (selectedPath) {
        await api.openFilePath(selectedPath);
      } else {
        await api.openFile(instrument?.id ?? "");
      }
    } catch {
      setError(t("editScoreModal.openScoreError"));
    } finally {
      setIsOpeningScore(false);
    }
  };

  const handleOpenLocal = async () => {
    const selectedPath = filePath.trim();

    if (!selectedPath && !instrument) {
      setError(t("editScoreModal.selectLocalError"));
      return;
    }

    setIsOpeningLocation(true);
    setError("");

    try {
      if (selectedPath) {
        await api.openFileLocation(selectedPath);
      } else {
        await api.openFileLocation(instrument?.id ?? "");
      }
    } catch {
      setError(t("editScoreModal.openLocalError"));
    } finally {
      setIsOpeningLocation(false);
    }
  };

  const handleSave = async () => {
    if (!score || !instrument) return;

    if (hasNameConflict) {
      setError(t("editScoreModal.nameConflictSaveError"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        songId: score.id,
        scoreFileId: instrument.id,
        instrumentName: normalizeScoreNameForSave(instrumentName),
      });
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("editScoreModal.saveError");
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!score || !instrument) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("editScoreModal.title")}
      maxWidth="max-w-lg"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
          confirmDisabled={hasNameConflict}
        />
      }
    >
      {hasNameConflict && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">{t("editScoreModal.nameConflictTitle")}</p>
          <p>
            {t("editScoreModal.nameConflictMessage")}
          </p>
        </div>
      )}

      {/* Music Info - Read Only */}
      <FormField label={t("editScoreModal.musicLabel")}>
        <div className="rounded border border-[#c5cfdb] bg-[#f5f7fa] p-3">
          <p className="text-sm text-[#344b61] font-medium">{score.name}</p>
          {score.composer && (
            <p className="text-xs text-[#8b9db2] mt-1">
              {t("editScoreModal.composerPrefix")} {score.composer}
            </p>
          )}
          {score.arranger && (
            <p className="text-xs text-[#8b9db2]">
              {t("editScoreModal.arrangerPrefix")} {score.arranger}
            </p>
          )}
        </div>
      </FormField>

      <FormField label={t("editScoreModal.instrumentLabel")}>
        <TextInput
          value={instrumentName}
          onChange={(value) =>
            setInstrumentName(normalizeScoreNameInput(value))
          }
          placeholder={t("editScoreModal.instrumentPlaceholder")}
          disabled={isSaving}
        />
      </FormField>

      <FormField label={t("editScoreModal.pathLabel")}>
        <div className="space-y-2">
          <div className="rounded border border-[#c5cfdb] bg-[#f5f7fa] p-3 min-h-[2.5rem] overflow-auto max-h-24">
            <p className="text-xs text-[#344b61] whitespace-pre-wrap break-all">
              {filePath || (
                <span className="text-sm text-[#a3b5c7]">
                  {t("editScoreModal.noFileSelected")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenScore}
              disabled={isSaving || isOpeningScore || isOpeningLocation}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-[#d8e0ea] px-2 py-2 text-xs text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
              title={t("addFilesModal.titleOpenScore")}
            >
              {isOpeningScore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              {t("scoreRow.open")}
            </button>

            <button
              type="button"
              onClick={handleOpenLocal}
              disabled={isSaving || isOpeningScore || isOpeningLocation}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-[#d8e0ea] px-2 py-2 text-xs text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
              title={t("addFilesModal.titleOpenLocal")}
            >
              {isOpeningLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              {t("addFilesModal.btnOpen")}
            </button>
          </div>
        </div>
      </FormField>

      <ErrorMessage error={error} />
    </Modal>
  );
}
