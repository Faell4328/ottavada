import { Clock3, Download, Sparkles } from "lucide-react";
import { Modal, ModalFooterButtons } from "./ui";
import type { UpdateInfo } from "../types";

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

  return new Intl.DateTimeFormat("pt-BR", {
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
  if (!isOpen || !update) {
    return null;
  }

  const formattedDate = formatUpdateDate(update.date);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Atualização disponível"
      maxWidth="max-w-xl"
      footer={(
        <ModalFooterButtons
          onCancel={onCancel}
          onConfirm={onConfirm}
          isSaving={isInstalling}
          cancelLabel="Adiar"
          confirmLabel="Atualizar agora"
          savingLabel="Atualizando..."
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
              Nova versão {update.version} detectada
            </p>
            <p className="text-sm text-[#5e7390]">
              Você pode adiar agora e instalar quando estiver pronto.
            </p>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-[#4a6278] sm:grid-cols-2">
          <div className="rounded-lg border border-[#dbe6f2] bg-white px-3 py-2">
            <span className="block text-[11px] uppercase tracking-wide text-[#7a8fa8]">
              Versão atual
            </span>
            <span className="font-medium text-[#2f4259]">{update.current_version}</span>
          </div>
          {formattedDate && (
            <div className="rounded-lg border border-[#dbe6f2] bg-white px-3 py-2">
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[#7a8fa8]">
                <Clock3 className="h-3 w-3" />
                Publicada em
              </span>
              <span className="font-medium text-[#2f4259]">{formattedDate}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#dbe6f2] bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#2f4259]">
            <Download className="h-4 w-4 text-[#4f84d7]" />
            Notas da versão
          </div>
          <p className="whitespace-pre-line text-sm leading-6 text-[#4a6278]">
            {update.body?.trim() || "Sem notas adicionais para esta atualização."}
          </p>
        </div>
      </div>
    </Modal>
  );
}