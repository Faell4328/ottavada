import type { RcloneProvider } from "../types";

export function shouldRunCloudBackupOnProviderChange(
  previousProvider: RcloneProvider | null,
  nextProvider: RcloneProvider
) {
  return previousProvider !== null && previousProvider !== nextProvider;
}