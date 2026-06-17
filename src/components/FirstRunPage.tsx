import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import { useAppState } from "../context/AppContext";
import { useRcloneTest } from "../hooks/useRcloneTest";
import { getFriendlyRcloneErrorMessage } from "../utils/rcloneErrors";
import type { RcloneProvider } from "../types";

type Step = "intro" | "name" | "type" | "rclone-setup" | "confirm";

function getRcloneProviderLabel(provider: RcloneProvider) {
  return provider === "koofr" ? "Koofr" : "Google Drive";
}

export default function FirstRunPage() {
  const { completeFirstRun } = useAppState();
  const [computerId, setComputerId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [computerName, setComputerName] = useState("");
  const [computerType, setComputerType] = useState<"Server" | "Client" | "">(
    "",
  );
  const [step, setStep] = useState<Step>("intro");
  const [rcloneProvider, setRcloneProvider] = useState<RcloneProvider>("koofr");
  const [rcloneEmail, setRcloneEmail] = useState("");
  const [rcloneAppPassword, setRcloneAppPassword] = useState("");
  const [rcloneConfigGenerated, setRcloneConfigGenerated] = useState(false);
  const [rcloneConfigured, setRcloneConfigured] = useState(false);
  const [isGeneratingRcloneConfig, setIsGeneratingRcloneConfig] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { testRclone } = useRcloneTest({
    provider: rcloneProvider,
    onSuccess: () => setRcloneConfigured(true),
    onFailure: () => setRcloneConfigured(false),
  });

  useEffect(() => {
    void api
      .generateComputerId()
      .then(setComputerId)
      .catch(() => {
        toast.error("Não foi possível criar o identificador deste computador.");
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
        toast.error("Digite o seu email do Koofr.");
        return;
      }

      if (!rcloneAppPassword.trim()) {
        toast.error("Digite a senha de aplicativo do Koofr.");
        return;
      }
    }

    setIsGeneratingRcloneConfig(true);
    try {
      await api.generateRcloneConfig({
        provider: rcloneProvider,
        email: rcloneProvider === "koofr" ? rcloneEmail.trim() : null,
        appPassword:
          rcloneProvider === "koofr" ? rcloneAppPassword.trim() : null,
      });

      const wasConfigured = await testRclone({ silent: true });
      if (!wasConfigured) {
        setRcloneConfigGenerated(false);
        setRcloneConfigured(false);
        return;
      }

      setRcloneConfigGenerated(true);
      setRcloneConfigured(true);
      toast.success(
        rcloneProvider === "google_drive"
          ? "Conexão com o Google Drive pronta para uso."
          : "Conexão com o Koofr pronta para uso.",
      );
    } catch (error) {
      setRcloneConfigGenerated(false);
      setRcloneConfigured(false);
      toast.error(
        getFriendlyRcloneErrorMessage(
          error,
          "Não foi possível configurar a conexão com a nuvem",
        ),
      );
    } finally {
      setIsGeneratingRcloneConfig(false);
    }
  }

  function handleNameSubmit() {
    if (!computerName.trim()) {
      toast.error("Digite um nome para este computador.");
      return;
    }

    if (computerType === "Server" && !organizationName.trim()) {
      toast.error("Digite o nome da organização ou instituição.");
      return;
    }

    setStep("rclone-setup");
  }

  function handleTypeSubmit() {
    if (!computerType) {
      toast.error("Escolha o tipo deste computador.");
      return;
    }

    setStep("name");
  }

  async function handleWithRclone() {
    if (!rcloneConfigGenerated) {
      toast.error(
        "Configure e teste a conexão com a nuvem antes de continuar.",
      );
      return;
    }

    if (!rcloneConfigured) {
      toast.error("Teste a conexão com a nuvem antes de continuar.");
      return;
    }

    try {
      await api.deleteRcloneTestFile();
    } catch (error) {
      console.error("Erro ao deletar arquivo de teste local:", error);
      toast.error("Erro ao remover arquivo de teste da nuvem.");
    }

    setStep("confirm");
  }

  function handleOpenTutorial() {
    void api.openTutorialSite();
  }

  async function handleConfirm() {
    setIsLoading(true);
    try {
      await completeFirstRun(
        computerId,
        computerName.trim(),
        organizationName.trim() || null,
        computerType,
        JSON.stringify({ provider: rcloneProvider }),
      );
    } catch (error) {
      toast.error("Não foi possível concluir a configuração inicial.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#33465d] to-[#5d6d82]">
      <div className="my-10 w-full max-w-2xl rounded-xl bg-white p-8 shadow-2xl">
        {step !== "intro" && (
          <div className="mb-4 flex flex-col items-center">
            <img
              src="/icon.png"
              alt="Score Maestro"
              loading="eager"
              fetchPriority="high"
              className="mb-3 h-20 w-20 rounded-2xl object-cover"
            />
          </div>
        )}

        {step === "intro" && (
          <>
            <div className="mb-6 rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-5">
              <h2 className="mb-3 text-lg font-semibold text-[#34485d]">
                Antes de começar
              </h2>
              <p className="text-sm leading-6 text-[#6b849e]">
                Para conseguir utilizar a ferramenta corretamente, assista ao
                vídeo de introdução no site oficial:
                scoremaestro.rhafaell.com.br/#tutorial. Ele mostra o fluxo
                básico e o que você precisa fazer no primeiro acesso.
              </p>
              <button
                type="button"
                onClick={handleOpenTutorial}
                className="mt-4 h-11 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-bold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
              >
                Abrir tutorial no navegador
              </button>
            </div>

            <div className="mb-6 overflow-hidden rounded-xl">
              <video
                autoPlay
                muted
                playsInline
                preload="auto"
                className="h-auto mx-auto w-4/5 2xl:w-full bg-black"
              >
                <source src="/intro.webm" type="video/webm" />
                <source src="/intro.mp4" type="video/mp4" />
                Seu navegador não suporta reprodução de vídeo.
              </video>
            </div>

            <button
              type="button"
              onClick={() => setStep("type")}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              Avançar
            </button>
          </>
        )}

        {step === "type" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d] text-center">
              Qual tipo de computador você está configurando?
            </h2>

            <p className="mb-6 text-sm text-[#6b849e] text-center">
              Isso define como este computador vai funcionar dentro do Score
              Maestro.
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
                  {computerType === "Server" && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-[#34485d]">
                    Computador do Maestro
                  </h3>
                  <p className="text-xs text-[#6b849e]">
                    Use no computador onde você organiza, revisa e confirma as
                    alterações. Só pode existir um computador do maestro.
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
                  {computerType === "Client" && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-[#34485d]">
                    Computador de Ensaio
                  </h3>
                  <p className="text-xs text-[#6b849e]">
                    Use em computadores para visualizar e copiar partituras com
                    menos responsabilidades. Pode existir mais de um computador
                    de ensaio.
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
          </>
        )}

        {step === "name" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d] text-center">
              Configure este computador
            </h2>

            <p className="mb-6 text-sm text-[#6b849e] text-center">
              Dê nomes simples e fáceis de reconhecer. Você pode mudar isso
              depois nas configurações.
            </p>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
                Nome do computador
              </label>
              <input
                value={computerName}
                onChange={(e) => setComputerName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="Ex: Mesa do maestro, sala de ensaio, igreja..."
              />
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
                Organização ou instituição
              </label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="Ex: Orquestra, igreja, ministério..."
              />
            </div>

            <button
              type="button"
              onClick={handleNameSubmit}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              Próximo
            </button>

            <button
              type="button"
              onClick={() => setStep("type")}
              className="mt-2 h-10 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
            >
              Voltar
            </button>
          </>
        )}

        {step === "rclone-setup" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d] text-center">
              Escolha e conecte ao Provedor de Nuvem
            </h2>

            <p className="w-4/5 mx-auto mb-6 text-sm text-[#6b849e] text-center">
              <b>Importante: </b>
              <span>
                tando o Computador do Maestro e o Computador do Ensaio, devem
                usar o mesmo provedor e conta
              </span>
            </p>

            <div className="mb-4 rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-4">
              <div className="mb-3 pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9db2]">
                  Provedor de nuvem
                </p>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                  Recomendado
                </span>
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
                  <p className="text-sm font-semibold text-[#34485d]">Koofr</p>
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
                  <p className="text-sm font-semibold text-[#34485d]">
                    Google Drive
                  </p>
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-[#c5cfdb] bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[#34485d]">
                  {getRcloneProviderLabel(rcloneProvider)}
                </p>
                <p className="mt-2 text-xs text-[#6b849e]">
                  {rcloneProvider === "google_drive"
                    ? "Ao clicar no botão será aberto seu navegador para escolher a conta Google"
                    : "Informe o email e a senha de aplicativo do Koofr."}
                </p>
              </div>
              {rcloneProvider === "koofr" && (
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
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void handleGenerateRcloneConfig();
              }}
              disabled={
                isGeneratingRcloneConfig ||
                (rcloneProvider === "koofr" &&
                  (!rcloneEmail.trim() || !rcloneAppPassword.trim()))
              }
              className={`mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border-0 text-sm font-bold transition-colors cursor-pointer ${
                isGeneratingRcloneConfig ||
                (rcloneProvider === "koofr" &&
                  (!rcloneEmail.trim() || !rcloneAppPassword.trim()))
                  ? "cursor-not-allowed bg-[#9db3d1] text-white"
                  : "bg-[#4f84d7] text-white hover:bg-[#3d6fb8]"
              }`}
            >
              {isGeneratingRcloneConfig && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
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
                    <p className="text-xs font-semibold text-green-800">
                      Rclone configurado e testado com sucesso
                    </p>
                    <p className="mt-1 text-xs text-green-700">
                      Remote padrão:{" "}
                      <code className="bg-green-100 px-1">
                        {rcloneProvider === "koofr" ? "koofr" : "gdrive"}
                      </code>
                    </p>
                    <p className="text-xs text-green-700">
                      Caminho padrão:{" "}
                      <code className="bg-green-100 px-1">ScoreMaestro</code>
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
            <h2 className="mb-6 text-lg font-semibold text-[#34485d]">
              Confirme suas configurações
            </h2>

            <div className="mb-6 space-y-4">
              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  Nome do computador
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerName || "(não preenchido)"}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  Organização ou instituição
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {organizationName || "(não preenchido)"}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  Tipo de computador
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerType === "Server"
                    ? "Computador do Maestro"
                    : "Computador de Ensaio"}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  Modo de sincronização
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  <span className="text-green-600">Rclone</span>
                  <span className="text-xs text-[#6b849e]">
                    {" "}
                    ({rcloneProvider === "koofr" ? "koofr" : "gdrive"}
                    :ScoreMaestro)
                  </span>
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
