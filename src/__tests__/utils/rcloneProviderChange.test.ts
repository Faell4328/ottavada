import { describe, expect, it } from "vitest";

import { shouldRunCloudBackupOnProviderChange } from "../../utils/rcloneProviderChange";

describe("shouldRunCloudBackupOnProviderChange", () => {
  it("returns false when the provider stays the same", () => {
    expect(shouldRunCloudBackupOnProviderChange("koofr", "koofr")).toBe(false);
  });

  it("returns true when the provider changes", () => {
    expect(shouldRunCloudBackupOnProviderChange("koofr", "google_drive")).toBe(true);
  });

  it("returns false when there is no previous provider", () => {
    expect(shouldRunCloudBackupOnProviderChange(null, "koofr")).toBe(false);
  });
});