import { getErrorMessage } from "./errors";

const FRIENDLY_MESSAGES: Array<{
  patterns: string[];
  message: string;
}> = [
  {
    patterns: ["invalid_grant", "authentication failed", "unauthorized", "401", "wrong password"],
    message:
      "Suas credenciais parecem estar incorretas ou expiraram. Gere a configuração do rclone novamente e teste outra vez.",
  },
  {
    patterns: ["not found", "remote not found", "couldn't find remote", "didn't find section in config file"],
    message:
      "O remote do rclone não foi encontrado. Gere a configuração novamente e tente outra vez.",
  },
  {
    patterns: ["permission denied", "forbidden", "403"],
    message:
      "O rclone não conseguiu acesso a essa conta ou pasta. Verifique as permissões e tente novamente.",
  },
  {
    patterns: ["timeout", "no such host", "network is unreachable", "connection refused", "dial tcp"],
    message:
      "Não foi possível acessar a nuvem. Verifique a conexão com a internet e tente novamente.",
  },
  {
    patterns: ["quota", "rate limit", "insufficient storage", "storage full"],
    message:
      "A conta da nuvem atingiu um limite de uso. Libere espaço ou escolha outro destino.",
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