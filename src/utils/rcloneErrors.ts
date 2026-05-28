import { getErrorMessage } from "./errors";

const FRIENDLY_MESSAGES: Array<{
  patterns: string[];
  message: string;
}> = [
  {
    patterns: ["invalid_grant", "authentication failed", "unauthorized", "401", "wrong password"],
    message:
      "Não foi possível acessar sua conta. Verifique o email e a senha de aplicativo.",
  },
  {
    patterns: ["not found", "remote not found", "couldn't find remote", "didn't find section in config file"],
    message:
      "Não foi possível localizar a pasta da nuvem configurada. Gere a configuração novamente.",
  },
  {
    patterns: ["permission denied", "forbidden", "403"],
    message:
      "Não foi possível acessar esse local da nuvem. Verifique as permissões.",
  },
  {
    patterns: ["timeout", "no such host", "network is unreachable", "connection refused", "dial tcp"],
    message:
      "Não foi possível falar com a nuvem. Verifique sua internet.",
  },
  {
    patterns: ["quota", "rate limit", "insufficient storage", "storage full"],
    message:
      "Não foi possível concluir a operação. Libere espaço na conta da nuvem e tente novamente.",
  },
];

function normalizeMessage(value: string) {
  return value.toLowerCase();
}

export function getFriendlyRcloneErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error);
  const normalizedMessage = normalizeMessage(message);

  for (const entry of FRIENDLY_MESSAGES) {
    if (entry.patterns.some((pattern) => normalizedMessage.includes(pattern))) {
      return entry.message;
    }
  }

  return fallback;
}