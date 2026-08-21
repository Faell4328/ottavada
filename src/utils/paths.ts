/**
 * Extracts the directory path from a full file path.
 * Normalizes backslashes to forward slashes for cross-platform compatibility.
 */
export function getDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return ".";
  }
  return normalized.slice(0, lastSlash);
}

/**
 * Extracts the file name from a full path.
 * Supports both Windows and Unix path separators.
 */
export function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash < 0) {
    return normalized;
  }
  return normalized.slice(lastSlash + 1);
}

/**
 * Compares two paths across platforms.
 * On Windows and macOS (case-insensitive filesystems), comparison is case-insensitive.
 * On Linux (case-sensitive ext4), comparison is case-sensitive.
 */
export function isCaseInsensitiveFilesystem(): boolean {
  const platform =
    typeof navigator !== "undefined" && navigator.userAgent
      ? (navigator as unknown as { userAgentData?: { platform?: string } })
          .userAgentData?.platform ||
        (/Mac/i.test(navigator.userAgent) ? "macOS" : "")
      : "";
  return (
    platform.toLowerCase().includes("win") ||
    platform.toLowerCase().includes("mac")
  );
}

export function isSamePath(pathA: string, pathB: string): boolean {
  const normalizedA = pathA.replace(/\\/g, "/");
  const normalizedB = pathB.replace(/\\/g, "/");

  const isWindowsStylePath =
    /^[a-zA-Z]:\//.test(normalizedA) || /^[a-zA-Z]:\//.test(normalizedB);

  if (isWindowsStylePath || isCaseInsensitiveFilesystem()) {
    return normalizedA.toLowerCase() === normalizedB.toLowerCase();
  }

  return normalizedA === normalizedB;
}
