import * as api from "../api/commands";

interface RunOperationWithProgressParams {
  operation: () => Promise<unknown>;
  onSnapshot: (snapshot: api.OperationProgressSnapshot) => void;
}

export async function runOperationWithProgress({
  operation,
  onSnapshot,
}: RunOperationWithProgressParams): Promise<unknown> {
  let stopPolling = false;

  const operationPromise = operation();

  const pollingPromise = (async () => {
    while (!stopPolling) {
      try {
        const snapshot = await api.getOperationProgress();
        if (snapshot.active) {
          onSnapshot(snapshot);
        }
      } catch {
        // Ignore transient progress polling errors.
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  })();

  try {
    return await operationPromise;
  } finally {
    stopPolling = true;
    void pollingPromise.catch(() => undefined);
  }
}