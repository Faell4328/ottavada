import { describe, expect, it } from "vitest";

import {
  EMPTY_RCLONE_FORM,
  buildRcloneSetupInput,
  isRcloneSetupValid,
} from "../../utils/rcloneSetup";

describe("isRcloneSetupValid", () => {
  it("requires email and app password for Koofr", () => {
    expect(
      isRcloneSetupValid("koofr", {
        ...EMPTY_RCLONE_FORM,
        email: "",
        appPassword: "",
      }),
    ).toBe(false);
    expect(
      isRcloneSetupValid("koofr", {
        ...EMPTY_RCLONE_FORM,
        email: "a@b.com",
        appPassword: "secret",
      }),
    ).toBe(true);
  });

  it("requires host, user and password for SFTP", () => {
    expect(
      isRcloneSetupValid("sftp", {
        ...EMPTY_RCLONE_FORM,
        host: "",
        username: "u",
        password: "p",
      }),
    ).toBe(false);
    expect(
      isRcloneSetupValid("sftp", {
        ...EMPTY_RCLONE_FORM,
        host: "sftp.example.com",
        username: "u",
        password: "p",
      }),
    ).toBe(true);
  });

  it("requires url, user and password for WebDAV", () => {
    expect(
      isRcloneSetupValid("webdav", {
        ...EMPTY_RCLONE_FORM,
        url: "",
        username: "u",
        password: "p",
      }),
    ).toBe(false);
    expect(
      isRcloneSetupValid("webdav", {
        ...EMPTY_RCLONE_FORM,
        url: "https://dav.example.com/",
        username: "u",
        password: "p",
      }),
    ).toBe(true);
  });

  it("accepts browser-auth providers without credentials", () => {
    expect(isRcloneSetupValid("dropbox", EMPTY_RCLONE_FORM)).toBe(true);
    expect(isRcloneSetupValid("google_drive", EMPTY_RCLONE_FORM)).toBe(true);
  });
});

describe("buildRcloneSetupInput", () => {
  it("builds the Koofr setup with email and app password", () => {
    expect(
      buildRcloneSetupInput("koofr", {
        ...EMPTY_RCLONE_FORM,
        email: " a@b.com ",
        appPassword: " secret ",
      }),
    ).toEqual({
      provider: "koofr",
      email: "a@b.com",
      appPassword: "secret",
    });
  });

  it("builds the SFTP setup with host, port, user and password", () => {
    expect(
      buildRcloneSetupInput("sftp", {
        ...EMPTY_RCLONE_FORM,
        host: " sftp.example.com ",
        port: "2222",
        username: " user ",
        password: "secret",
      }),
    ).toEqual({
      provider: "sftp",
      host: "sftp.example.com",
      port: 2222,
      username: "user",
      password: "secret",
    });
  });

  it("builds the WebDAV setup with url, user and password", () => {
    expect(
      buildRcloneSetupInput("webdav", {
        ...EMPTY_RCLONE_FORM,
        url: " https://dav.example.com/ ",
        username: " user ",
        password: "secret",
      }),
    ).toEqual({
      provider: "webdav",
      url: "https://dav.example.com/",
      username: "user",
      password: "secret",
    });
  });

  it("builds browser-auth setups with only the provider", () => {
    expect(buildRcloneSetupInput("dropbox", EMPTY_RCLONE_FORM)).toEqual({
      provider: "dropbox",
    });
  });
});
