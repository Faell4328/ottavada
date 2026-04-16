import { describe, expect, it } from "vitest";

import {
  getUpdateActionBlockedMessage,
  isUpdateActionLocked,
} from "../../utils/updateLock";

describe("updateLock", () => {
  it("locks actions while the update modal is open", () => {
    expect(
      isUpdateActionLocked({
        isCheckingUpdate: false,
        isInstallingUpdate: false,
        isUpdateModalOpen: true,
      })
    ).toBe(true);
  });

  it("unlocks actions after postponing the update", () => {
    expect(
      isUpdateActionLocked({
        isCheckingUpdate: false,
        isInstallingUpdate: false,
        isUpdateModalOpen: false,
      })
    ).toBe(false);
  });

  it("returns a clear blocked message", () => {
    expect(getUpdateActionBlockedMessage()).toContain("atualização pendente");
  });
});