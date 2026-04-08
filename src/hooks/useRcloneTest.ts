import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import { getErrorMessage } from "../utils/errors";
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
      toast.error(`Erro ao testar rclone: ${getErrorMessage(error)}`);
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
