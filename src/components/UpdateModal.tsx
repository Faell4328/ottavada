import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { Clock3, Download, Sparkles } from "lucide-react";
import { Modal, ModalFooterButtons } from "./ui";
import type { UpdateInfo } from "../types";
import { renderUpdateBody } from "../utils/updateBody";
import { getLocale } from "../utils/locale";

interface UpdateModalProps {
  isOpen: boolean;
  update: UpdateInfo | null;
  isInstalling: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatUpdateDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const locale = getLocale(i18next.language);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

export function UpdateModal({
  isOpen,
  update,
  isInstalling,
  onCancel,
  onConfirm,
}: UpdateModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !update) {
    return null;
  }

  const formattedDate = formatUpdateDate(update.date);
  const renderedBody = renderUpdateBody(update.body);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t("updateModal.title")}
      maxWidth="max-w-xl"
      footer={(
        <ModalFooterButtons
          onCancel={onCancel}
          onConfirm={onConfirm}
          isSaving={isInstalling}
          cancelLabel={t("updateModal.defer")}
          confirmLabel={t("updateModal.updateNow")}
          savingLabel={t("updateModal.updating")}
        />
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#dbe6f2] bg-[#f3f7fc] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2f4259]">
              {t("updateModal.newVersion", { version: update.version })}
            </p>
            <p className="text-sm text-[#5e7390]">
              {t("updateModal.deferHint")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-[#4a6278] sm:grid-cols-2">
          <div className="rounded-lg border border-[#dbe6f2] bg-white px-3 py-2">
            <span className="block text-[11px] uppercase tracking-wide text-[#7a8fa8]">
              {t("updateModal.currentVersion")}
            </span>
            <span className="font-medium text-[#2f4259]">{update.current_version}</span>
          </div>
          {formattedDate && (
            <div className="rounded-lg border border-[#dbe6f2] bg-white px-3 py-2">
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[#7a8fa8]">
                <Clock3 className="h-3 w-3" />
                {t("updateModal.publishedAt")}
              </span>
              <span className="font-medium text-[#2f4259]">{formattedDate}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#dbe6f2] bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#2f4259]">
            <Download className="h-4 w-4 text-[#4f84d7]" />
            {t("updateModal.releaseNotes")}
          </div>
          {renderedBody.length > 0 ? (
            <div className="space-y-3 text-sm leading-6 text-[#4a6278]">{renderedBody}</div>
          ) : (
            <p className="text-sm leading-6 text-[#4a6278]">
              {t("updateModal.noNotes")}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}