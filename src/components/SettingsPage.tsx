import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import toast from "react-hot-toast";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import { ChangeComputerTypeModal } from "./ChangeComputerTypeModal";
import { ImportBackupModal } from "./ImportBackupModal";
import { RcloneProviderModal } from "./RcloneProviderModal.tsx";
import { RcloneLicenseModal } from "./RcloneLicenseModal";
import { UpdateModal } from "./UpdateModal";
import { OrganizationNameField } from "./OrganizationNameField";
import { SupportContactsCard } from "./SupportContactsCard";
import { formatBackupTimestamp } from "../utils/formatters";
import { shouldRunCloudBackupOnProviderChange } from "../utils/rcloneProviderChange";
import { runBackupImportFlow } from "../context/backupImportFlow";
import type {
  AppContacts,
  AppSettings,
  RcloneProvider,
  UpdateInfo,
} from "../types";
import { isClientComputer } from "../utils/computer";
import { getFriendlyRcloneErrorMessage } from "../utils/rcloneErrors";
import packageJson from "../../package.json";

function getRcloneProviderLabel(provider: RcloneProvider) {
  return provider === "koofr" ? "Koofr" : "Google Drive";
}

export default function SettingsPage() {
  const {
    state,
    dispatch,
    saveSettings,
    loadSettings,
    loadSongs,
    loadCategories,
    scanFilesForChanges,
    setOperationStatus,
    resetOperationStatus,
    runSyncWithProgress,
  } = useAppState();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isClient = isClientComputer(state.settings?.computer_type);
  const isSyncLocked =
    state.isScanningFiles ||
    state.rcloneProgress.active ||
    state.operationStatus.stepCurrent !== null;
  const [settings, setSettings] = useState<AppSettings>(
    state.settings ?? {
      computer_id: "",
      computer_name: null,
      organization_name: null,
      language: null,
      computer_type: "Server",
      google_drive_mode: "Local",
      first_run_completed: true,
      google_service_account: null,
      rclone_config: null,
      library_summary: null,
    },
  );
  const [isTogglingType, setIsTogglingType] = useState(false);
  const [isChangeComputerTypeModalOpen, setIsChangeComputerTypeModalOpen] =
    useState(false);
  const [isImportBackupModalOpen, setIsImportBackupModalOpen] = useState(false);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isImportingBackupCloud, setIsImportingBackupCloud] = useState(false);
  const [isGeneratingBackupCloud, setIsGeneratingBackupCloud] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(
    null,
  );
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [supportContacts, setSupportContacts] = useState<AppContacts>({
    email: null,
    phone: null,
  });
  const [rcloneProvider, setRcloneProvider] = useState<RcloneProvider>("koofr");
  const [rcloneConfigGenerated, setRcloneConfigGenerated] = useState(false);
  const [hasRcloneConfigChange, setHasRcloneConfigChange] = useState(false);
  const [isRcloneProviderModalOpen, setIsRcloneProviderModalOpen] =
    useState(false);
  const [isRcloneLicenseModalOpen, setIsRcloneLicenseModalOpen] =
    useState(false);
  const isMountedRef = useRef(true);

  const isSettingsOperationInProgress =
    isTogglingType ||
    isGeneratingSnapshot ||
    isExportingBackup ||
    isImportingBackup ||
    isImportingBackupCloud ||
    isGeneratingBackupCloud ||
    isCheckingUpdate ||
    isInstallingUpdate ||
    isSyncLocked;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void api
      .getAppContacts()
      .then(setSupportContacts)
      .catch(() => setSupportContacts({ email: null, phone: null }));
  }, []);

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
          ? t("settings.googleDriveConnected")
          : t("settings.koofrConnected"),
      );
    } catch (error) {
      toast.error(
        getFriendlyRcloneErrorMessage(
          error,
          t("settings.rcloneConfigError"),
        ),
      );
      throw error;
    }
  }

  async function handleTestRcloneConfig(provider: RcloneProvider) {
    try {
      await api.testRcloneUpload(provider);
      toast.success(
        provider === "google_drive"
          ? t("settings.googleDriveValidated")
          : t("settings.koofrValidated"),
      );
    } catch (error) {
      toast.error(
        getFriendlyRcloneErrorMessage(
          error,
          t("settings.rcloneTestError", {
            provider:
              provider === "google_drive" ? "Google Drive" : "Koofr",
          }),
        ),
      );
      throw error;
    }
  }

  async function handleApproveRcloneProvider(provider: RcloneProvider) {
    setRcloneProvider(provider);
    setRcloneConfigGenerated(true);
    setHasRcloneConfigChange(true);

    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
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
      const previousProvider = state.settings?.rclone_config?.provider ?? null;
      await saveSettings(updatedSettings);
      await loadSettings();

      if (updatedSettings.computer_type === "Server") {
        const snapshotCreated = await handleForceSnapshot(updatedSettings);
        if (!snapshotCreated) {
          throw new Error("SNAPSHOT_FAILED");
        }

        if (shouldRunCloudBackupOnProviderChange(previousProvider, provider)) {
          await handleGenerateBackupCloud(updatedSettings);
        }
      }

      setHasRcloneConfigChange(false);
    } catch (error) {
      toast.error(t("settings.providerChangeError"));
      throw error;
    }
  }

  function handleBackNavigation() {
    if (isSettingsOperationInProgress) {
      toast.error(t("settings.backBusy"));
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
      toast.success(
        result === "Server"
          ? t("settings.serverTypeToggled")
          : t("settings.clientTypeToggled"),
      );
      await loadSettings();
    } catch (err) {
      console.error("Failed to toggle computer type:", err);
      toast.error(t("settings.toggleError"));
    } finally {
      setIsTogglingType(false);
    }
  }

  async function handleSave() {
    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    if (
      settings.computer_type === "Server" &&
      !settings.organization_name?.trim()
    ) {
      toast.error(t("settings.organizationRequired"));
      return;
    }

    if (!rcloneConfigGenerated) {
      toast.error(t("settings.rcloneRequired"));
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
      toast.success(t("settings.settingsSaved"));

      const shouldForceSnapshot =
        updatedSettings.computer_type === "Server" &&
        (previousProvider !== rcloneProvider || hasRcloneConfigChange);

      if (shouldForceSnapshot) {
        const snapshotCreated = await handleForceSnapshot(updatedSettings);
        if (!snapshotCreated) {
          return;
        }
      }

      setHasRcloneConfigChange(false);

      navigate("/");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t("settings.settingsSaveError"));
    }
  }

  async function handleForceSnapshot(settingsOverride?: AppSettings) {
    const currentSettings = settingsOverride ?? state.settings ?? settings;

    if (currentSettings.computer_type !== "Server") {
      toast.error(t("settings.serverOnly"));
      return false;
    }

    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return false;
    }

    setIsGeneratingSnapshot(true);
    setOperationStatus({
      title: t("settings.snapshotStep1"),
      detail: t("settings.snapshotDetail"),
      stepCurrent: 1,
      stepTotal: 1,
    });
    navigate("/");
    const loadingToastId = toast.loading(t("settings.snapshotLoading"));
    try {
      const snapshotSummary = await api.generateSnapshotFile(true);
      await loadSettings();

      await scanFilesForChanges({ forceCloudSync: true, snapshotSummary });
      await Promise.all([loadSongs(), loadCategories()]);
      return true;
    } catch (error) {
      toast.error(t("settings.snapshotError"));
      return false;
    } finally {
      toast.dismiss(loadingToastId);
      resetOperationStatus();
      if (isMountedRef.current) {
        setIsGeneratingSnapshot(false);
      }
    }
  }

  async function handleExportBackup() {
    if (settings.computer_type !== "Server") {
      toast.error(t("settings.serverOnly"));
      return;
    }

    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    const selectedPath = await save({
      title: t("settings.exportBackupTitle"),
      defaultPath: "backup.msgpack",
      filters: [{ name: t("settings.exportBackupTitle"), extensions: ["msgpack"] }],
    });

    if (!selectedPath) {
      return;
    }

    setIsExportingBackup(true);
    setOperationStatus({
      title: t("settings.exportStep"),
      detail: t("settings.exportDetail"),
      stepCurrent: 1,
      stepTotal: 1,
    });
    try {
      const summary = await api.exportBackupFile(String(selectedPath));
      toast.success(
        t("settings.exportSuccess", { songs: summary.songs_count, scores: summary.scores_count }),
      );
    } catch (error) {
      toast.error(t("settings.exportError"));
    } finally {
      setIsExportingBackup(false);
      resetOperationStatus();
    }
  }

  async function handleImportBackup() {
    if (settings.computer_type !== "Server") {
      toast.error(t("settings.serverOnly"));
      return;
    }

    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    const selectedPath = await open({
      title: t("settings.importBackupTitle"),
      directory: false,
      multiple: false,
      filters: [{ name: t("settings.importBackupTitle"), extensions: ["msgpack"] }],
    });

    if (!selectedPath || Array.isArray(selectedPath)) {
      return;
    }

    setIsImportingBackup(true);
    setOperationStatus({
      title: t("settings.importStep"),
      detail: t("settings.importDetail"),
      stepCurrent: 1,
      stepTotal: 1,
    });
    navigate("/");
    const loadingToastId = toast.loading(t("settings.importLoading"));

    void (async () => {
      let refreshedSettings: AppSettings | null = null;
      try {
        const summary = await api.importBackupFile(selectedPath);
        toast.success(
          t("settings.importSuccess", { timestamp: formatBackupTimestamp(summary.generated_at) }),
          { duration: 8000 },
        );
        refreshedSettings = await api.getSettings();
        setSettings(refreshedSettings);
        await Promise.all([loadSettings(), loadSongs(), loadCategories()]);
        await handleForceSnapshot(refreshedSettings ?? undefined);
      } catch (error) {
        toast.error(t("settings.importError"));
      } finally {
        toast.dismiss(loadingToastId);
        setIsImportingBackup(false);
        resetOperationStatus();
      }
    })();
  }

  async function handleImportBackupCloud() {
    if (settings.computer_type !== "Server") {
      toast.error(t("settings.serverOnly"));
      return;
    }

    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    if (!settings.rclone_config) {
      toast.error(t("settings.importCloudRequired"));
      return;
    }

    setIsImportBackupModalOpen(true);
  }

  async function performImportBackupCloud() {
    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    if (!settings.rclone_config) {
      toast.error(t("settings.importCloudRequired"));
      return;
    }

    setIsImportingBackupCloud(true);
    navigate("/");
    const loadingToastId = toast.loading(t("settings.importCloudLoading"));

    void (async () => {
      try {
        await runBackupImportFlow({
          dispatch,
          runSyncWithProgress,
          loadSongs,
          loadCategories,
          loadSettings,
        });
        const refreshedSettings = await api.getSettings();
        setSettings(refreshedSettings);
      } catch (error) {
        toast.error(t("settings.importCloudError"));
      } finally {
        toast.dismiss(loadingToastId);
        setIsImportingBackupCloud(false);
      }
    })();
  }

  async function handleGenerateBackupCloud(settingsOverride?: AppSettings) {
    const currentSettings = settingsOverride ?? settings;

    if (currentSettings.computer_type !== "Server") {
      toast.error(t("settings.serverOnly"));
      return;
    }

    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    if (!currentSettings.rclone_config) {
      toast.error(t("settings.cloudRequiredForBackup"));
      return;
    }

    navigate("/");
    setIsGeneratingBackupCloud(true);
    setOperationStatus({
      title: t("settings.generateCloudStep"),
      detail: t("settings.generateCloudDetail"),
      stepCurrent: 1,
      stepTotal: 1,
    });
    try {
      const summary = await api.forceGenerateBackupCloudFile();
      await loadSettings();
      toast.success(
        t("settings.generateCloudSuccess", { timestamp: formatBackupTimestamp(summary.generated_at) }),
        {
          duration: 8000,
        },
      );
    } catch (error) {
      toast.error(t("settings.generateCloudError"));
    } finally {
      setIsGeneratingBackupCloud(false);
      resetOperationStatus();
    }
  }

  async function handleCheckUpdate() {
    if (isSyncLocked) {
      toast.error(t("settings.syncLocked"));
      return;
    }

    if (isCheckingUpdate || isInstallingUpdate) {
      return;
    }

    setIsCheckingUpdate(true);

    try {
      const result = await api.checkForUpdates();

      if (!result.configured) {
        toast.error(t("settings.updateNotConfigured"));
        return;
      }

      if (result.update) {
        setAvailableUpdate(result.update);
        setIsUpdateModalOpen(true);
        return;
      }

      toast.success(t("settings.upToDate"));
    } catch (error) {
      toast.error(t("settings.updateCheckFailed"));
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  async function handleInstallUpdate() {
    if (!availableUpdate || isInstallingUpdate) {
      return;
    }

    setIsInstallingUpdate(true);

    try {
      await api.installUpdate();
      setIsUpdateModalOpen(false);
      setAvailableUpdate(null);
      toast.success(t("settings.updateInstalled"));
    } catch (error) {
      toast.error(t("settings.updateInstallError"));
    } finally {
      setIsInstallingUpdate(false);
    }
  }

  const localeMap: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    de: "de-DE",
  };

  const lastSnapshotLabel = settings.last_snapshot_timestamp
    ? new Date(settings.last_snapshot_timestamp * 1000).toLocaleString(localeMap[i18next.language] || "en-US")
    : t("settings.neverGenerated");

  const lastBackupLabel = settings.last_backup_timestamp
    ? formatBackupTimestamp(settings.last_backup_timestamp)
    : t("settings.neverGenerated");

  const librarySummary = settings.library_summary;

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-[#edf1f6] via-[#f2f5fa] to-[#f8fafd] select-none">
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
        <h1 className="text-lg font-bold text-[#2f4259]">{t("settings.title")}</h1>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {isSettingsOperationInProgress && (
          <div className="mb-6 rounded-xl border border-[#b7d1f0] bg-[#eef6ff] px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-[#2f7fd1]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#21476c]">
                  {state.operationStatus.title || t("settings.processing")}
                </p>
                <p className="mt-1 text-xs text-[#5e7390]">
                  {state.operationStatus.detail ||
                    t("settings.waitFinish")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Computador */}
        <Section title={t("settings.computerSection")}>
          <p className="mb-1.5 block text-sm font-semibold text-[#34485d]">
            {t("settings.computerNameLabel")}
          </p>
          <input
            value={settings.computer_name ?? ""}
            onChange={(e) =>
              update({
                computer_name: e.target.value || null,
              })
            }
            disabled={isSyncLocked}
            className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
            placeholder={t("settings.computerNamePlaceholder")}
          />

          <OrganizationNameField
            computerType={settings.computer_type}
            value={settings.organization_name}
            disabled={isSyncLocked}
            onChange={(value) =>
              update({
                organization_name: value || null,
              })
            }
          />

          <br />

          <p className="mb-1.5 block text-sm font-semibold text-[#34485d]">
            {t("settings.computerTypeLabel")}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 rounded border border-[#c5cfdb] bg-[#f0f3f8] px-3 text-sm text-[#4d6075] flex items-center">
              {settings.computer_type === "Server"
                ? t("settings.serverType")
                : t("settings.clientType")}
            </div>
            <button
              type="button"
              onClick={handleComputerTypeChange}
              disabled={isTogglingType || isSyncLocked}
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isTogglingType ? t("settings.toggling") : t("settings.toggleButton")}
            </button>
          </div>
          <p className="text-xs text-[#8b9db2] mt-1">
            {settings.computer_type === "Server"
              ? t("settings.serverHint")
              : t("settings.clientHint")}
          </p>
        </Section>

        <Section title={t("settings.cloudSection")}>
          <div className="rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-4">
            <p className="mt-1 text-xs text-[#6b849e]">
              {t("settings.currentProvider")}{" "}
              <span className="font-semibold text-[#34485d]">
                {getRcloneProviderLabel(rcloneProvider)}
              </span>
            </p>
            <p className="mt-1 text-xs text-[#6b849e]">
              {t("settings.defaultRemote")}{" "}
              <span className="font-semibold text-[#34485d]">
                {rcloneProvider === "koofr" ? "koofr" : "gdrive"}
              </span>
            </p>
            <p className="mt-1 text-xs text-[#6b849e]">
              {t("settings.defaultPath")}{" "}
              <span className="font-semibold text-[#34485d]">Ottavada</span>
            </p>

            {rcloneConfigGenerated ? (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-semibold text-green-800">
                  {t("settings.configReady")}
                </p>
                <p className="mt-1 text-xs text-green-700">
                  {t("settings.configReadyDetail")}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs font-semibold text-yellow-800">
                  {t("settings.configPending")}
                </p>
                <p className="mt-1 text-xs text-yellow-700">
                  {t("settings.configPendingDetail")}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsRcloneProviderModalOpen(true)}
              disabled={isSettingsOperationInProgress}
              className="mt-4 h-9 rounded border border-[#4f84d7] bg-[#4f84d7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              {t("settings.changeProvider")}
            </button>
          </div>
        </Section>

        {/* Snapshot */}
        <div className="hidden" title="Snapshot">
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
              {isGeneratingSnapshot
                ? t("settings.generating")
                : t("settings.snapshotForced")}
            </button>
            <p className="text-xs text-[#8b9db2] mt-1">
              {t("settings.snapshotManualHint")}
            </p>
            <p className="text-xs text-[#8b9db2] mt-1">
              {t("settings.lastSnapshot")} {lastSnapshotLabel}
            </p>
          </div>
        </div>

        {/* Backup local */}
        <div className="hidden" title="Snapshot">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={
                isExportingBackup ||
                settings.computer_type !== "Server" ||
                isClient ||
                isSyncLocked
              }
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isExportingBackup ? t("settings.exporting") : t("settings.exportBackupButton")}
            </button>

            <button
              type="button"
              onClick={handleImportBackup}
              disabled={
                isImportingBackup ||
                settings.computer_type !== "Server" ||
                isClient ||
                isSyncLocked
              }
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isImportingBackup ? t("settings.importing") : t("settings.importBackupButton")}
            </button>
          </div>

          <p className="text-xs text-[#8b9db2] mt-1">
            {t("settings.backupLocalHint")}
          </p>
        </div>

        {/* Backup cloud */}
        <Section title={t("settings.cloudBackupSection")}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void handleGenerateBackupCloud();
              }}
              disabled={
                isGeneratingBackupCloud ||
                settings.computer_type !== "Server" ||
                !settings.rclone_config ||
                isSyncLocked ||
                isClient
              }
              className="h-9 px-4 rounded border border-[#c5cfdb] bg-white hover:bg-[#f2f5fa] text-sm font-medium text-[#344b61] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isGeneratingBackupCloud ? t("settings.generating") : t("settings.backupNow")}
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
              {isImportingBackupCloud ? t("settings.importingBackup") : t("settings.importBackup")}
            </button>
          </div>

          <p className="text-xs text-[#8b9db2] mt-1">
            {t("settings.backupHint")}
          </p>
        </Section>

        {/* Backup automático */}
        <Section title={t("settings.autoBackupSection")}>
          <p className="text-xs text-[#8b9db2] mt-1">
            {t("settings.autoBackupHint")}
          </p>
          <p className="text-xs text-[#8b9db2] mt-1">
            {t("settings.lastAutoBackup")} {lastBackupLabel}
          </p>
        </Section>

        {/* Sobre */}
        <Section title={t("settings.aboutSection")}>
          <div className="mb-3 rounded-xl border border-[#d8e0ea] bg-white/80 p-3 text-xs text-[#4f6887]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b849e]">
                  {t("settings.versionLabel")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#34485d]">
                  {packageJson.version}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleCheckUpdate();
                }}
                disabled={isSettingsOperationInProgress}
                className="h-9 rounded border border-[#4f84d7] bg-[#4f84d7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3d6fb8] disabled:opacity-50 cursor-pointer"
              >
                {isCheckingUpdate ? t("settings.checkingUpdate") : t("settings.checkUpdate")}
              </button>
            </div>
          </div>

          {librarySummary && (
            <div className="mb-3 rounded-xl border border-[#d8e0ea] bg-white/80 p-3 text-xs text-[#4f6887]">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryColumn
                  label={t("settings.songsLabel")}
                  main={librarySummary.main.songs_count}
                  draft={librarySummary.draft.songs_count}
                />
                <SummaryColumn
                  label={t("settings.scoresLabel")}
                  main={librarySummary.main.scores_count}
                  draft={librarySummary.draft.scores_count}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsRcloneLicenseModalOpen(true)}
            title={t("settings.licenseLinkTitle")}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#4f84d7] underline decoration-[#7ba0d4] underline-offset-2 transition-colors hover:text-[#3d6fb8] hover:decoration-[#3d6fb8] cursor-pointer"
          >
            <span>{t("settings.rcloneLicense")}</span>
          </button>
        </Section>

        <Section title={t("settings.supportSection")}>
          <SupportContactsCard email={supportContacts.email} />
        </Section>

        <Section title={t("settings.languageSection")}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => i18next.changeLanguage("pt")}
              className={`h-9 px-4 rounded border cursor-pointer text-sm font-medium transition-colors ${i18next.language === "pt" ? "border-[#4f84d7] bg-[#4f84d7] text-white" : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"}`}
            >
              Português
            </button>
            <button
              type="button"
              onClick={() => i18next.changeLanguage("en")}
              className={`h-9 px-4 rounded border cursor-pointer text-sm font-medium transition-colors ${i18next.language === "en" ? "border-[#4f84d7] bg-[#4f84d7] text-white" : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => i18next.changeLanguage("es")}
              className={`h-9 px-4 rounded border cursor-pointer text-sm font-medium transition-colors ${i18next.language === "es" ? "border-[#4f84d7] bg-[#4f84d7] text-white" : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"}`}
            >
              Español
            </button>
            <button
              type="button"
              onClick={() => i18next.changeLanguage("fr")}
              className={`h-9 px-4 rounded border cursor-pointer text-sm font-medium transition-colors ${i18next.language === "fr" ? "border-[#4f84d7] bg-[#4f84d7] text-white" : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"}`}
            >
              Français
            </button>
            <button
              type="button"
              onClick={() => i18next.changeLanguage("it")}
              className={`h-9 px-4 rounded border cursor-pointer text-sm font-medium transition-colors ${i18next.language === "it" ? "border-[#4f84d7] bg-[#4f84d7] text-white" : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"}`}
            >
              Italiano
            </button>
            <button
              type="button"
              onClick={() => i18next.changeLanguage("de")}
              className={`h-9 px-4 rounded border cursor-pointer text-sm font-medium transition-colors ${i18next.language === "de" ? "border-[#4f84d7] bg-[#4f84d7] text-white" : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"}`}
            >
              Deutsch
            </button>
          </div>
        </Section>

        {/* Save */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!rcloneConfigGenerated || isSettingsOperationInProgress}
            className="h-9 rounded bg-[#4f84d7] px-6 text-sm font-semibold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer border-0"
          >
            {t("settings.save")}
          </button>
        </div>

        {/* Footer */}
        {Math.round(Math.random() * 10) == 1 ? (
          <div className="mt-12 text-center text-xs text-[#8b9db2]">
            {t("settings.footerCoffee")}
          </div>
        ) : (
          <div className="mt-12 text-center text-xs text-[#8b9db2]">
            {t("settings.footerCredit")}
          </div>
        )}
      </div>

      {/* Change Computer Type Modal */}
      <ChangeComputerTypeModal
        isOpen={isChangeComputerTypeModalOpen}
        currentType={settings.computer_type as "Server" | "Client"}
        onClose={() => setIsChangeComputerTypeModalOpen(false)}
        onConfirm={handleConfirmComputerTypeChange}
      />

      <ImportBackupModal
        isOpen={isImportBackupModalOpen}
        onClose={() => setIsImportBackupModalOpen(false)}
        onConfirm={performImportBackupCloud}
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

      <UpdateModal
        isOpen={isUpdateModalOpen}
        update={availableUpdate}
        isInstalling={isInstallingUpdate}
        onCancel={() => setIsUpdateModalOpen(false)}
        onConfirm={() => {
          void handleInstallUpdate();
        }}
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

function SummaryColumn({
  label,
  main,
  draft,
}: {
  label: string;
  main: number;
  draft: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-[#e1e7ef] bg-[#f8fafd] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b849e]">
        {label}
      </p>
      <div className="mt-2 space-y-1 text-sm text-[#34485d]">
        <div className="flex items-center justify-between">
          <span>{t("scoreStatus.main")}</span>
          <strong>{main}</strong>
        </div>
        <div className="flex items-center justify-between">
          <span>{t("scoreStatus.draft")}</span>
          <strong>{draft}</strong>
        </div>
      </div>
    </div>
  );
}
