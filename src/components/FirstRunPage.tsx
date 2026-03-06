import { useState, useEffect } from "react";
import { Music, HardDrive, Cloud, Eye, EyeOff } from "lucide-react";
import { useAppState } from "../context/AppContext";

function generateUUID(): string {
  // Simple UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function FirstRunPage() {
  const { completeFirstRun } = useAppState();
  const [computerName, setComputerName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [driveMode, setDriveMode] = useState<"local" | "api">("local");

  useEffect(() => {
    // Generate a UUID for initial computer name
    setComputerName(generateUUID().substring(0, 8).toUpperCase());
  }, []);

  async function handleContinue() {
    if (!computerName.trim()) {
      alert("Nome do computador é obrigatório");
      return;
    }
    if (driveMode === "api" && !apiKey.trim()) {
      alert("Chave da API do Google Drive é obrigatória para o modo API");
      return;
    }
    await completeFirstRun(
      computerName.trim(),
      driveMode,
      driveMode === "api" ? apiKey.trim() : null
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#33465d] to-[#5d6d82]">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
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

        {/* Computer name */}
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
            Identificador único deste computador. Vem pré-preenchido com um UUID que você pode alterar.
          </p>
        </div>

        {/* Google Drive mode */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#34485d] mb-2">
            Backup no Google Drive
          </label>
          <div className="flex flex-col gap-2">
            <DriveOption
              icon={<HardDrive className="h-5 w-5" />}
              label="Google Drive Local"
              description="Usa a pasta do Google Drive instalada no computador"
              recommended
              selected={driveMode === "local"}
              onClick={() => setDriveMode("local")}
            />
            <DriveOption
              icon={<Cloud className="h-5 w-5" />}
              label="Google Drive via API"
              description="Sincroniza diretamente com o Google Drive usando Service Account"
              selected={driveMode === "api"}
              onClick={() => setDriveMode("api")}
            />
          </div>
        </div>

        {/* API Key (conditional) */}
        {driveMode === "api" && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#34485d] mb-1.5">
              Chave da API do Google Drive (Service Account)
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20 pr-10"
                placeholder="Cole aqui o JSON da chave ou o token..."
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6b849e] hover:text-[#4d6075]"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-[#8b9db2] mt-1">
              Você pode atualizar isso nas configurações mais tarde.
            </p>
          </div>
        )}

        {/* Continue */}
        <button
          type="button"
          onClick={handleContinue}
          className="w-full h-11 rounded-lg bg-[#4f84d7] text-sm font-bold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer border-0"
        >
          Começar a usar
        </button>
      </div>
    </div>
  );
}

function DriveOption({
  icon,
  label,
  description,
  recommended,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  recommended?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all cursor-pointer ${
        selected
          ? "border-[#4f84d7] bg-[#f0f5ff]"
          : "border-[#e0e5ec] bg-white hover:border-[#a0b3c7]"
      }`}
    >
      <span className={selected ? "text-[#4f84d7]" : "text-[#6b849e]"}>
        {icon}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#2f4259]">{label}</span>
          {recommended && (
            <span className="text-[10px] font-bold text-[#4f84d7] bg-[#e8f0fe] px-1.5 py-0.5 rounded">
              Recomendado
            </span>
          )}
        </div>
        <p className="text-xs text-[#6b849e] mt-0.5">{description}</p>
      </div>
    </button>
  );
}
