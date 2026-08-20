import { useEffect, useState } from "react";
import { LoaderCircle, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useScrollLock } from "../hooks/useScrollLock";
import type { AvailableBackup } from "../api/commands";

interface SelectBackupModalProps {
  isOpen: boolean;
  isLoading: boolean;
  backups: AvailableBackup[];
  onClose: () => void;
  onSelect: (backup: AvailableBackup) => void;
}

export function SelectBackupModal({
  isOpen,
  isLoading,
  backups,
  onClose,
  onSelect,
}: SelectBackupModalProps) {
  const { t } = useTranslation();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setSelectedFileName(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const selected = backups.find((b) => b.file_name === selectedFileName);
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[#f8fafd] rounded-lg shadow-xl border border-[#c5cfdb] w-full max-w-xl mx-4">
        <div className="flex flex-col items-center pt-6 pb-4">
          <Database className="h-12 w-12 text-[#344b61] mb-3" />
          <h2 className="text-xl font-bold text-[#2f4259]">
            {t("selectBackupModal.title")}
          </h2>
          <p className="text-sm text-[#4d6075] text-center mt-1 px-6">
            {t("selectBackupModal.description")}
          </p>
        </div>

        <div className="px-6 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#4d6075]">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              {t("selectBackupModal.loading")}
            </div>
          ) : backups.length === 0 ? (
            <div className="bg-[#ffeaa7] border border-[#fdcb6e] rounded-lg p-4 text-sm text-[#7d6608] text-center">
              {t("selectBackupModal.empty")}
            </div>
          ) : (
            <ul
              className="max-h-72 overflow-y-auto border border-[#c5cfdb] rounded-lg divide-y divide-[#e0e8f0] bg-white"
              data-testid="select-backup-list"
            >
              {backups.map((backup) => {
                const date = new Date(backup.generated_at * 1000);
                const isSelected = backup.file_name === selectedFileName;
                return (
                  <li key={backup.file_name}>
                    <button
                      type="button"
                      onClick={() => setSelectedFileName(backup.file_name)}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#e0e8f0]"
                          : "hover:bg-[#f2f5fa]"
                      }`}
                      data-testid="select-backup-item"
                    >
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedFileName(backup.file_name)}
                        className="accent-[#344b61]"
                      />
                      <span className="flex-1 min-w-0 text-[#2f4259]">
                        <span className="block">{date.toLocaleString()}</span>
                        <span className="block text-xs text-[#4d6075]">
                          {t("selectBackupModal.songs")}: {backup.songs_count} ·{" "}
                          {t("selectBackupModal.scores")}: {backup.scores_count} ·{" "}
                          {t("selectBackupModal.categories")}: {backup.categories_count} ·{" "}
                          {t("selectBackupModal.composers")}: {backup.composers_count} ·{" "}
                          {t("selectBackupModal.arrangers")}: {backup.arrangers_count}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6 border-t border-[#e0e8f0] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-9 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {t("selectBackupModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedFileName || isLoading}
            className="flex-1 h-9 rounded bg-[#344b61] hover:bg-[#2f4259] text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t("selectBackupModal.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
