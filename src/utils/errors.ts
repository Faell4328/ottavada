export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as Record<string, unknown>;
    const directMessage = candidate.message;
    if (typeof directMessage === "string" && directMessage.trim().length > 0) {
      return directMessage;
    }

    const directError = candidate.error;
    if (typeof directError === "string" && directError.trim().length > 0) {
      return directError;
    }

    const nestedCause = candidate.cause;
    if (nestedCause !== undefined) {
      const nestedMessage = getErrorMessage(nestedCause);
      if (nestedMessage !== "Erro desconhecido") {
        return nestedMessage;
      }
    }
  }

  return "Erro desconhecido";
}
