import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import { getErrorMessage } from "../utils/errors";

interface UseRcloneTestParams {
  remote: string;
  path: string;
  onSuccess?: () => void;
  onFailure?: () => void;
}

export function useRcloneTest({
  remote,
  path,
  onSuccess,
  onFailure,
}: UseRcloneTestParams) {
  const [isTestingRclone, setIsTestingRclone] = useState(false);

  const testRclone = useCallback(async () => {
    if (!remote.trim()) {
      toast.error("Especifique o nome do remote do rclone");
      return false;
    }

    setIsTestingRclone(true);
    try {
      await api.testRcloneUpload(remote, path);
      toast.success("Teste realizado com sucesso! Arquivo enviado para o rclone.");
      onSuccess?.();
      return true;
    } catch (error) {
      toast.error(`Erro ao testar rclone: ${getErrorMessage(error)}`);
      onFailure?.();
      return false;
    } finally {
      setIsTestingRclone(false);
    }
  }, [onFailure, onSuccess, path, remote]);

  return {
    isTestingRclone,
    testRclone,
  };
}
