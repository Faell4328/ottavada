import { describe, expect, it } from "vitest";

import {
  ADVANCED_PROVIDERS,
  STANDARD_PROVIDERS,
  getProviderLabel,
  getProviderRemoteName,
  isAdvancedProvider,
  usesBrowserAuth,
} from "../../utils/rcloneProviders";

describe("rcloneProviders", () => {
  it("maps labels for every provider", () => {
    expect(getProviderLabel("koofr")).toBe("Koofr");
    expect(getProviderLabel("google_drive")).toBe("Google Drive");
    expect(getProviderLabel("dropbox")).toBe("Dropbox");
    expect(getProviderLabel("onedrive")).toBe("OneDrive");
    expect(getProviderLabel("pcloud")).toBe("pCloud");
    expect(getProviderLabel("sftp")).toBe("SFTP");
    expect(getProviderLabel("webdav")).toBe("WebDAV");
  });

  it("maps remote names for every provider", () => {
    expect(getProviderRemoteName("koofr")).toBe("koofr");
    expect(getProviderRemoteName("google_drive")).toBe("gdrive");
    expect(getProviderRemoteName("dropbox")).toBe("dropbox");
    expect(getProviderRemoteName("onedrive")).toBe("onedrive");
    expect(getProviderRemoteName("pcloud")).toBe("pcloud");
    expect(getProviderRemoteName("sftp")).toBe("sftp");
    expect(getProviderRemoteName("webdav")).toBe("webdav");
  });

  it("separates standard from advanced providers", () => {
    const standardKeys = STANDARD_PROVIDERS.map((p) => p.key);
    const advancedKeys = ADVANCED_PROVIDERS.map((p) => p.key);

    expect(standardKeys).toContain("koofr");
    expect(standardKeys).toContain("dropbox");
    expect(standardKeys).toContain("onedrive");
    expect(standardKeys).toContain("pcloud");
    expect(advancedKeys).toEqual(["sftp", "webdav"]);
    expect(advancedKeys).not.toContain("koofr");
  });

  it("detects advanced providers", () => {
    expect(isAdvancedProvider("sftp")).toBe(true);
    expect(isAdvancedProvider("webdav")).toBe(true);
    expect(isAdvancedProvider("dropbox")).toBe(false);
    expect(isAdvancedProvider("koofr")).toBe(false);
  });

  it("detects browser auth providers", () => {
    expect(usesBrowserAuth("google_drive")).toBe(true);
    expect(usesBrowserAuth("dropbox")).toBe(true);
    expect(usesBrowserAuth("onedrive")).toBe(true);
    expect(usesBrowserAuth("pcloud")).toBe(true);
    expect(usesBrowserAuth("koofr")).toBe(false);
    expect(usesBrowserAuth("sftp")).toBe(false);
  });
});
