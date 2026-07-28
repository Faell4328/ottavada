import { getErrorMessage } from "./errors";
import i18n from "../i18n";

const FRIENDLY_MESSAGE_KEYS: Array<{
  patterns: string[];
  i18nKey: string;
}> = [
  {
    patterns: ["invalid_grant", "authentication failed", "unauthorized", "401", "wrong password"],
    i18nKey: "rcloneErrors.authFailed",
  },
  {
    patterns: ["not found", "remote not found", "couldn't find remote", "didn't find section in config file"],
    i18nKey: "rcloneErrors.remoteNotFound",
  },
  {
    patterns: ["permission denied", "forbidden", "403"],
    i18nKey: "rcloneErrors.permissionDenied",
  },
  {
    patterns: ["timeout", "no such host", "network is unreachable", "connection refused", "dial tcp"],
    i18nKey: "rcloneErrors.networkError",
  },
  {
    patterns: ["quota", "rate limit", "insufficient storage", "storage full"],
    i18nKey: "rcloneErrors.quotaExceeded",
  },
];

function normalizeMessage(value: string) {
  return value.toLowerCase();
}

export function getFriendlyRcloneErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error);
  const normalizedMessage = normalizeMessage(message);

  for (const entry of FRIENDLY_MESSAGE_KEYS) {
    if (entry.patterns.some((pattern) => normalizedMessage.includes(pattern))) {
      return i18n.t(entry.i18nKey);
    }
  }

  return fallback;
}