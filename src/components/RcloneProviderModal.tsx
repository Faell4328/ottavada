import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import type { RcloneProvider, RcloneSetupInput } from "../types";
import {
  ADVANCED_PROVIDERS,
  STANDARD_PROVIDERS,
  getProviderLabel,
} from "../utils/rcloneProviders";
import {
  buildRcloneSetupInput,
  isRcloneSetupValid,
} from "../utils/rcloneSetup";
import { Modal } from "./ui/Modal";

interface RcloneProviderModalProps {
  isOpen: boolean;
  currentProvider: RcloneProvider;
  onClose: () => void;
  onGenerate: (setup: RcloneSetupInput) => Promise<void>;
  onTest: (provider: RcloneProvider) => Promise<void>;
  onApprove: (provider: RcloneProvider) => Promise<void>;
}

function getPrimaryActionLabel(
  provider: RcloneProvider,
  currentProvider: RcloneProvider,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const label = getProviderLabel(provider);
  return provider === currentProvider
    ? t("rcloneProviderModal.updateTest", { provider: label })
    : t("rcloneProviderModal.switchTest", { provider: label });
}

function requiresCredentials(provider: RcloneProvider) {
  return provider === "koofr" || provider === "sftp" || provider === "webdav";
}

export function RcloneProviderModal({
  isOpen,
  currentProvider,
  onClose,
  onGenerate,
  onTest,
  onApprove,
}: RcloneProviderModalProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<RcloneProvider>(currentProvider);
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedProvider(currentProvider);
    setEmail("");
    setAppPassword("");
    setHost("");
    setPort("");
    setUsername("");
    setPassword("");
    setUrl("");
    setIsSubmitting(false);
  }, [currentProvider, isOpen]);

  async function handleSubmit() {
    const values = { email, appPassword, host, port, username, password, url };
    if (!isRcloneSetupValid(selectedProvider, values)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onGenerate(buildRcloneSetupInput(selectedProvider, values));
      await onTest(selectedProvider);
      await onApprove(selectedProvider);
      onClose();
    } catch {
      // The error is already handled in the parent component; the modal just stays open.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("rcloneProviderModal.title")}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded border border-[#c5cfdb] bg-white px-4 py-2 text-sm font-medium text-[#344b61] transition-colors hover:bg-[#f2f5fa]"
            disabled={isSubmitting}
          >
            {t("rcloneProviderModal.close")}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            className="flex-1 rounded bg-[#4f84d7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              isSubmitting ||
              !isRcloneSetupValid(selectedProvider, {
                email,
                appPassword,
                host,
                port,
                username,
                password,
                url,
              })
            }
          >
            {isSubmitting
              ? t("rcloneProviderModal.testing")
              : getPrimaryActionLabel(selectedProvider, currentProvider, t)}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {STANDARD_PROVIDERS.map((provider) => {
            const isSelected = selectedProvider === provider.key;
            const isCurrent = currentProvider === provider.key;
            return (
              <button
                key={provider.key}
                type="button"
                onClick={() => setSelectedProvider(provider.key)}
                className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[#4f84d7] bg-white"
                    : "border-[#c5cfdb] bg-white/70 hover:border-[#7ba0d4]"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  {isCurrent ? (
                    <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                      {t("rcloneProviderModal.current")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#eef3f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b849e]">
                      {t("rcloneProviderModal.alternative")}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#34485d]">{provider.label}</p>
                <p className="mt-1 text-xs text-[#6b849e]">
                  {provider.key === "koofr"
                    ? t("rcloneProviderModal.koofrHint")
                    : t("rcloneProviderModal.browserAuth")}
                </p>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#c5cfdb] bg-[#f8fafd] p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9db2]">
            {t("rcloneProviderModal.advancedSection")}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {ADVANCED_PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.key;
              const isCurrent = currentProvider === provider.key;
              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => setSelectedProvider(provider.key)}
                  className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "border-[#4f84d7] bg-white"
                      : "border-[#c5cfdb] bg-white/70 hover:border-[#7ba0d4]"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {isCurrent ? (
                      <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4f84d7]">
                        {t("rcloneProviderModal.current")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#eef3f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b849e]">
                        {t("rcloneProviderModal.alternative")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#34485d]">{provider.label}</p>
                  <p className="mt-1 text-xs text-[#6b849e]">
                    {t(
                      provider.key === "sftp"
                        ? "rcloneProviderModal.sftpHint"
                        : "rcloneProviderModal.webdavHint",
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {selectedProvider === "koofr" && (
          <div className="space-y-3 rounded-xl border border-[#c5cfdb] bg-white p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.emailLabel")}
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.emailPlaceholder")}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.appPasswordLabel")}
              </label>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.appPasswordPlaceholder")}
              />
            </div>
          </div>
        )}

        {selectedProvider === "sftp" && (
          <div className="space-y-3 rounded-xl border border-[#c5cfdb] bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                  {t("rcloneProviderModal.hostLabel")}
                </label>
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                  placeholder={t("rcloneProviderModal.hostPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                  {t("rcloneProviderModal.portLabel")}
                </label>
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                  placeholder={t("rcloneProviderModal.portPlaceholder")}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.usernameLabel")}
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.usernamePlaceholder")}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.passwordLabel")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.passwordPlaceholder")}
              />
            </div>
          </div>
        )}

        {selectedProvider === "webdav" && (
          <div className="space-y-3 rounded-xl border border-[#c5cfdb] bg-white p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.urlLabel")}
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.urlPlaceholder")}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.usernameLabel")}
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.usernamePlaceholder")}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#34485d]">
                {t("rcloneProviderModal.passwordLabel")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#c5cfdb] bg-[#f8fafd] px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4] focus:ring-2 focus:ring-[#7ba0d4]/20"
                placeholder={t("rcloneProviderModal.passwordPlaceholder")}
              />
            </div>
          </div>
        )}

        {!requiresCredentials(selectedProvider) && (
          <div className="rounded-xl border border-[#c5cfdb] bg-white p-4">
            <p className="text-sm font-semibold text-[#34485d]">
              {getProviderLabel(selectedProvider)}
            </p>
            <p className="mt-1 text-xs text-[#6b849e]">
              {t("rcloneProviderModal.browserAuth")}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
