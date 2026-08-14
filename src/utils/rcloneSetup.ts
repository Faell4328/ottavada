import type { RcloneProvider, RcloneSetupInput } from "../types";

export interface RcloneFormValues {
  email: string;
  appPassword: string;
  host: string;
  port: string;
  username: string;
  password: string;
  url: string;
}

export const EMPTY_RCLONE_FORM: RcloneFormValues = {
  email: "",
  appPassword: "",
  host: "",
  port: "",
  username: "",
  password: "",
  url: "",
};

export function buildRcloneSetupInput(
  provider: RcloneProvider,
  values: RcloneFormValues,
): RcloneSetupInput {
  const setup: RcloneSetupInput = { provider };

  switch (provider) {
    case "koofr":
      setup.email = values.email.trim() || null;
      setup.appPassword = values.appPassword.trim() || null;
      break;
    case "sftp":
      setup.host = values.host.trim() || null;
      setup.port = values.port.trim() ? Number(values.port.trim()) : null;
      setup.username = values.username.trim() || null;
      setup.password = values.password;
      break;
    case "webdav":
      setup.url = values.url.trim() || null;
      setup.username = values.username.trim() || null;
      setup.password = values.password;
      break;
    default:
      break;
  }

  return setup;
}

export function isRcloneSetupValid(
  provider: RcloneProvider,
  values: RcloneFormValues,
): boolean {
  switch (provider) {
    case "koofr":
      return values.email.trim() !== "" && values.appPassword.trim() !== "";
    case "sftp":
      return (
        values.host.trim() !== "" &&
        values.username.trim() !== "" &&
        values.password !== ""
      );
    case "webdav":
      return (
        values.url.trim() !== "" &&
        values.username.trim() !== "" &&
        values.password !== ""
      );
    default:
      return true;
  }
}
