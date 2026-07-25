import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
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
  const { t } = useTranslation();
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
        toast.error(t("firstRun.couldNotCreateId"));
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
        toast.error(t("firstRun.koofrEmailRequired"));
        return;
      }

      if (!rcloneAppPassword.trim()) {
        toast.error(t("firstRun.koofrPasswordRequired"));
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
          ? t("firstRun.googleDriveReady")
          : t("firstRun.koofrReady"),
      );
    } catch (error) {
      setRcloneConfigGenerated(false);
      setRcloneConfigured(false);
      toast.error(
        getFriendlyRcloneErrorMessage(
          error,
          t("firstRun.rcloneConfigError"),
        ),
      );
    } finally {
      setIsGeneratingRcloneConfig(false);
    }
  }

  function handleNameSubmit() {
    if (!computerName.trim()) {
      toast.error(t("firstRun.computerNameRequired"));
      return;
    }

    if (computerType === "Server" && !organizationName.trim()) {
      toast.error(t("firstRun.organizationRequired"));
      return;
    }

    setStep("rclone-setup");
  }

  function handleTypeSubmit() {
    if (!computerType) {
      toast.error(t("firstRun.computerTypeRequired"));
      return;
    }

    setStep("name");
  }

  async function handleWithRclone() {
    if (!rcloneConfigGenerated) {
      toast.error(
        t("firstRun.cloudRequired"),
      );
      return;
    }

    if (!rcloneConfigured) {
      toast.error(t("firstRun.testRequired"));
      return;
    }

    try {
      await api.deleteRcloneTestFile();
    } catch (error) {
      console.error("Erro ao deletar arquivo de teste local:", error);
      toast.error(t("firstRun.testDeleteError"));
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
      toast.error(t("firstRun.configError"));
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
              alt="Ottavada"
              loading="eager"
              fetchPriority="high"
              className="mb-3 h-30 w-30 rounded-2xl object-cover"
            />
          </div>
        )}

        {step === "intro" && (
          <>
            <div className="mb-6 rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#34485d]">
                  {t("firstRun.beforeStart")}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8b9db2]">
                    Idioma / Language
                  </span>
                  <button
                    type="button"
                    onClick={() => i18next.changeLanguage("pt")}
                    className={`h-8 w-10 rounded-lg border text-xs font-bold cursor-pointer transition-all ${i18next.language === "pt" ? "border-[#4f84d7] bg-[#4f84d7] text-white shadow-sm" : "border-[#c5cfdb] bg-white text-[#4d6075] hover:border-[#7ba0d4] hover:text-[#4f84d7]"}`}
                  >
                    PT
                  </button>
                  <button
                    type="button"
                    onClick={() => i18next.changeLanguage("en")}
                    className={`h-8 w-10 rounded-lg border text-xs font-bold cursor-pointer transition-all ${i18next.language === "en" ? "border-[#4f84d7] bg-[#4f84d7] text-white shadow-sm" : "border-[#c5cfdb] bg-white text-[#4d6075] hover:border-[#7ba0d4] hover:text-[#4f84d7]"}`}
                  >
                    EN
                  </button>
                </div>
              </div>
              <p className="text-sm leading-6 text-[#6b849e]">
                {t("firstRun.beforeStartText")}
              </p>
              <button
                type="button"
                onClick={handleOpenTutorial}
                className="mt-4 h-11 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-bold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
              >
                {t("firstRun.openTutorial")}
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
                {t("firstRun.videoNotSupported")}
              </video>
            </div>

            <button
              type="button"
              onClick={() => setStep("type")}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              {t("firstRun.advance")}
            </button>
          </>
        )}

        {step === "type" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d] text-center">
              {t("firstRun.computerTypeTitle")}
            </h2>

            <p className="mb-6 text-sm text-[#6b849e] text-center">
              {t("firstRun.computerTypeHint")}
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
                    {t("firstRun.serverType")}
                  </h3>
                  <p className="text-xs text-[#6b849e]">
                    {t("firstRun.serverTypeDesc")}
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
                    {t("firstRun.clientType")}
                  </h3>
                  <p className="text-xs text-[#6b849e]">
                    {t("firstRun.clientTypeDesc")}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTypeSubmit}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              {t("firstRun.next")}
            </button>
          </>
        )}

        {step === "name" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d] text-center">
              {t("firstRun.configureComputer")}
            </h2>

            <p className="mb-6 text-sm text-[#6b849e] text-center">
              {t("firstRun.configureHint")}
            </p>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
                {t("firstRun.computerName")}
              </label>
              <input
                value={computerName}
                onChange={(e) => setComputerName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("firstRun.computerNamePlaceholder")}
              />
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
                {t("firstRun.organizationName")}
              </label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("firstRun.organizationNamePlaceholder")}
              />
            </div>

            <button
              type="button"
              onClick={handleNameSubmit}
              className="h-11 w-full rounded-lg border-0 bg-[#4f84d7] text-sm font-bold text-white transition-colors hover:bg-[#3d6fb8] cursor-pointer"
            >
              {t("firstRun.next")}
            </button>

            <button
              type="button"
              onClick={() => setStep("type")}
              className="mt-2 h-10 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
            >
              {t("firstRun.back")}
            </button>
          </>
        )}

        {step === "rclone-setup" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-[#34485d] text-center">
              {t("firstRun.chooseCloudProvider")}
            </h2>

            <p className="w-4/5 mx-auto mb-6 text-sm text-[#6b849e] text-center">
              <b>{t("firstRun.cloudImportant")} </b>
              <span>
                {t("firstRun.cloudImportantText")}
              </span>
            </p>

            <div className="mb-4 rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-4">
              <div className="mb-3 pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9db2]">
                  {t("firstRun.cloudProviderLabel")}
                </p>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                  {t("firstRun.recommended")}
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
                    ? t("firstRun.googleDriveHint")
                    : t("firstRun.koofrHint")}
                </p>
              </div>
              {rcloneProvider === "koofr" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-[#34485d]">
                      {t("firstRun.koofrEmail")}
                    </label>
                    <input
                      value={rcloneEmail}
                      onChange={(e) => setRcloneEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                      placeholder={t("firstRun.koofrEmailPlaceholder")}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-[#34485d]">
                      {t("firstRun.koofrAppPassword")}
                    </label>
                    <input
                      type="password"
                      value={rcloneAppPassword}
                      onChange={(e) => setRcloneAppPassword(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                      placeholder={t("firstRun.koofrAppPasswordPlaceholder")}
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
                ? t("firstRun.configuring")
                : rcloneProvider === "google_drive"
                  ? t("firstRun.configureTestGoogleDrive")
                  : t("firstRun.configureTestKoofr")}
            </button>

            {rcloneConfigured && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">
                      {t("firstRun.rcloneConfigured")}
                    </p>
                    <p className="mt-1 text-xs text-green-700">
                      {t("firstRun.remoteDefault")}{" "}
                      <code className="bg-green-100 px-1">
                        {rcloneProvider === "koofr" ? "koofr" : "gdrive"}
                      </code>
                    </p>
                    <p className="text-xs text-green-700">
                      {t("firstRun.pathDefault")}{" "}
                      <code className="bg-green-100 px-1">Ottavada</code>
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
                {t("firstRun.continue")}
              </button>

              <button
                type="button"
                onClick={() => setStep("type")}
                className="h-10 flex-1 rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
              >
                {t("firstRun.back")}
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <h2 className="mb-6 text-lg font-semibold text-[#34485d]">
              {t("firstRun.confirmTitle")}
            </h2>

            <div className="mb-6 space-y-4">
              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  {t("firstRun.confirmComputerName")}
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerName || t("firstRun.notFilled")}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  {t("firstRun.confirmOrganizationName")}
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {organizationName || t("firstRun.notFilled")}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  {t("firstRun.confirmComputerType")}
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  {computerType === "Server"
                    ? t("firstRun.serverType")
                    : t("firstRun.clientType")}
                </p>
              </div>

              <div className="rounded-lg border border-[#c5cfdb] bg-[#f8fafd] p-4">
                <p className="mb-1 text-xs text-[#8b9db2]">
                  {t("firstRun.confirmSyncMode")}
                </p>
                <p className="text-sm font-semibold text-[#34485d]">
                  <span className="text-green-600">{t("firstRun.confirmSyncModeValue")}</span>
                  <span className="text-xs text-[#6b849e]">
                    {" "}
                    ({rcloneProvider === "koofr" ? "koofr" : "gdrive"}
                    :ottavada)
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
              {isLoading ? t("firstRun.configuring") : t("firstRun.startUsing")}
            </button>

            <button
              type="button"
              onClick={() => setStep("rclone-setup")}
              disabled={isLoading}
              className="mt-2 h-10 w-full rounded-lg border border-[#7ba0d4] bg-white text-sm font-semibold text-[#4f84d7] transition-colors hover:bg-[#f8fafd] cursor-pointer"
            >
              {t("firstRun.back")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
