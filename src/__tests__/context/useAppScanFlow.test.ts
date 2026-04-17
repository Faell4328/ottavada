import { describe, it, expect } from "vitest";

import {
  shouldDispatchRcloneProgressUpdate,
  shouldUseFullCloudSync,
} from "../../context/useAppScanFlow";

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

describe("shouldDispatchRcloneProgressUpdate", () => {
  it("dispatches the first snapshot", () => {
    expect(
      shouldDispatchRcloneProgressUpdate(null, {
        active: true,
        direction: "upload",
        bytes: 1024,
        totalBytes: 10_000,
        percentage: 10,
        speedBytesPerSec: 1000,
        etaSeconds: 20,
      })
    ).toBe(true);
  });

  it("skips tiny changes that do not affect the UI meaningfully", () => {
    expect(
      shouldDispatchRcloneProgressUpdate(
        {
          active: true,
          direction: "upload",
          bytes: 100_000,
          totalBytes: 10_000,
          percentage: 10,
          speedBytesPerSec: 63_000,
          etaSeconds: 20,
        },
        {
          active: true,
          direction: "upload",
          bytes: 120_000,
          totalBytes: 10_000,
          percentage: 10.4,
          speedBytesPerSec: 63_500,
          etaSeconds: 20,
        }
      )
    ).toBe(false);
  });

  it("dispatches when visible progress changes", () => {
    expect(
      shouldDispatchRcloneProgressUpdate(
        {
          active: true,
          direction: "download",
          bytes: 1_000_000,
          totalBytes: 10_000_000,
          percentage: 10,
          speedBytesPerSec: 128_000,
          etaSeconds: 30,
        },
        {
          active: true,
          direction: "download",
          bytes: 1_500_000,
          totalBytes: 10_000_000,
          percentage: 15,
          speedBytesPerSec: 256_000,
          etaSeconds: 25,
        }
      )
    ).toBe(true);
  });
});