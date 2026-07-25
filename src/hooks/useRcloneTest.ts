import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import * as api from "../api/commands";
import { getFriendlyRcloneErrorMessage } from "../utils/rcloneErrors";
import type { RcloneProvider } from "../types";

interface UseRcloneTestParams {
  provider: RcloneProvider;
  onSuccess?: () => void;
  onFailure?: () => void;
}

interface TestRcloneOptions {
  silent?: boolean;
}

export function useRcloneTest({
  provider,
  onSuccess,
  onFailure,
}: UseRcloneTestParams) {
  const { t } = useTranslation();
  const [isTestingRclone, setIsTestingRclone] = useState(false);

  const testRclone = useCallback(async (options: TestRcloneOptions = {}) => {
    setIsTestingRclone(true);
    try {
      await api.testRcloneUpload(provider);
      if (!options.silent) {
        toast.success(t("rcloneTest.connectionTested"));
      }
      onSuccess?.();
      return true;
    } catch (error) {
      const providerLabel = provider === "google_drive" ? t("rcloneTest.googleDrive") : t("rcloneTest.koofr");
      toast.error(
        getFriendlyRcloneErrorMessage(error, t("rcloneTest.testFailed", { provider: providerLabel }))
      );
      onFailure?.();
      return false;
    } finally {
      setIsTestingRclone(false);
    }
  }, [onFailure, onSuccess, provider]);

  return {
    isTestingRclone,
    testRclone,
  };
}
