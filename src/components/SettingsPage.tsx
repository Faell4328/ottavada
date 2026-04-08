import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import toast from "react-hot-toast";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import { getErrorMessage } from "../utils/errors";
import { ChangeComputerTypeModal } from "./ChangeComputerTypeModal";
import { RcloneProviderModal } from "./RcloneProviderModal.tsx";
import { RcloneLicenseModal } from "./RcloneLicenseModal";
import { formatBackupTimestamp } from "../utils/formatters";
import type { AppSettings, RcloneProvider } from "../types";
import { isClientComputer } from "../utils/computer";

function getRcloneProviderLabel(provider: RcloneProvider) {
  return provider === "koofr" ? "Koofr" : "Google Drive";
}

export default function SettingsPage() {
  const {
    state,
    saveSettings,
    loadSettings,
    loadSongs,
    loadCategories,
    scanFilesForChanges,
  } = useAppState();
  const navigate = useNavigate();
  const isClient = isClientComputer(state.settings?.computer_type);
  const isSyncLocked = state.isScanningFiles || state.rcloneProgress.direction !== null;
  const [settings, setSettings] = useState<AppSettings>(
    state.settings ?? {
      computer_id: "",
      computer_name: null,
      computer_type: "Server",
      google_drive_mode: "Local",
      first_run_completed: true,
      google_service_account: null,
      rclone_config: null,
      library_summary: null,
    }
  );
  const [isTogglingType, setIsTogglingType] = useState(false);
  const [isChangeComputerTypeModalOpen, setIsChangeComputerTypeModalOpen] = useState(false);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isImportingBackupCloud, setIsImportingBackupCloud] = useState(false);
  const [isGeneratingBackupCloud, setIsGeneratingBackupCloud] = useState(false);
  const [rcloneProvider, setRcloneProvider] = useState<RcloneProvider>("koofr");
  const [rcloneConfigGenerated, setRcloneConfigGenerated] = useState(false);
  const [hasRcloneConfigChange, setHasRcloneConfigChange] = useState(false);
  const [isRcloneProviderModalOpen, setIsRcloneProviderModalOpen] = useState(false);
  const [isRcloneLicenseModalOpen, setIsRcloneLicenseModalOpen] = useState(false);

  const isSettingsOperationInProgress =
    isTogglingType ||
    isGeneratingSnapshot ||
    isExportingBackup ||
    isImportingBackup ||
    isImportingBackupCloud ||
    isGeneratingBackupCloud ||
    isSyncLocked;

  // Carregar dados do rclone da store quando o componente monta ou settings muda
  useEffect(() => {
    if (state.settings?.rclone_config) {
      setRcloneProvider(state.settings.rclone_config.provider);
      setRcloneConfigGenerated(true);
    } else {
      setRcloneProvider("koofr");
      setRcloneConfigGenerated(false);
    }
  }, [state.settings]);

  useEffect(() => {
    if (state.settings) {
      setSettings(state.settings);
    }
  }, [state.settings]);

  function update(partial: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function handleGenerateRcloneConfig(setup: {
    provider: RcloneProvider;
    email?: string | null;
    appPassword?: string | null;
  }) {
    try {
      await api.generateRcloneConfig(setup);

      toast.success(
        setup.provider === "google_drive"
          ? "Google Drive autenticado com sucesso."
          : "Koofr configurado com sucesso."
      );
    } catch (error) {
      toast.error(`Erro ao gerar configuração do rclone: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async function handleTestRcloneConfig(provider: RcloneProvider) {
    try {
      await api.testRcloneUpload(provider);
      toast.success(
        provider === "google_drive"
          ? "Teste do Google Drive aprovado."
          : "Teste do Koofr aprovado."
      );
    } catch (error) {
      toast.error(`Erro ao testar o rclone: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async function handleApproveRcloneProvider(provider: RcloneProvider) {
    setRcloneProvider(provider);
    setRcloneConfigGenerated(true);
    setHasRcloneConfigChange(true);

    if (isClient) {
      return;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      throw new Error("SYNC_LOCKED");
    }

    const baseSettings = state.settings ?? settings;
    const updatedSettings: AppSettings = {
      ...baseSettings,
      rclone_config: {
        provider,
      },
    };

    try {
      await saveSettings(updatedSettings);
      await loadSettings();

      const snapshotCreated = await handleForceSnapshot(updatedSettings);
      if (!snapshotCreated) {
        throw new Error("SNAPSHOT_FAILED");
      }

      setHasRcloneConfigChange(false);
    } catch (error) {
      toast.error(`Erro ao aplicar troca de provedor/conta: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  function handleBackNavigation() {
    if (isSettingsOperationInProgress) {
      toast.error("Aguarde a operação atual terminar antes de sair das configurações");
      return;
    }

    navigate("/");
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

  async function handleSave() {
    if (isClient) {
      toast.error("Configurações não podem ser alteradas em um cliente");
      return;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      return;
    }

    if (!rcloneConfigGenerated) {
      toast.error("Gere a configuração do rclone antes de salvar");
      return;
    }

    // Atualizar os dados de rclone no objeto settings antes de salvar
    const updatedSettings: AppSettings = {
      ...settings,
      rclone_config: {
        provider: rcloneProvider,
      },
    };

    try {
      const previousProvider = state.settings?.rclone_config?.provider ?? null;
      await saveSettings(updatedSettings);
      toast.success("Configurações salvas com sucesso!");

      if (previousProvider !== rcloneProvider || hasRcloneConfigChange) {
        const snapshotCreated = await handleForceSnapshot(updatedSettings);
        if (!snapshotCreated) {
          return;
        }
      }

      setHasRcloneConfigChange(false);

      navigate("/");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Erro ao salvar configurações");
    }
  }

  async function handleForceSnapshot(settingsOverride?: AppSettings) {
    const currentSettings = settingsOverride ?? state.settings ?? settings;

    if (currentSettings.computer_type !== "Server") {
      toast.error("A geração de snapshot é permitida apenas no servidor");
      return false;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      return false;
    }

    setIsGeneratingSnapshot(true);
    navigate("/");
    const loadingToastId = toast.loading("Gerando snapshot e aplicando alterações...");
    try {
      const summary = await api.generateSnapshotFile(true);
      await loadSettings();

      toast.success(
        `Snapshot gerado (${summary.songs_count} música(s), ${summary.scores_count} partitura(s)). Aplicando alterações...`
      );

      await scanFilesForChanges({ forceCloudSync: true });
      await Promise.all([loadSongs(), loadCategories()]);
      return true;
    } catch (error) {
      toast.error(`Erro ao gerar snapshot/aplicar alterações: ${getErrorMessage(error)}`);
      return false;
    } finally {
      toast.dismiss(loadingToastId);
      setIsGeneratingSnapshot(false);
    }
  }

  async function handleExportBackup() {
    if (settings.computer_type !== "Server") {
      toast.error("A exportacao de backup e permitida apenas no servidor");
      return;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      return;
    }

    const selectedPath = await save({
      title: "Salvar backup local",
      defaultPath: "backup.msgpack",
      filters: [{ name: "Backup local", extensions: ["msgpack"] }],
    });

    if (!selectedPath) {
      return;
    }

    setIsExportingBackup(true);
    try {
      const summary = await api.exportBackupFile(String(selectedPath));
      toast.success(
        `Backup local exportado (${summary.songs_count} musica(s), ${summary.scores_count} partitura(s))`
      );
    } catch (error) {
      toast.error(`Erro ao exportar backup local: ${getErrorMessage(error)}`);
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function handleImportBackup() {
    if (settings.computer_type !== "Server") {
      toast.error("A importacao de backup e permitida apenas no servidor");
      return;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      return;
    }

    const selectedPath = await open({
      title: "Selecionar backup local",
      directory: false,
      multiple: false,
      filters: [{ name: "Backup local", extensions: ["msgpack"] }],
    });

    if (!selectedPath || Array.isArray(selectedPath)) {
      return;
    }

    setIsImportingBackup(true);
    navigate("/");
    const loadingToastId = toast.loading("Importando backup local...");

    void (async () => {
      let shouldRunForcedSnapshot = false;
      let refreshedSettings: AppSettings | null = null;
      try {
        const summary = await api.importBackupFile(selectedPath);
        toast.success(
          `Backup local importado com sucesso. O backup é de ${formatBackupTimestamp(summary.generated_at)}; alterações posteriores não estão incluídas.`,
          { duration: 8000 }
        );
        refreshedSettings = await api.getSettings();
        setSettings(refreshedSettings);
        await Promise.all([loadSettings(), loadSongs(), loadCategories()]);
        shouldRunForcedSnapshot = true;
      } catch (error) {
        toast.error(`Erro ao importar backup local: ${getErrorMessage(error)}`);
      } finally {
        toast.dismiss(loadingToastId);
        setIsImportingBackup(false);
      }

      if (shouldRunForcedSnapshot) {
        void handleForceSnapshot(refreshedSettings ?? undefined);
      }
    })();
  }

  async function handleImportBackupCloud() {
    if (settings.computer_type !== "Server") {
      toast.error("A importacao de backup da nuvem e permitida apenas no servidor");
      return;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      return;
    }

    if (!settings.rclone_config) {
      toast.error("Configure o rclone antes de importar o backup da nuvem");
      return;
    }

    setIsImportingBackupCloud(true);
    navigate("/");
    const loadingToastId = toast.loading("Importando backup da nuvem...");

    void (async () => {
      let shouldRunForcedSnapshot = false;
      let refreshedSettings: AppSettings | null = null;
      try {
        const summary = await api.importBackupCloudFile();
        toast.success(
          `Backup da nuvem importado com sucesso. O backup é de ${formatBackupTimestamp(summary.generated_at)}; alterações posteriores não estão incluídas.`,
          { duration: 8000 }
        );
        refreshedSettings = await api.getSettings();
        setSettings(refreshedSettings);
        await Promise.all([loadSettings(), loadSongs(), loadCategories()]);
        shouldRunForcedSnapshot = true;
      } catch (error) {
        toast.error(`Erro ao importar backup da nuvem: ${getErrorMessage(error)}`);
      } finally {
        toast.dismiss(loadingToastId);
        setIsImportingBackupCloud(false);
      }

      if (shouldRunForcedSnapshot) {
        void handleForceSnapshot(refreshedSettings ?? undefined);
      }
    })();
  }

  async function handleGenerateBackupCloud() {
    if (settings.computer_type !== "Server") {
      toast.error("A geração de backup na nuvem é permitida apenas no servidor");
      return;
    }

    if (isSyncLocked) {
      toast.error("Operação bloqueada durante sincronização");
      return;
    }

    if (!settings.rclone_config) {
      toast.error("Configure o rclone antes de gerar o backup na nuvem");
      return;
    }

    setIsGeneratingBackupCloud(true);
    try {
      const summary = await api.forceGenerateBackupCloudFile();
      await loadSettings();
      toast.success(
        `Backup na nuvem gerado com sucesso em ${formatBackupTimestamp(summary.generated_at)}.`,
        {
          duration: 8000,
        }
      );
    } catch (error) {
      toast.error(`Erro ao gerar backup na nuvem: ${getErrorMessage(error)}`);
    } finally {
      setIsGeneratingBackupCloud(false);
    }
  }

  const lastSnapshotLabel = settings.last_snapshot_timestamp
    ? new Date(settings.last_snapshot_timestamp * 1000).toLocaleString("pt-BR")
    : "Nunca gerado";

  const lastBackupLabel = settings.last_backup_timestamp
    ? formatBackupTimestamp(settings.last_backup_timestamp)
    : "Nunca gerado";

  const librarySummary = settings.library_summary;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#edf1f6] via-[#f2f5fa] to-[#f8fafd] select-none">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#d8e0ea] bg-[#eef2f6] px-4 py-3">
        <button
          type="button"
          onClick={handleBackNavigation}
          disabled={isSettingsOperationInProgress}
          className="flex h-8 w-8 items-center justify-center rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#344b61]" />
        </button>
        <h1 className="text-lg font-bold text-[#2f4259]">Configurações</h1>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {isClient && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Este computador está em modo cliente. A tela de configurações é somente leitura.
          </div>
        )}

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
              disabled={isClient || isSyncLocked}
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
                disabled={isTogglingType || isClient || isSyncLocked}
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

        <Section title="Provedor de Nuvem">
          <div className="rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-4">
            <p className="mt-1 text-xs text-[#6b849e]">
              Provedor atual: <span className="font-semibold text-[#34485d]">{getRcloneProviderLabel(rcloneProvider)}</span>
            </p>
            <p className="mt-1 text-xs text-[#6b849e]">
              Remote padrão: <span className="font-semibold text-[#34485d]">{rcloneProvider === "koofr" ? "koofr" : "gdrive"}</span>
            </p>
            <p className="mt-1 text-xs text-[#6b849e]">
              Caminho padrão: <span className="font-semibold text-[#34485d]">ScoreMaestro</span>
            </p>

            {rcloneConfigGenerated ? (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-semibold text-green-800">Configuração pronta</p>
                <p className="mt-1 text-xs text-green-700">
                  A configuração do rclone já foi gerada para este provedor.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs font-semibold text-yellow-800">Configuração pendente</p>
                <p className="mt-1 text-xs text-yellow-700">
                  Clique para abrir o modal e gerar ou trocar o provedor de nuvem.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsRcloneProviderModalOpen(true)}
              disabled={isClient || isSettingsOperationInProgress}
              className="mt-4 h-9 rounded border border-[#4f84d7] bg-[#4f84d7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              Mudar provedor de nuvem
            </button>
          </div>
        </Section>

        {/* Snapshot */}
        <Section title="Snapshot">
          <div>
            <button
              type="button"
              onClick={() => {
                void handleForceSnapshot();
              }}
              disabled={
                isGeneratingSnapshot ||
                state.isScanningFiles ||
                isSyncLocked ||
                settings.computer_type !== "Server" ||
                isClient
              }
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isGeneratingSnapshot ? "Gerando..." : "Forçar geração de snapshot"}
            </button>
            <p className="text-xs text-[#8b9db2] mt-1">
              Gera manualmente o arquivo <code>snapshot.msgpack.zst</code>, ignorando a regra de 2MB.
            </p>
            <p className="text-xs text-[#8b9db2] mt-1">
              Último snapshot: {lastSnapshotLabel}
            </p>
          </div>
        </Section>

        {/* Backup local */}
        <Section title="Backup local">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExportingBackup || settings.computer_type !== "Server" || isClient || isSyncLocked}
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isExportingBackup ? "Exportando..." : "Exportar backup local"}
            </button>

            <button
              type="button"
              onClick={handleImportBackup}
              disabled={isImportingBackup || settings.computer_type !== "Server" || isClient || isSyncLocked}
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isImportingBackup ? "Importando..." : "Importar backup local"}
            </button>
          </div>

          <p className="text-xs text-[#8b9db2] mt-1">
            Exporta e importa um backup local completo do banco de dados e das configurações.
          </p>
        </Section>

        {/* Backup cloud */}
        <Section title="Backup na nuvem">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateBackupCloud}
              disabled={
                isGeneratingBackupCloud ||
                settings.computer_type !== "Server" ||
                !settings.rclone_config ||
                isSyncLocked ||
                isClient
              }
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isGeneratingBackupCloud ? "Gerando..." : "Fazer backup agora"}
            </button>

            <button
              type="button"
              onClick={handleImportBackupCloud}
              disabled={
                isImportingBackupCloud ||
                settings.computer_type !== "Server" ||
                !settings.rclone_config ||
                isSyncLocked ||
                isClient
              }
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isImportingBackupCloud ? "Importando..." : "Importar backup cloud"}
            </button>
          </div>

          <p className="text-xs text-[#8b9db2] mt-1">
            Gera e envia o backup para a nuvem imediatamente, ou baixa o backup da nuvem para o computador.
          </p>
        </Section>

        {/* Backup automático */}
        <Section title="Backup automático">
          <p className="text-xs text-[#8b9db2] mt-1">
            O servidor verifica automaticamente ao iniciar se já passaram 3 dias desde o último backup na nuvem.
          </p>
          <p className="text-xs text-[#8b9db2] mt-1">
            Último backup automático: {lastBackupLabel}
          </p>
        </Section>

        {/* Sobre */}
        <Section title="Sobre">
          {librarySummary && (
            <div className="mb-3 rounded-xl border border-[#d8e0ea] bg-white/80 p-3 text-xs text-[#4f6887]">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryColumn
                  label="Músicas"
                  main={librarySummary.main.songs_count}
                  pending={librarySummary.pending.songs_count}
                  notFound={librarySummary.not_found.songs_count}
                />
                <SummaryColumn
                  label="Partituras"
                  main={librarySummary.main.scores_count}
                  pending={librarySummary.pending.scores_count}
                  notFound={librarySummary.not_found.scores_count}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsRcloneLicenseModalOpen(true)}
            title="abrir licença"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#4f84d7] underline decoration-[#7ba0d4] underline-offset-2 transition-colors hover:text-[#3d6fb8] hover:decoration-[#3d6fb8] cursor-pointer"
          >
            <span>Este software utiliza rclone (licença MIT)</span>
          </button>
        </Section>

        {/* Save */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!rcloneConfigGenerated || isClient || isSettingsOperationInProgress}
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

      <RcloneLicenseModal
        isOpen={isRcloneLicenseModalOpen}
        onClose={() => setIsRcloneLicenseModalOpen(false)}
      />

      <RcloneProviderModal
        isOpen={isRcloneProviderModalOpen}
        currentProvider={rcloneProvider}
        onClose={() => setIsRcloneProviderModalOpen(false)}
        onGenerate={handleGenerateRcloneConfig}
        onTest={handleTestRcloneConfig}
        onApprove={handleApproveRcloneProvider}
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

function SummaryColumn({
  label,
  main,
  pending,
  notFound,
}: {
  label: string;
  main: number;
  pending: number;
  notFound: number;
}) {
  return (
    <div className="rounded-lg border border-[#e1e7ef] bg-[#f8fafd] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b849e]">{label}</p>
      <div className="mt-2 space-y-1 text-sm text-[#34485d]">
        <div className="flex items-center justify-between">
          <span>Main</span>
          <strong>{main}</strong>
        </div>
        <div className="flex items-center justify-between">
          <span>Pending</span>
          <strong>{pending}</strong>
        </div>
        <div className="flex items-center justify-between">
          <span>Not found</span>
          <strong>{notFound}</strong>
        </div>
      </div>
    </div>
  );
}
