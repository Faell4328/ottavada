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
