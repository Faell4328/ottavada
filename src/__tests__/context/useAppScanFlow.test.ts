import { describe, it, expect } from "vitest";

import { shouldUseFullCloudSync } from "../../context/useAppScanFlow";

describe("shouldUseFullCloudSync", () => {
  it("forces a full sync when requested manually", () => {
    expect(
      shouldUseFullCloudSync({
        forceCloudSync: true,
        snapshotGenerated: false,
        eventsCount: 12,
        hasPendingChanges: true,
        hasDetectedFileChanges: true,
      })
    ).toBe(true);
  });

  it("keeps the previous full sync rules when not forced", () => {
    expect(
      shouldUseFullCloudSync({
        forceCloudSync: false,
        snapshotGenerated: false,
        eventsCount: 3,
        hasPendingChanges: true,
        hasDetectedFileChanges: true,
      })
    ).toBe(false);
  });

  it("uses full sync when there are no events", () => {
    expect(
      shouldUseFullCloudSync({
        forceCloudSync: false,
        snapshotGenerated: false,
        eventsCount: 0,
        hasPendingChanges: false,
        hasDetectedFileChanges: false,
      })
    ).toBe(true);
  });
});