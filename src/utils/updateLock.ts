export interface UpdateLockState {
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  isUpdateModalOpen: boolean;
}

export function isUpdateActionLocked(state: UpdateLockState) {
  return state.isCheckingUpdate || state.isInstallingUpdate || state.isUpdateModalOpen;
}

export function getUpdateActionBlockedMessage() {
  return "Há uma atualização pendente. Adie ou atualize antes de continuar.";
}