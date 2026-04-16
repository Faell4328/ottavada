import { describe, expect, it } from "vitest";

import { initialStartupUpdateState, resolveStartupUpdateState } from "../../utils/startupUpdate";

describe("startupUpdate", () => {
  it("starts in checking state", () => {
    expect(initialStartupUpdateState).toEqual({
      status: "checking",
      update: null,
    });
  });

  it("allows the app to continue when no update is available", () => {
    expect(
      resolveStartupUpdateState({
        configured: true,
        update: null,
      })
    ).toEqual({
      status: "ready",
      update: null,
    });
  });

  it("blocks startup when an update is available", () => {
    expect(
      resolveStartupUpdateState({
        configured: true,
        update: {
          current_version: "0.13.3",
          version: "0.13.4",
          date: null,
          body: null,
        },
      })
    ).toEqual({
      status: "update-available",
      update: {
        current_version: "0.13.3",
        version: "0.13.4",
        date: null,
        body: null,
      },
    });
  });
});
