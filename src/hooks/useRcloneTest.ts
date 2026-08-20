import { useCallback, useState } from "react";
import toast from "../utils/toast";
import i18n from "../i18n";

import * as api from "../api/commands";
import { getFriendlyRcloneErrorMessage } from "../utils/rcloneErrors";
import { getProviderLabel } from "../utils/rcloneProviders";
import type { RcloneProvider } from "../types";

interface UseRcloneTestParams {
  provider: RcloneProvider;
  onSuccess?: () => void;
  onFailure?: () => void;
}

interface TestRcloneOptions {
  silent?: boolean;
}

const t = i18n.t.bind(i18n);

export function useRcloneTest({
  provider,
  onSuccess,
  onFailure,
}: UseRcloneTestParams) {
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
      const providerLabel = getProviderLabel(provider);
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
