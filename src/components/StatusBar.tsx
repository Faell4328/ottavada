import { Cloud, Loader } from "lucide-react";
import { useAppState } from "../context/AppContext";

export default function StatusBar() {
  const { state } = useAppState();

  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let index = 0;
    let current = value;
    while (current >= 1024 && index < units.length - 1) {
      current /= 1024;
      index += 1;
    }
    return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[index]}`;
  };

  const progressPercentage =
    state.scanProgress.total > 0
      ? Math.round((state.scanProgress.completed / state.scanProgress.total) * 100)
      : 0;

  const rclonePercentage =
    state.rcloneProgress.percentage !== null
      ? Math.round(state.rcloneProgress.percentage)
      : null;

  const isRcloneActive =
    state.isScanningFiles &&
    state.rcloneProgress.direction !== null &&
    state.rcloneProgress.active;

  const formatEta = (seconds: number | null) => {
    if (seconds === null || seconds < 0) return null;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const etaText = formatEta(state.rcloneProgress.etaSeconds);

  if (!state.isScanningFiles) {
    return null;
  }

  const title = state.operationStatus.title || "Verificando alteracoes";
  const detail = state.operationStatus.detail;
  const activePercentage = isRcloneActive
    ? (rclonePercentage ?? 0)
    : progressPercentage;

  return (
    <footer className="fixed bottom-4 left-1/2 z-50 w-[min(680px,calc(100%-1.5rem))] -translate-x-1/2">
      <div className="rounded-xl border border-[#c8d9ee] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(22,55,90,0.18)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#21476c]">
              <Loader className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span className="truncate">{title}</span>
              {isRcloneActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-semibold text-[#23558b]">
                  <Cloud className="h-3 w-3" />
                  Nuvem {state.rcloneProgress.direction === "upload" ? "upload" : "download"}
                </span>
              )}
            </div>
            {detail && (
              <p className="mt-1 truncate text-[11px] text-[#5e7390]">{detail}</p>
            )}
          </div>
          <span className="shrink-0 text-[12px] font-bold text-[#2464a8]">{activePercentage}%</span>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e8f0fa]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2f7fd1] to-[#40b0ff] transition-all duration-300"
            style={{ width: `${activePercentage}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-[#4f6887]">
          {isRcloneActive ? (
            <>
              <span>
                {formatBytes(state.rcloneProgress.bytes)}
                {state.rcloneProgress.totalBytes
                  ? ` / ${formatBytes(state.rcloneProgress.totalBytes)}`
                  : ""}
              </span>
              {state.rcloneProgress.speedBytesPerSec > 0 && (
                <span>{formatBytes(state.rcloneProgress.speedBytesPerSec)}/s</span>
              )}
              {etaText && <span>ETA {etaText}</span>}
            </>
          ) : (
            <>
              <span>
                Etapa {Math.min(state.scanProgress.completed, state.scanProgress.total)} de {state.scanProgress.total}
              </span>
              {state.scanProgress.changedFiles > 0 && (
                <span className="font-semibold text-green-700">
                  {state.scanProgress.changedFiles} alterado(s)
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
