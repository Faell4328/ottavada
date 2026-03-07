import { useState, useEffect } from "react";
import { Music, Upload, AlertCircle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAppState } from "../context/AppContext";
import type { GoogleServiceAccount } from "../types";

function generateUUID(): string {
  // Simple UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Step = "name" | "google-drive" | "confirm";

export default function FirstRunPage() {
  const { completeFirstRun } = useAppState();
  const [computerName, setComputerName] = useState("");
  const [step, setStep] = useState<Step>("name");
  const [serviceAccount, setServiceAccount] = useState<GoogleServiceAccount | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [useOfflineMode, setUseOfflineMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Generate a UUID for initial computer name
    setComputerName(generateUUID().substring(0, 8).toUpperCase());
  }, []);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonText(content);
      validateServiceAccount(content);
    };
    reader.onerror = () => {
      toast.error("Erro ao ler o arquivo");
    };
    reader.readAsText(file);
  }

  function validateServiceAccount(jsonStr: string) {
    try {
      const parsed: GoogleServiceAccount = JSON.parse(jsonStr);

      // Validate required fields
      const requiredFields: (keyof GoogleServiceAccount)[] = [
        "type",
        "project_id",
        "private_key_id",
        "private_key",
        "client_email",
        "client_id",
        "auth_uri",
        "token_uri",
      ];

      const missingFields = requiredFields.filter((field) => !parsed[field]);

      if (missingFields.length > 0) {
        toast.error(
          `Campos obrigatórios faltando: ${missingFields.join(", ")}`
        );
        setServiceAccount(null);
        return;
      }

      if (parsed.type !== "service_account") {
        toast.error('O arquivo deve conter type: "service_account"');
        setServiceAccount(null);
        return;
      }

      setServiceAccount(parsed);
      toast.success("Service Account validado com sucesso!");
    } catch (error) {
      toast.error(
        `JSON inválido: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
      setServiceAccount(null);
    }
  }

  function handleJsonPaste() {
    if (!jsonText.trim()) {
      toast.error("Cole um arquivo JSON válido");
      return;
    }
    validateServiceAccount(jsonText);
  }

  async function handleNameSubmit() {
    if (!computerName.trim()) {
      toast.error("Nome do computador é obrigatório");
      return;
    }
    setStep("google-drive");
  }

  async function handleOfflineMode() {
    setUseOfflineMode(true);
    setStep("confirm");
  }

  async function handleWithGoogle() {
    if (!serviceAccount) {
      toast.error("Carregue um Service Account válido");
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!computerName.trim()) {
      toast.error("Nome do computador é obrigatório");
      return;
    }

    setIsLoading(true);
    try {
      const serviceAccountJson = useOfflineMode
        ? null
        : JSON.stringify(serviceAccount);

      await completeFirstRun(computerName.trim(), "api", serviceAccountJson);
    } catch (error) {
      toast.error(
        `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
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
                Nome do computador
              </label>
              <input
                value={computerName}
                onChange={(e) => setComputerName(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder="Ex: Estúdio, Home, Sala Ensaio..."
              />
              <p className="text-xs text-[#8b9db2] mt-1">
                Identificador único deste computador. Você pode alterá-lo depois
                nas configurações.
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

        {/* Step 2: Google Drive Setup */}
        {step === "google-drive" && (
          <>
            <h2 className="text-lg font-semibold text-[#34485d] mb-4">
              Configure o Google Drive (opcional)
            </h2>

            <p className="text-sm text-[#6b849e] mb-6">
              Você pode configurar o backup automático agora ou usar o aplicativo
              offline. Pode atualizar isso nas configurações depois.
            </p>

            {/* Option 1: With Google Drive */}
            <div className="mb-6 p-4 border border-[#c5cfdb] rounded-lg">
              <h3 className="font-semibold text-[#34485d] mb-3">
                Com backup automático
              </h3>

              <p className="text-xs text-[#6b849e] mb-4">
                Carregue o arquivo JSON de Service Account do Google Cloud
                Console:
              </p>

              {/* File Upload */}
              <div className="mb-4">
                <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[#7ba0d4] rounded-lg cursor-pointer hover:bg-[#f8fafd] transition-colors">
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="h-6 w-6 text-[#7ba0d4] mb-2" />
                    <span className="text-sm font-medium text-[#34485d]">
                      Carregue o arquivo JSON
                    </span>
                    <span className="text-xs text-[#8b9db2]">
                      ou clique para selecionar
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Paste JSON */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#34485d] mb-2">
                  Ou cole o conteúdo JSON:
                </label>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="w-full h-24 rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 py-2 text-xs text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20 font-mono"
                  placeholder='Cole aqui o conteúdo do arquivo JSON...'
                />
                <button
                  onClick={handleJsonPaste}
                  className="mt-2 px-4 h-9 rounded-lg bg-[#7ba0d4] text-xs font-semibold text-white hover:bg-[#6a8ec0] transition-colors cursor-pointer border-0"
                >
                  Validar JSON
                </button>
              </div>

              {/* Status */}
              {serviceAccount && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">
                      Service Account válido
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Projeto: <code className="bg-green-100 px-1">{serviceAccount.project_id}</code>
                    </p>
                    <p className="text-xs text-green-700">
                      Email: <code className="bg-green-100 px-1 text-xs">{serviceAccount.client_email}</code>
                    </p>
                  </div>
                </div>
              )}

              {jsonText && !serviceAccount && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">
                      JSON inválido
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Verifique se todos os campos obrigatórios estão presentes
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleWithGoogle}
                disabled={!serviceAccount}
                className={`w-full h-10 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer border-0 ${
                  serviceAccount
                    ? "bg-[#4f84d7] hover:bg-[#3d6fb8]"
                    : "bg-[#9db3d1] cursor-not-allowed"
                }`}
              >
                Continuar com Google Drive
              </button>
            </div>

            {/* Option 2: Offline Mode */}
            <div className="p-4 border border-[#c5cfdb] rounded-lg">
              <h3 className="font-semibold text-[#34485d] mb-2">Modo Offline</h3>
              <p className="text-xs text-[#6b849e] mb-4">
                Use o aplicativo sem backup automático. Você pode configurar
                depois nas definições.
              </p>
              <button
                onClick={handleOfflineMode}
                className="w-full h-10 rounded-lg bg-[#e8eef8] text-sm font-bold text-[#4f84d7] hover:bg-[#dce4f0] transition-colors cursor-pointer border-0"
              >
                Usar Offline
              </button>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirm" && (
          <>
            <h2 className="text-lg font-semibold text-[#34485d] mb-6">
              Confirme suas configurações
            </h2>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-[#f8fafd] rounded-lg border border-[#c5cfdb]">
                <p className="text-xs text-[#8b9db2] mb-1">Nome do computador</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerName}
                </p>
              </div>

              <div className="p-4 bg-[#f8fafd] rounded-lg border border-[#c5cfdb]">
                <p className="text-xs text-[#8b9db2] mb-1">Modo de backup</p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {useOfflineMode ? (
                    <>
                      <span className="text-orange-600">Offline</span>
                      <span className="text-xs text-[#6b849e]"> (sem backup automático)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-600">Google Drive</span>
                      <span className="text-xs text-[#6b849e]"> ({serviceAccount?.project_id})</span>
                    </>
                  )}
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
              onClick={() => setStep("google-drive")}
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
