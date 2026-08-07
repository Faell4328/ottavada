import { createPortal } from "react-dom";
import { useTranslation, Trans } from "react-i18next";

interface DeleteFileConfirmationModalProps {
  fileName: string;
  onCancel: () => void;
  onIgnore: () => void;
  onConfirm: () => void;
}

export function DeleteFileConfirmationModal({
  fileName,
  onCancel,
  onIgnore,
  onConfirm,
}: DeleteFileConfirmationModalProps) {
  const { t } = useTranslation();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-[#2f4259]">
          {t("deleteFileConfirmation.title")}
        </h2>
        <p className="mb-2 text-sm text-[#4a6278]">
          <Trans
            i18nKey="deleteFileConfirmation.message"
            values={{ fileName }}
            components={{ strong: <strong /> }}
          />
        </p>
        <p className="mb-6 text-sm text-[#4a6278]">
          {t("deleteFileConfirmation.ignoreHint")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#c5cfdb] px-4 py-2 text-sm font-medium text-[#344b61] transition-colors hover:bg-[#eef2f6]"
          >
            {t("deleteFileConfirmation.cancel")}
          </button>
          <button
            type="button"
            onClick={onIgnore}
            className="rounded-lg border border-[#4f84d7] px-4 py-2 text-sm font-medium text-[#4f84d7] transition-colors hover:bg-[#edf4ff]"
          >
            {t("deleteFileConfirmation.ignore")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[#c04b4b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#a93b3b]"
          >
            {t("deleteFileConfirmation.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
