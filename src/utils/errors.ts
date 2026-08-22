import i18n from "../i18n";

const SCORE_TARGET_FILE_EXISTS_PREFIX = "score_target_file_exists:";

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
      const fallback = i18n.t("errors.unknown");
      if (nestedMessage !== fallback) {
        return nestedMessage;
      }
    }
  }

  return i18n.t("errors.unknown");
}

export function getScoreUseAsBaseError(rawError: string): string {
  if (rawError === "score_duplicate_instrument") {
    return i18n.t("useAsBaseScoreModal.nameConflictError");
  }

  if (rawError.startsWith(SCORE_TARGET_FILE_EXISTS_PREFIX)) {
    return i18n.t("useAsBaseScoreModal.fileExistsError", {
      fileName: rawError.slice(SCORE_TARGET_FILE_EXISTS_PREFIX.length),
    });
  }

  if (rawError === "score_source_file_not_found") {
    return i18n.t("useAsBaseScoreModal.sourceFileNotFoundError");
  }

  return rawError;
}
