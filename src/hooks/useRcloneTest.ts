import { useCallback, useState } from "react";
import toast from "react-hot-toast";

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
  const [isTestingRclone, setIsTestingRclone] = useState(false);

  const testRclone = useCallback(async (options: TestRcloneOptions = {}) => {
    setIsTestingRclone(true);
    try {
      await api.testRcloneUpload(provider);
      if (!options.silent) {
        toast.success("Teste realizado com sucesso! Arquivo enviado para o rclone.");
      }
      onSuccess?.();
      return true;
    } catch (error) {
      const providerLabel = provider === "google_drive" ? "Google Drive" : "Koofr";
      toast.error(
        getFriendlyRcloneErrorMessage(error, `Falha ao testar o ${providerLabel}`)
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
