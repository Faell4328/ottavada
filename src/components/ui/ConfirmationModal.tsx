import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useScrollLock } from "../../hooks/useScrollLock";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  useScrollLock(isOpen);
  const { t } = useTranslation();

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[#f8fafd] rounded-lg shadow-xl border border-[#c5cfdb] p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-[#2f4259] mb-3">{title}</h2>
        <p className="text-sm text-[#4a6278] mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[#344b61] border border-[#c5cfdb] rounded-lg hover:bg-[#eef2f6] disabled:opacity-50 transition-colors"
          >
            {t("confirmation.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-[#4f84d7] text-white rounded-lg hover:bg-[#3d6fb8] disabled:opacity-50 transition-colors"
          >
            {isLoading ? t("confirmation.processing") : t("confirmation.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
