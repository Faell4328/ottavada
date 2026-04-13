import { getErrorMessage } from "./errors";

const FRIENDLY_MESSAGES: Array<{
  patterns: string[];
  message: string;
}> = [
  {
    patterns: ["invalid_grant", "authentication failed", "unauthorized", "401", "wrong password"],
    message:
      "Não consegui acessar sua conta. Confira o email e a senha de aplicativo e tente de novo.",
  },
  {
    patterns: ["not found", "remote not found", "couldn't find remote", "didn't find section in config file"],
    message:
      "Não encontrei a pasta da nuvem configurada. Gere a configuração novamente e tente outra vez.",
  },
  {
    patterns: ["permission denied", "forbidden", "403"],
    message:
      "Essa conta não tem acesso a esse local da nuvem. Verifique a permissão e tente novamente.",
  },
  {
    patterns: ["timeout", "no such host", "network is unreachable", "connection refused", "dial tcp"],
    message:
      "Não consegui falar com a nuvem. Verifique sua internet e tente novamente.",
  },
  {
    patterns: ["quota", "rate limit", "insufficient storage", "storage full"],
    message:
      "A conta da nuvem está sem espaço suficiente. Libere espaço e tente novamente.",
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