import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useScrollLock } from "../hooks/useScrollLock";

interface ImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ImportBackupModal({
  isOpen,
  onClose,
  onConfirm,
}: ImportBackupModalProps) {
  const [countdown, setCountdown] = useState(5);
  const [isConfirming, setIsConfirming] = useState(false);
  const { t } = useTranslation();

  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setCountdown(5);
      setIsConfirming(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[#f8fafd] rounded-lg shadow-xl border border-[#c5cfdb] w-full max-w-md mx-4">
        <div className="flex flex-col items-center pt-6 pb-4">
          <AlertTriangle className="h-16 w-16 text-[#e67e22] mb-3" />
          <h2 className="text-xl font-bold text-[#2f4259]">
            {t("importBackupModal.title")}
          </h2>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <p className="text-sm text-[#4d6075] text-center">
            {t("importBackupModal.description")}
          </p>

          <div className="bg-[#ffeaa7] border border-[#fdcb6e] rounded-lg p-4">
            <p className="text-sm text-[#7d6608] font-medium mb-2">
              {t("importBackupModal.impactTitle")}
            </p>
            <ul className="text-xs text-[#7d6608] space-y-1 list-disc list-inside">
              <li>{t("importBackupModal.overwriteData")}</li>
              <li>{t("importBackupModal.replacesLocal")}</li>
              <li>{t("importBackupModal.cannotUndo")}</li>
            </ul>
          </div>

          <p className="text-xs text-[#8b9db2] text-center">
            {t("importBackupModal.confirmCountdown", { countdown })}
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6 border-t border-[#e0e8f0] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="flex-1 h-9 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {t("importBackupModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={countdown > 0 || isConfirming}
            className="flex-1 h-9 rounded bg-[#e67e22] hover:bg-[#d35400] text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isConfirming
              ? t("importBackupModal.confirming")
              : countdown > 0
                ? `${t("importBackupModal.confirmButton")} (${countdown}s)`
                : t("importBackupModal.confirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
