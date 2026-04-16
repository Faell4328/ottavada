import type { UpdateCheckResult, UpdateInfo } from "../types";

export type StartupUpdateStatus = "checking" | "ready" | "update-available";

export interface StartupUpdateState {
  status: StartupUpdateStatus;
  update: UpdateInfo | null;
}

export const initialStartupUpdateState: StartupUpdateState = {
  status: "checking",
  update: null,
};

export function resolveStartupUpdateState(result: UpdateCheckResult): StartupUpdateState {
  if (!result.configured || !result.update) {
    return {
      status: "ready",
      update: null,
    };
  }

  return {
    status: "update-available",
    update: result.update,
  };
}
