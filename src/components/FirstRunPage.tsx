import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Music } from "lucide-react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import { useAppState } from "../context/AppContext";
import { useRcloneTest } from "../hooks/useRcloneTest";
import { getErrorMessage } from "../utils/errors";
import type { RcloneProvider } from "../types";

type Step = "name" | "type" | "rclone-setup" | "confirm";

function getRcloneProviderLabel(provider: RcloneProvider) {
  return provider === "koofr" ? "Koofr" : "Google Drive";
}

export default function FirstRunPage() {
  const { completeFirstRun } = useAppState();
  const [computerId, setComputerId] = useState("");
  const [computerName, setComputerName] = useState("");
  const [computerType, setComputerType] = useState<"Server" | "Client" | "">("Server");
  const [step, setStep] = useState<Step>("name");
  const [rcloneProvider, setRcloneProvider] = useState<RcloneProvider>("koofr");
  const [rcloneEmail, setRcloneEmail] = useState("");
  const [rcloneAppPassword, setRcloneAppPassword] = useState("");
  const [rcloneConfigGenerated, setRcloneConfigGenerated] = useState(false);
  const [rcloneConfigured, setRcloneConfigured] = useState(false);
  const [isGeneratingRcloneConfig, setIsGeneratingRcloneConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { testRclone } = useRcloneTest({
    provider: rcloneProvider,
    onSuccess: () => setRcloneConfigured(true),
    onFailure: () => setRcloneConfigured(false),
  });

  useEffect(() => {
    void api.generateComputerId()
      .then(setComputerId)
      .catch(() => {
        toast.error("Erro ao gerar ID do computador");
      });
  }, []);

  function handleProviderChange(nextProvider: RcloneProvider) {
    setRcloneProvider(nextProvider);
    setRcloneEmail("");
    setRcloneAppPassword("");
    setRcloneConfigGenerated(false);
    setRcloneConfigured(false);
  }

  async function handleGenerateRcloneConfig() {
    if (rcloneProvider === "koofr") {
      if (!rcloneEmail.trim()) {
        toast.error("Informe o email do Koofr");
        return;
      }

      if (!rcloneAppPassword.trim()) {
        toast.error("Informe a senha do aplicativo do Koofr");
        return;
      }
    }

    setIsGeneratingRcloneConfig(true);
    try {
      await api.generateRcloneConfig({
        provider: rcloneProvider,
        email: rcloneProvider === "koofr" ? rcloneEmail.trim() : null,
        appPassword: rcloneProvider === "koofr" ? rcloneAppPassword.trim() : null,
      });

      const wasConfigured = await testRclone();
      if (!wasConfigured) {
        setRcloneConfigGenerated(false);
        setRcloneConfigured(false);
        return;
      }

      setRcloneConfigGenerated(true);
      setRcloneConfigured(true);
      toast.success(
        rcloneProvider === "google_drive"
          ? "Google Drive configurado e testado com sucesso."
          : "Koofr configurado e testado com sucesso."
      );
    } catch (error) {
      setRcloneConfigGenerated(false);
      setRcloneConfigured(false);
      toast.error(`Erro ao gerar configuração do rclone: ${getErrorMessage(error)}`);
    } finally {
      setIsGeneratingRcloneConfig(false);
    }
  }

  function handleNameSubmit() {
    if (!computerName.trim()) {
      toast.error("Digite o nome do computador");
      return;
    }

    setStep("type");
  }

  function handleTypeSubmit() {
    if (!computerType) {
      toast.error("Selecione o tipo de computador");
      return;
    }

    setStep("rclone-setup");
  }

  async function handleWithRclone() {
    if (!rcloneConfigGenerated) {
      toast.error("Gere e teste a configuração do rclone antes de continuar");
      return;
    }

    if (!rcloneConfigured) {
      toast.error("A configuração do rclone precisa estar aprovada antes de continuar");
      return;
    }

    try {
      await api.deleteRcloneTestFile();
    } catch (error) {
      console.warn("Aviso ao deletar arquivo de teste local:", error);
    }

    setStep("confirm");
  }

  async function handleConfirm() {
    setIsLoading(true);
    try {
      await completeFirstRun(
        computerId,
        computerName.trim(),
        computerType,
        JSON.stringify({ provider: rcloneProvider })
      );
    } catch (error) {
      toast.error(`Erro: ${getErrorMessage(error)}`);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#33465d] to-[#5d6d82]">
      <div className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-3">
            <Music className="h-10 w-10 text-[#4f84d7]" />
            <h1 className="text-2xl font-bold text-[#2f4259]">Score Maestro</h1>
          </div>
          <p className="text-center text-sm text-[#6b849e]">
            Organize suas partituras com versionamento e backups automáticos
          </p>
        </div>

        {step === "name" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d]">Configure seu computador</h2>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
                ID do computador
              </label>
              <input
                value={computerId}
                disabled
                className="h-10 w-full cursor-not-allowed rounded-lg border border-[#c5cfdb] bg-[#f0f3f8] px-3 font-mono text-sm text-[#4d6075] outline-none"
              />
              <p className="mt-1 text-xs text-[#8b9db2]">
                Identificador único gerado automaticamente. Será usado para sincronizar dados entre computadores.
              </p>
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
                Nome do computador
              </label>
              <input
                value={computerName}
                onChange={(e) => setComputerName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="Ex: Estúdio, Home, Sala Ensaio..."
              />
              <p className="mt-1 text-xs text-[#8b9db2]">
                Nome descritivo para este computador. Você pode alterá-lo depois nas configurações.
              </p>
            </div>

            <button
              type="button"
              onClick={handleNameSubmit}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              Próximo
            </button>
          </>
        )}

        {step === "type" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d]">
              Qual é o tipo de computador?
            </h2>

            <p className="mb-6 text-sm text-[#6b849e]">
              Escolha o tipo que se aplica ao seu computador:
            </p>

            <div
              onClick={() => setComputerType("Server")}
              className={`mb-4 rounded-lg border-2 p-6 transition-all cursor-pointer ${
                computerType === "Server"
                  ? "border-[#4f84d7] bg-[#f0f3f8]"
                  : "border-[#c5cfdb] bg-white hover:border-[#7ba0d4]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    computerType === "Server"
                      ? "border-[#4f84d7] bg-[#4f84d7]"
                      : "border-[#c5cfdb]"
                  }`}
                >
                  {computerType === "Server" && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-[#34485d]">Servidor</h3>
                  <p className="text-xs text-[#6b849e]">
                    Computador mestre. Mantém todas as partituras indexadas localmente, detecta mudanças e é referência para sincronização com outros computadores.
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setComputerType("Client")}
              className={`mb-6 rounded-lg border-2 p-6 transition-all cursor-pointer ${
                computerType === "Client"
                  ? "border-[#4f84d7] bg-[#f0f3f8]"
                  : "border-[#c5cfdb] bg-white hover:border-[#7ba0d4]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    computerType === "Client"
                      ? "border-[#4f84d7] bg-[#4f84d7]"
                      : "border-[#c5cfdb]"
                  }`}
                >
                  {computerType === "Client" && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-[#34485d]">Cliente</h3>
                  <p className="text-xs text-[#6b849e]">
                    Computador secundário. Não indexa o diretório local, consulta partituras na versão principal e pode propor mudanças (que requerem aprovação do servidor).
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTypeSubmit}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              Próximo
            </button>

            <button
              type="button"
              onClick={() => setStep("name")}
              className="mt-2 h-10 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
            >
              Voltar
            </button>
          </>
        )}

        {step === "rclone-setup" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d]">Configure o Rclone</h2>

            <p className="mb-6 text-sm text-[#6b849e]">
              Escolha o provedor de nuvem e conclua a configuração em uma única ação.
            </p>

            <div className="mb-4 rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-4">
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9db2]">
                  Provedor de nuvem
                </p>
                <p className="mt-1 text-xs text-[#6b849e]">
                  Koofr é o recomendado para este fluxo inicial. Google Drive abre o navegador para autenticação.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleProviderChange("koofr")}
                  className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                    rcloneProvider === "koofr"
                      ? "border-[#4f84d7] bg-white"
                      : "border-[#c5cfdb] bg-white/70 hover:border-[#7ba0d4]"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#34485d]">Koofr</p>
                  <p className="mt-1 text-xs text-[#6b849e]">
                    Use a senha de aplicativo criada em https://app.koofr.net/.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleProviderChange("google_drive")}
                  className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                    rcloneProvider === "google_drive"
                      ? "border-[#4f84d7] bg-white"
                      : "border-[#c5cfdb] bg-white/70 hover:border-[#7ba0d4]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#34485d]">Google Drive</p>
                  <p className="mt-1 text-xs text-[#6b849e]">
                    Autentique pelo navegador usando o fluxo padrão do rclone.
                  </p>
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-[#c5cfdb] bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[#34485d]">
                  {getRcloneProviderLabel(rcloneProvider)}
                </p>
                <p className="text-xs text-[#6b849e]">
                  {rcloneProvider === "google_drive"
                    ? "Clique em Abrir navegador para autenticar e concluir a autorização."
                    : "Informe o email e a senha de aplicativo do Koofr."}
                </p>
              </div>

              {rcloneProvider === "koofr" ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-[#34485d]">
                      Email do Koofr
                    </label>
                    <input
                      value={rcloneEmail}
                      onChange={(e) => setRcloneEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                      placeholder="voce@exemplo.com"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-[#34485d]">
                      Senha do aplicativo
                    </label>
                    <input
                      type="password"
                      value={rcloneAppPassword}
                      onChange={(e) => setRcloneAppPassword(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                      placeholder="Senha criada no Koofr"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#6b849e]">
                  <p>
                    Clique em <span className="font-semibold text-[#34485d]">Abrir navegador para autenticar</span> para concluir a autorização do Google Drive.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void handleGenerateRcloneConfig();
              }}
              disabled={
                isGeneratingRcloneConfig ||
                (rcloneProvider === "koofr" && (!rcloneEmail.trim() || !rcloneAppPassword.trim()))
              }
              className={`mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border-0 text-sm font-bold transition-colors cursor-pointer ${
                isGeneratingRcloneConfig ||
                (rcloneProvider === "koofr" && (!rcloneEmail.trim() || !rcloneAppPassword.trim()))
                  ? "cursor-not-allowed bg-[#9db3d1] text-white"
                  : "bg-[#4f84d7] text-white hover:bg-[#3d6fb8]"
              }`}
            >
              {isGeneratingRcloneConfig && <Loader2 className="h-4 w-4 animate-spin" />}
              {isGeneratingRcloneConfig
                ? "Configurando..."
                : rcloneProvider === "google_drive"
                  ? "Configurar e testar Google Drive"
                  : "Configurar e testar Koofr"}
            </button>

            {rcloneConfigured && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">Rclone configurado e testado com sucesso</p>
                    <p className="mt-1 text-xs text-green-700">
                      Remote padrão: <code className="bg-green-100 px-1">{rcloneProvider === "koofr" ? "koofr" : "gdrive"}</code>
                    </p>
                    <p className="text-xs text-green-700">
                      Caminho padrão: <code className="bg-green-100 px-1">ScoreMaestro</code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleWithRclone}
                disabled={!rcloneConfigured}
                className={`h-10 flex-1 rounded-lg border-0 text-sm font-bold text-white transition-colors cursor-pointer ${
                  !rcloneConfigured
                    ? "cursor-not-allowed bg-[#9db3d1]"
                    : "bg-[#4f84d7] hover:bg-[#3d6fb8]"
                }`}
              >
                Continuar
              </button>

              <button
                type="button"
                onClick={() => setStep("type")}
                className="h-10 flex-1 rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <h2 className="mb-6 text-lg font-semibold text-[#34485d]">Confirme suas configurações</h2>

            <div className="mb-6 space-y-4">
              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">ID do computador</p>
                <p className="text-sm font-mono text-[#34485d]">{computerId}</p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">Nome do computador</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerName || "(não preenchido)"}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">Tipo de computador</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerType === "Server" ? "Servidor" : "Cliente"}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">Modo de sincronização</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  <span className="text-green-600">Rclone</span>
                  <span className="text-xs text-[#6b849e]"> ({rcloneProvider === "koofr" ? "koofr" : "gdrive"}:ScoreMaestro)</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`h-11 w-full rounded-lg border-0 text-sm font-bold text-white transition-colors cursor-pointer ${
                isLoading
                  ? "cursor-not-allowed bg-[#9db3d1]"
                  : "bg-[#4f84d7] hover:bg-[#3d6fb8]"
              }`}
            >
              {isLoading ? "Configurando..." : "Começar a usar"}
            </button>

            <button
              type="button"
              onClick={() => setStep("rclone-setup")}
              disabled={isLoading}
              className="mt-2 h-10 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
