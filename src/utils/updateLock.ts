import i18n from "../i18n";

export interface UpdateLockState {
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  isUpdateModalOpen: boolean;
}

export function isUpdateActionLocked(state: UpdateLockState) {
  return state.isCheckingUpdate || state.isInstallingUpdate || state.isUpdateModalOpen;
}

export function getUpdateActionBlockedMessage() {
  return i18n.t("updateLock.pendingUpdate");
}