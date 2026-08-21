import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useScrollLock } from "../hooks/useScrollLock";
import type { SongListItem } from "../types";

interface ReindexSongsModalProps {
  isOpen: boolean;
  song: SongListItem | null;
  remainingCount: number;
  onOpenExplorer: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReindexSongsModal({
  isOpen,
  song,
  remainingCount,
  onOpenExplorer,
  onConfirm,
  onCancel,
}: ReindexSongsModalProps) {
  useScrollLock(isOpen);
  const { t } = useTranslation();

  if (!isOpen || !song || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[#f8fafd] rounded-lg shadow-xl border border-[#c5cfdb] p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-[#2f4259] mb-3">
          {t("reindexSongsModal.title")}
        </h2>
        <p className="text-sm text-[#4a6278] mb-1">
          {t("reindexSongsModal.song", { song: song.name })}
        </p>
        {remainingCount > 1 && (
          <p className="text-xs text-[#6b7f93] mb-4">
            {t("reindexSongsModal.remaining", { count: remainingCount - 1 })}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onOpenExplorer}
            className="px-4 py-2 text-sm font-medium text-[#344b61] border border-[#c5cfdb] rounded-lg hover:bg-[#eef2f6] transition-colors"
          >
            {t("reindexSongsModal.openExplorer")}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#344b61] border border-[#c5cfdb] rounded-lg hover:bg-[#eef2f6] transition-colors"
          >
            {t("confirmation.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-[#4f84d7] text-white rounded-lg hover:bg-[#3d6fb8] transition-colors"
          >
            {t("reindexSongsModal.reindex")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
