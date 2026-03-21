import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import { ChangeComputerTypeModal } from "./ChangeComputerTypeModal";
import type { AppSettings } from "../types";

export default function SettingsPage() {
  const { state, saveSettings, loadSettings } = useAppState();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(
    state.settings ?? {
      computer_id: "",
      computer_name: null,
      computer_type: "Server",
      google_drive_mode: "Local",
      first_run_completed: true,
      google_service_account: null,
      rclone_config: null,
    }
  );
  const [isTogglingType, setIsTogglingType] = useState(false);
  const [isChangeComputerTypeModalOpen, setIsChangeComputerTypeModalOpen] = useState(false);
  const [isTestingRclone, setIsTestingRclone] = useState(false);
  const [rcloneRemote, setRcloneRemote] = useState("");
  const [rclonePath, setRclonePath] = useState("ScoreMaestro");

  function update(partial: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  function handleComputerTypeChange() {
    setIsChangeComputerTypeModalOpen(true);
  }

  async function handleConfirmComputerTypeChange() {
    setIsTogglingType(true);
    try {
      const result = await api.toggleComputerType();
      setSettings((prev) => ({
        ...prev,
        computer_type: result as "Server" | "Client",
      }));
      toast.success(`Tipo de computador alterado para ${result}`);
      await loadSettings();
    } catch (err) {
      console.error("Failed to toggle computer type:", err);
      toast.error("Erro ao alternar tipo de computador");
    } finally {
      setIsTogglingType(false);
    }
  }

  async function handleTestRclone() {
    if (!rcloneRemote.trim()) {
      toast.error("Especifique o nome do remote do rclone");
      return;
    }

    setIsTestingRclone(true);
    try {
      await api.testRcloneUpload(rcloneRemote, rclonePath);
      toast.success("Teste realizado com sucesso! Arquivo enviado para o rclone.");
    } catch (error) {
      toast.error(
        `Erro ao testar rclone: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
    } finally {
      setIsTestingRclone(false);
    }
  }

  async function handleSave() {
    await saveSettings(settings);
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#edf1f6] via-[#f2f5fa] to-[#f8fafd] select-none">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#d8e0ea] bg-[#eef2f6] px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex h-8 w-8 items-center justify-center rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#344b61]" />
        </button>
        <h1 className="text-lg font-bold text-[#2f4259]">Configurações</h1>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {/* Computador */}
        <Section title="Computador">
          <Field label="Nome do computador">
            <input
              value={settings.computer_name ?? ""}
              onChange={(e) =>
                update({
                  computer_name: e.target.value || null,
                })
              }
              className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
              placeholder="Ex: Estúdio, Home, Sala Ensaio..."
            />
          </Field>

          <Field label="Tipo de computador">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 rounded border border-[#c5cfdb] bg-[#f0f3f8] px-3 text-sm text-[#4d6075] flex items-center">
                {settings.computer_type === "Server" ? "Servidor" : "Cliente"}
              </div>
              <button
                type="button"
                onClick={handleComputerTypeChange}
                disabled={isTogglingType}
                className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isTogglingType ? "Alternando..." : "Alternar"}
              </button>
            </div>
            <p className="text-xs text-[#8b9db2] mt-1">
              {settings.computer_type === "Server"
                ? "Computador mestre - indexa e sincroniza partituras. Clique em 'Alternar' para mudar para Cliente."
                : "Computador secundário - consulta e propõe alterações. Clique em 'Alternar' para mudar para Servidor."}
            </p>
          </Field>
        </Section>

        {/* Rclone */}
        <Section title="Rclone">
          <Field label="Remote do rclone">
            <input
              value={rcloneRemote}
              onChange={(e) => setRcloneRemote(e.target.value)}
              className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
              placeholder="Ex: gdrive"
            />
            <p className="text-xs text-[#8b9db2] mt-1">
              Nome do remote configurado no rclone (geralmente 'gdrive')
            </p>
          </Field>

          <Field label="Caminho no remote">
            <input
              value={rclonePath}
              onChange={(e) => setRclonePath(e.target.value)}
              className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
              placeholder="Ex: ScoreMaestro"
            />
            <p className="text-xs text-[#8b9db2] mt-1">
              Caminho onde os backups serão salvos
            </p>
          </Field>

          <div>
            <button
              type="button"
              onClick={handleTestRclone}
              disabled={isTestingRclone || !rcloneRemote.trim()}
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isTestingRclone ? "Testando..." : "Testar Rclone"}
            </button>
            <p className="text-xs text-[#8b9db2] mt-1">
              Clique para testar a conexão com o rclone. Um arquivo de teste será enviado.
            </p>
          </div>
        </Section>

        {/* Save */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="h-9 rounded bg-[#4f84d7] px-6 text-sm font-semibold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer border-0"
          >
            Salvar
          </button>
        </div>

        {/* Footer */}
        {
          (Math.round(Math.random()*10) == 1) ? (
            <div className="mt-12 text-center text-xs text-[#8b9db2]">
              In total, 200 cups of coffee were consumed and it is increasing ☕📈
            </div>
          ):(
            <div className="mt-12 text-center text-xs text-[#8b9db2]">
              Made by Rhafaell (@Faell4328) with lots of coffee ☕
            </div>
          )
        }
      </div>

      {/* Change Computer Type Modal */}
      <ChangeComputerTypeModal
        isOpen={isChangeComputerTypeModalOpen}
        currentType={settings.computer_type as "Server" | "Client"}
        onClose={() => setIsChangeComputerTypeModalOpen(false)}
        onConfirm={handleConfirmComputerTypeChange}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-[#34485d] mb-3 border-b border-[#d8e0ea] pb-1">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-[#5c7089] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
