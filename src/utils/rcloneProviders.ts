import type { RcloneProvider } from "../types";

export type RcloneProviderGroup = "simple" | "browser" | "advanced";

export interface RcloneProviderInfo {
  key: RcloneProvider;
  label: string;
  remoteName: string;
  group: RcloneProviderGroup;
}

export const RCLONE_PROVIDERS: RcloneProviderInfo[] = [
  { key: "koofr", label: "Koofr", remoteName: "koofr", group: "simple" },
  { key: "google_drive", label: "Google Drive", remoteName: "gdrive", group: "browser" },
  { key: "dropbox", label: "Dropbox", remoteName: "dropbox", group: "browser" },
  { key: "onedrive", label: "OneDrive", remoteName: "onedrive", group: "browser" },
  { key: "pcloud", label: "pCloud", remoteName: "pcloud", group: "browser" },
  { key: "sftp", label: "SFTP", remoteName: "sftp", group: "advanced" },
  { key: "webdav", label: "WebDAV", remoteName: "webdav", group: "advanced" },
];

export const STANDARD_PROVIDERS = RCLONE_PROVIDERS.filter(
  (provider) => provider.group !== "advanced",
);

export const ADVANCED_PROVIDERS = RCLONE_PROVIDERS.filter(
  (provider) => provider.group === "advanced",
);

export function getProviderInfo(provider: RcloneProvider): RcloneProviderInfo {
  return RCLONE_PROVIDERS.find((item) => item.key === provider) ?? RCLONE_PROVIDERS[0];
}

export function getProviderLabel(provider: RcloneProvider): string {
  return getProviderInfo(provider).label;
}

export function getProviderRemoteName(provider: RcloneProvider): string {
  return getProviderInfo(provider).remoteName;
}
