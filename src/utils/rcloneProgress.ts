export interface RcloneProgressSnapshot {
  active: boolean;
  direction: "upload" | "download" | null;
  bytes: number;
  totalBytes: number | null;
  percentage: number | null;
  speedBytesPerSec: number;
  etaSeconds: number | null;
}

function normalizeRcloneProgressForUi(progress: RcloneProgressSnapshot) {
  return {
    active: progress.active,
    direction: progress.direction,
    bytesBucket: Math.floor(Math.max(progress.bytes, 0) / 256_000),
    totalBytes: progress.totalBytes,
    percentageBucket:
      progress.percentage === null ? null : Math.floor(progress.percentage),
    speedBucket: Math.floor(Math.max(progress.speedBytesPerSec, 0) / 64_000),
    etaSeconds: progress.etaSeconds,
  };
}

export function shouldDispatchRcloneProgressUpdate(
  previous: RcloneProgressSnapshot | null,
  next: RcloneProgressSnapshot,
) {
  if (previous === null) {
    return true;
  }

  const normalizedPrevious = normalizeRcloneProgressForUi(previous);
  const normalizedNext = normalizeRcloneProgressForUi(next);

  return Object.entries(normalizedPrevious).some(
    ([key, value]) =>
      normalizedNext[key as keyof typeof normalizedNext] !== value,
  );
}
