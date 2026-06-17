import { describe, it, expect, vi } from "vitest";

import {
  getScanFailureToastMessage,
  shouldRunStartupClientScan,
  shouldUseFullCloudSync,
} from "../../context/useAppScanFlow";
import { shouldDispatchRcloneProgressUpdate } from "../../utils/rcloneProgress";

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

describe("shouldRunStartupClientScan", () => {
  it("always skips the startup scan on the server", () => {
    expect(shouldRunStartupClientScan("Server")).toBe(false);
  });

  it("keeps the client startup scan enabled", () => {
    expect(shouldRunStartupClientScan("Client")).toBe(true);
  });
});

describe("getScanFailureToastMessage", () => {
  it("uses the client-specific fallback message", () => {
    const getErrorMessage = vi.fn((_error: unknown, fallback: string) => fallback);

    expect(getScanFailureToastMessage({}, getErrorMessage, "Client")).toBe(
      "Não foi possível consultar as alterações."
    );
    expect(getErrorMessage).toHaveBeenCalledWith(
      {},
      "Não foi possível consultar as alterações."
    );
  });

  it("keeps the server fallback for server scans", () => {
    const getErrorMessage = vi.fn((_error: unknown, fallback: string) => fallback);

    expect(getScanFailureToastMessage({}, getErrorMessage, "Server")).toBe(
      "Não foi possível concluir a verificação."
    );
    expect(getErrorMessage).toHaveBeenCalledWith(
      {},
      "Não foi possível concluir a verificação."
    );
  });
});

