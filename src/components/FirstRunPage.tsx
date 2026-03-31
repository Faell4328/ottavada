import { useState, useEffect } from "react";
import { Music, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import { getErrorMessage } from "../utils/errors";
import { useRcloneTest } from "../hooks/useRcloneTest";

type Step = "name" | "type" | "rclone-setup" | "confirm";

export default function FirstRunPage() {
  const { completeFirstRun } = useAppState();
  const [computerId, setComputerId] = useState("");
  const [computerName, setComputerName] = useState("");
  const [computerType, setComputerType] = useState<"Server" | "Client" | "">("Server");
  const [step, setStep] = useState<Step>("name");
  const [rcloneRemote, setRcloneRemote] = useState("");
  const [rclonePath, setRclonePath] = useState("ScoreMaestro");
  const [rcloneConfigured, setRcloneConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { isTestingRclone, testRclone } = useRcloneTest({
    remote: rcloneRemote,
    path: rclonePath,
    onSuccess: () => setRcloneConfigured(true),
    onFailure: () => setRcloneConfigured(false),
  });

  useEffect(() => {
    // Generate a UUID for the computer
    api.generateComputerId()
      .then(setComputerId)
      .catch(() => {
        toast.error("Erro ao gerar ID do computador");
      });
  }, []);

  async function handleNameSubmit() {
    if (!computerName.trim()) {
      toast.error("Digite o nome do computador");
      return;
    }
    setStep("type");
  }

  async function handleTypeSubmit() {
    if (!computerType) {
      toast.error("Selecione o tipo de computador");
      return;
    }
    setStep("rclone-setup");
  }

  async function handleWithRclone() {
    if (!rcloneRemote.trim()) {
      toast.error("Preencha o nome do remote do rclone");
      return;
    }

    if (!rcloneConfigured) {
      toast.error("Teste a conexão com rclone antes de continuar");
      return;
    }
    
    // Deletar arquivo de teste local da pasta /nuvem
    try {
      await api.deleteRcloneTestFile();
    } catch (error) {
      // Não bloqueia o fluxo se falhar ao deletar
      console.warn("Aviso ao deletar arquivo de teste local:", error);
    }
    
    setStep("confirm");
  }

  async function handleConfirm() {
    setIsLoading(true);
    try {
      const rcloneJson = JSON.stringify({ remote: rcloneRemote, path: rclonePath });

      await completeFirstRun(computerId, computerName.trim(), computerType, rcloneJson);
    } catch (error) {
      toast.error(`Erro: ${getErrorMessage(error)}`);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#33465d] to-[#5d6d82]">
      <div className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Music className="h-10 w-10 text-[#4f84d7]" />
            <h1 className="text-2xl font-bold text-[#2f4259]">
              Score Maestro
            </h1>
          </div>
          <p className="text-sm text-[#6b849e] text-center">
            Organize suas partituras com versionamento e backups automáticos
          </p>
        </div>

        {/* Step 1: Computer Name */}
        {step === "name" && (
          <>
            <h2 className="text-lg font-semibold text-[#34485d] mb-4">
              Configure seu computador
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#34485d] mb-1.5">
                ID do computador
              </label>
              <input
                value={computerId}
                disabled
                className="w-full h-10 rounded-lg border border-[#c5cfdb] bg-[#f0f3f8] px-3 text-sm text-[#4d6075] outline-none cursor-not-allowed font-mono"
              />
              <p className="text-xs text-[#8b9db2] mt-1">
                Identificador único gerado automaticamente. Será usado para sincronizar dados entre computadores.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#34485d] mb-1.5">
                Nome do computador
              </label>
              <input
                value={computerName}
                onChange={(e) => setComputerName(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="Ex: Estúdio, Home, Sala Ensaio..."
              />
              <p className="text-xs text-[#8b9db2] mt-1">
                Nome descritivo para este computador. Você pode alterá-lo depois nas configurações.
              </p>
            </div>

            <button
              onClick={handleNameSubmit}
              className="w-full h-11 rounded-lg bg-[#4f84d7] text-sm font-bold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer border-0"
            >
              Próximo
            </button>
          </>
        )}

        {/* Step 2: Computer Type */}
        {step === "type" && (
          <>
            <h2 className="text-lg font-semibold text-[#34485d] mb-4">
              Qual é o tipo de computador?
            </h2>

            <p className="text-sm text-[#6b849e] mb-6">
              Escolha o tipo que se aplica ao seu computador:
            </p>

            {/* Server Option */}
            <div
              onClick={() => setComputerType("Server")}
              className={`mb-4 p-6 rounded-lg border-2 cursor-pointer transition-all ${
                computerType === "Server"
                  ? "border-[#4f84d7] bg-[#f0f3f8]"
                  : "border-[#c5cfdb] bg-white hover:border-[#7ba0d4]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    computerType === "Server"
                      ? "border-[#4f84d7] bg-[#4f84d7]"
                      : "border-[#c5cfdb]"
                  }`}
                >
                  {computerType === "Server" && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-[#34485d] mb-1">Servidor</h3>
                  <p className="text-xs text-[#6b849e]">
                    Computador mestre. Mantém todas as partituras indexadas localmente, detecta mudanças e é referência para sincronização com outros computadores.
                  </p>
                </div>
              </div>
            </div>

            {/* Client Option */}
            <div
              onClick={() => setComputerType("Client")}
              className={`mb-6 p-6 rounded-lg border-2 cursor-pointer transition-all ${
                computerType === "Client"
                  ? "border-[#4f84d7] bg-[#f0f3f8]"
                  : "border-[#c5cfdb] bg-white hover:border-[#7ba0d4]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    computerType === "Client"
                      ? "border-[#4f84d7] bg-[#4f84d7]"
                      : "border-[#c5cfdb]"
                  }`}
                >
                  {computerType === "Client" && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-[#34485d] mb-1">Cliente</h3>
                  <p className="text-xs text-[#6b849e]">
                    Computador secundário. Não indexa o diretório local, consulta partituras na versão principal e pode propor mudanças (que requerem aprovação do servidor).
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleTypeSubmit}
              className="w-full h-11 rounded-lg bg-[#4f84d7] text-sm font-bold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer border-0"
            >
              Próximo
            </button>

            <button
              onClick={() => setStep("name")}
              className="w-full h-10 rounded-lg bg-white text-sm font-semibold text-[#4f84d7] border border-[#7ba0d4] hover:bg-[#f8fafd] transition-colors cursor-pointer mt-2"
            >
              Voltar
            </button>
          </>
        )}

        {/* Step 3: Rclone Setup */}
        {step === "rclone-setup" && (
          <>
            <h2 className="text-lg font-semibold text-[#34485d] mb-4">
              Configure o Rclone
            </h2>

            <p className="text-sm text-[#6b849e] mb-6">
              Rclone sincroniza seus backups com a nuvem. Configure e valide agora para concluir o primeiro acesso.
            </p>

            {/* Option 1: With Rclone */}
            <div className="mb-6 p-4 border border-[#c5cfdb] rounded-lg">
              <h3 className="font-semibold text-[#34485d] mb-3">
                Com sincronização em nuvem
              </h3>

              <p className="text-xs text-[#6b849e] mb-4">
                Configure o rclone em seu computador primeiro. Pode fazer download em{" "}
                <a 
                  href="https://rclone.org/downloads/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#4f84d7] hover:underline font-semibold"
                >
                  rclone.org/downloads
                </a>
              </p>

              {/* Rclone Remote Name */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#34485d] mb-2">
                  Nome do Remote (ex: gdrive, pcloud)
                </label>
                <input
                  value={rcloneRemote}
                  onChange={(e) => {
                    setRcloneRemote(e.target.value);
                    setRcloneConfigured(false);
                  }}
                  className="w-full h-10 rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                  placeholder="Nome do remote do rclone"
                />
              </div>

              {/* Rclone Path */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#34485d] mb-2">
                  Caminho na nuvem (ex: /ScoreMaestro)
                </label>
                <input
                  value={rclonePath}
                  onChange={(e) => {
                    setRclonePath(e.target.value);
                    setRcloneConfigured(false);
                  }}
                  className="w-full h-10 rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                  placeholder="/ScoreMaestro"
                />
              </div>

              {/* Test Button */}
              <button
                onClick={() => {
                  void testRclone();
                }}
                disabled={isTestingRclone || !rcloneRemote.trim()}
                className={`w-full h-10 rounded-lg text-sm font-bold transition-colors cursor-pointer border-0 mb-4 flex items-center justify-center gap-2 ${
                  isTestingRclone || !rcloneRemote.trim()
                    ? "bg-[#9db3d1] cursor-not-allowed text-white"
                    : "bg-[#7ba0d4] hover:bg-[#6a8ec0] text-white"
                }`}
              >
                {isTestingRclone && <Loader2 className="h-4 w-4 animate-spin" />}
                {isTestingRclone ? "Testando..." : "Fazer Teste"}
              </button>

              {/* Status */}
              {rcloneConfigured && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">
                      Rclone configurado com sucesso
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Remote: <code className="bg-green-100 px-1">{rcloneRemote}</code>
                    </p>
                    <p className="text-xs text-green-700">
                      Caminho: <code className="bg-green-100 px-1">{rclonePath}</code>
                    </p>
                  </div>
                </div>
              )}

              {rcloneRemote && !rcloneConfigured && !isTestingRclone && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-800">
                      Teste pendente
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Clique em "Testar Conexão" para validar as configurações
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleWithRclone}
                disabled={!rcloneConfigured && !!rcloneRemote.trim()}
                className={`w-full h-10 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer border-0 ${
                  !rcloneConfigured && rcloneRemote.trim()
                    ? "bg-[#9db3d1] cursor-not-allowed"
                    : "bg-[#4f84d7] hover:bg-[#3d6fb8]"
                }`}
              >
                Continuar com Rclone
              </button>
            </div>

            <button
              onClick={() => setStep("type")}
              className="w-full h-10 rounded-lg bg-white text-sm font-semibold text-[#4f84d7] border border-[#7ba0d4] hover:bg-[#f8fafd] transition-colors cursor-pointer mt-2"
            >
              Voltar
            </button>
          </>
        )}

        {/* Step 4: Confirmation */}
        {step === "confirm" && (
          <>
            <h2 className="text-lg font-semibold text-[#34485d] mb-6">
              Confirme suas configurações
            </h2>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-[#f8fafd] rounded-lg border border-[#c5cfdb]">
                <p className="text-xs text-[#8b9db2] mb-1">ID do computador</p>
                <p className="text-sm font-mono text-[#34485d]">
                  {computerId}
                </p>
              </div>

              <div className="p-4 bg-[#f8fafd] rounded-lg border border-[#c5cfdb]">
                <p className="text-xs text-[#8b9db2] mb-1">Nome do computador</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerName || "(não preenchido)"}
                </p>
              </div>

              <div className="p-4 bg-[#f8fafd] rounded-lg border border-[#c5cfdb]">
                <p className="text-xs text-[#8b9db2] mb-1">Tipo de computador</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerType === "Server" ? "Servidor" : "Cliente"}
                </p>
              </div>

              <div className="p-4 bg-[#f8fafd] rounded-lg border border-[#c5cfdb]">
                <p className="text-xs text-[#8b9db2] mb-1">Modo de sincronização</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  <span className="text-green-600">Rclone</span>
                  <span className="text-xs text-[#6b849e]"> ({rcloneRemote}:{rclonePath})</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`w-full h-11 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer border-0 ${
                isLoading
                  ? "bg-[#9db3d1] cursor-not-allowed"
                  : "bg-[#4f84d7] hover:bg-[#3d6fb8]"
              }`}
            >
              {isLoading ? "Configurando..." : "Começar a usar"}
            </button>

            <button
              onClick={() => setStep("rclone-setup")}
              disabled={isLoading}
              className="w-full h-10 rounded-lg bg-white text-sm font-semibold text-[#4f84d7] border border-[#7ba0d4] hover:bg-[#f8fafd] transition-colors cursor-pointer mt-2"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
