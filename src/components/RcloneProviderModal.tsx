import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

import type { RcloneProvider, RcloneSetupInput } from "../types";
import { Modal } from "./ui/Modal";

interface RcloneProviderModalProps {
  isOpen: boolean;
  currentProvider: RcloneProvider;
  onClose: () => void;
  onGenerate: (setup: RcloneSetupInput) => Promise<void>;
  onTest: (provider: RcloneProvider) => Promise<void>;
  onApprove: (provider: RcloneProvider) => void;
}

function getProviderLabel(provider: RcloneProvider) {
  return provider === "koofr" ? "Koofr" : "Google Drive";
}

function getPrimaryActionLabel(provider: RcloneProvider, currentProvider: RcloneProvider) {
  if (provider === "google_drive") {
    return provider === currentProvider ? "Gerar e testar Google Drive" : "Trocar e testar Google Drive";
  }

  return provider === currentProvider ? "Gerar e testar Koofr" : "Trocar e testar Koofr";
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
  const [hasGeneratedConfig, setHasGeneratedConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedProvider(currentProvider);
    setEmail("");
    setAppPassword("");
    setHasGeneratedConfig(false);
    setIsGenerating(false);
    setIsTesting(false);
  }, [currentProvider, isOpen]);

  async function handleGenerate() {
    if (selectedProvider === "koofr") {
      if (!email.trim()) {
        return;
      }

      if (!appPassword.trim()) {
        return;
      }
    }

    setIsGenerating(true);
    try {
      await onGenerate({
        provider: selectedProvider,
        email: selectedProvider === "koofr" ? email.trim() : null,
        appPassword: selectedProvider === "koofr" ? appPassword.trim() : null,
      });
      setHasGeneratedConfig(true);
    } catch {
      // O erro já é tratado no componente pai; o modal apenas permanece aberto.
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleTestAndApprove() {
    setIsTesting(true);
    try {
      await onTest(selectedProvider);
      onApprove(selectedProvider);
      onClose();
    } catch {
      // O erro já é tratado no componente pai; o modal apenas permanece aberto.
    } finally {
      setIsTesting(false);
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
            disabled={isGenerating}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              void (hasGeneratedConfig ? handleTestAndApprove() : handleGenerate());
            }}
            className="flex-1 rounded bg-[#4f84d7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              isGenerating || isTesting ||
              (selectedProvider === "koofr" && (!email.trim() || !appPassword.trim()))
            }
          >
            {isGenerating
              ? "Gerando..."
              : isTesting
                ? "Testando..."
                : hasGeneratedConfig
                  ? "Testar e aplicar"
                  : getPrimaryActionLabel(selectedProvider, currentProvider)}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#d8e0ea] bg-[#f8fafd] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9db2]">
            Provedor atual
          </p>
          <div className="mt-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#4f84d7]" />
            <p className="text-sm font-semibold text-[#34485d]">
              {getProviderLabel(currentProvider)}
            </p>
          </div>
          <p className="mt-1 text-xs text-[#6b849e]">
            Primeiro gere a configuração. Depois rode o teste para liberar a troca do provedor.
          </p>
        </div>

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
              Depois disso, o teste valida se o provedor pode ser aplicado com segurança.
            </p>
          </div>
        )}

        {hasGeneratedConfig && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">Configuração gerada</p>
            <p className="mt-1 text-xs text-green-700">
              Agora execute o teste para confirmar a troca do provedor.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}