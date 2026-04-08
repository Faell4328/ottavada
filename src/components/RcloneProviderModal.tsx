import { useEffect, useState } from "react";

import type { RcloneProvider, RcloneSetupInput } from "../types";
import { Modal } from "./ui/Modal";

interface RcloneProviderModalProps {
  isOpen: boolean;
  currentProvider: RcloneProvider;
  onClose: () => void;
  onGenerate: (setup: RcloneSetupInput) => Promise<void>;
  onTest: (provider: RcloneProvider) => Promise<void>;
  onApprove: (provider: RcloneProvider) => Promise<void>;
}


function getPrimaryActionLabel(provider: RcloneProvider, currentProvider: RcloneProvider) {
  if (provider === "google_drive") {
    return provider === currentProvider
      ? "Atualizar e testar Google Drive"
      : "Trocar para Google Drive e testar";
  }

  return provider === currentProvider
    ? "Atualizar e testar Koofr"
    : "Trocar para Koofr e testar";
}

export function RcloneProviderModal({
  isOpen,
  currentProvider,
  onClose,
  onGenerate,
  onTest,
  onApprove,
}: RcloneProviderModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<RcloneProvider>(currentProvider);
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedProvider(currentProvider);
    setEmail("");
    setAppPassword("");
    setIsSubmitting(false);
  }, [currentProvider, isOpen]);

  async function handleSubmit() {
    if (selectedProvider === "koofr") {
      if (!email.trim()) {
        return;
      }

      if (!appPassword.trim()) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onGenerate({
        provider: selectedProvider,
        email: selectedProvider === "koofr" ? email.trim() : null,
        appPassword: selectedProvider === "koofr" ? appPassword.trim() : null,
      });
      await onTest(selectedProvider);
      await onApprove(selectedProvider);
      onClose();
    } catch {
      // O erro já é tratado no componente pai; o modal apenas permanece aberto.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mudar provedor de nuvem"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded border border-[#c5cfdb] bg-white px-4 py-2 text-sm font-medium text-[#344b61] transition-colors hover:bg-[#f2f5fa]"
            disabled={isSubmitting}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            className="flex-1 rounded bg-[#4f84d7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              isSubmitting ||
              (selectedProvider === "koofr" && (!email.trim() || !appPassword.trim()))
            }
          >
            {isSubmitting
                ? "Testando..."
                : getPrimaryActionLabel(selectedProvider, currentProvider)}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelectedProvider("koofr")}
            className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
              selectedProvider === "koofr"
                ? "border-[#4f84d7] bg-white"
                : "border-[#c5cfdb] bg-white/70 hover:border-[#7ba0d4]"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {currentProvider === "koofr" && (
                <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                  Atual
                </span>
              )}
              {currentProvider !== "koofr" && (
                <span className="rounded-full bg-[#eef3f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b849e]">
                  Alternativa
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-[#34485d]">Koofr</p>
            <p className="mt-1 text-xs text-[#6b849e]">
              Use email + senha de aplicativo.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedProvider("google_drive")}
            className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
              selectedProvider === "google_drive"
                ? "border-[#4f84d7] bg-white"
                : "border-[#c5cfdb] bg-white/70 hover:border-[#7ba0d4]"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {currentProvider === "google_drive" && (
                <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                  Atual
                </span>
              )}
              {currentProvider !== "google_drive" && (
                <span className="rounded-full bg-[#eef3f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b849e]">
                  Alternativa
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-[#34485d]">Google Drive</p>
            <p className="mt-1 text-xs text-[#6b849e]">
              Autenticação via navegador.
            </p>
          </button>
        </div>

        {selectedProvider === "koofr" ? (
          <div className="space-y-3 rounded-xl border border-[#c5cfdb] bg-white p-4">
            <p className="text-sm font-semibold text-[#34485d]">Credenciais do Koofr</p>
            <p className="text-xs text-[#6b849e]">
              Informe uma nova credencial se quiser trocar ou renovar o acesso.
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="voce@exemplo.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">Senha do aplicativo</label>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="Senha criada no Koofr"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#c5cfdb] bg-white p-4">
            <p className="text-sm font-semibold text-[#34485d]">Autenticação do Google Drive</p>
            <p className="mt-1 text-xs text-[#6b849e]">
              Ao confirmar, o navegador será aberto para gerar a configuração.
            </p>
            <p className="mt-1 text-xs text-[#6b849e]">
              O teste é executado automaticamente na mesma etapa antes de aplicar.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}