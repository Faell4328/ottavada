import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-md",
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div
        className={`bg-[#f8fafd] rounded-lg shadow-xl border border-[#c5cfdb] w-full ${maxWidth} mx-4 max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#e0e8f0]">
          <h2 className="text-lg font-bold text-[#2f4259]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f2f5fa] transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5 text-[#8b9db2]" />
          </button>
        </div>

        <div className="p-4 space-y-4">{children}</div>

        {footer && (
          <div className="flex gap-2 p-4 border-t border-[#e0e8f0]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModalFooterButtonsProps {
  onCancel: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  savingLabel?: string;
}

export function ModalFooterButtons({
  onCancel,
  onConfirm,
  isSaving,
  cancelLabel = "Cancelar",
  confirmLabel = "Salvar",
  savingLabel = "Salvando...",
}: ModalFooterButtonsProps) {
  return (
    <>
      <button
        onClick={onCancel}
        className="flex-1 rounded border border-[#c5cfdb] px-3 py-2 text-sm font-medium text-[#344b61] hover:bg-[#f2f5fa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSaving}
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        className="flex-1 rounded bg-[#4f84d7] px-3 py-2 text-sm font-medium text-white hover:bg-[#3d6fb8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSaving}
      >
        {isSaving ? savingLabel : confirmLabel}
      </button>
    </>
  );
}
