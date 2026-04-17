import { Cloud, Loader } from "lucide-react";
import { useAppState } from "../context/AppContext";
import { formatBytes, formatEta } from "../utils/formatters";

export default function StatusBar() {
  const { state } = useAppState();

  const rclonePercentage =
    state.rcloneProgress.percentage !== null
      ? Math.round(state.rcloneProgress.percentage)
      : null;

  const hasOperationStatus = state.operationStatus.stepCurrent !== null;
  const isRcloneActive = state.rcloneProgress.direction !== null;
  const isVisible = state.isScanningFiles || hasOperationStatus;

  const etaText = formatEta(state.rcloneProgress.etaSeconds);

  if (!isVisible) {
    return null;
  }

  const title =
    state.operationStatus.title || (state.isScanningFiles ? "Verificando alteracoes" : "Processando");
  const detail = state.operationStatus.detail;
  const itemProgressText =
    state.operationStatus.itemCurrent !== null && state.operationStatus.itemTotal !== null
      ? `${state.operationStatus.itemCurrent} de ${state.operationStatus.itemTotal}`
      : null;
  const totalSteps = Math.max(
    state.operationStatus.stepTotal ?? state.scanProgress.total,
    1
  );
  const currentStage =
    state.operationStatus.stepCurrent ??
    (state.scanProgress.completed >= totalSteps
      ? totalSteps
      : Math.min(state.scanProgress.completed + 1, totalSteps));
  const workflowPercentage = state.isScanningFiles
    ? totalSteps > 0
      ? Math.round((state.scanProgress.completed / totalSteps) * 100)
      : 0
    : hasOperationStatus
      ? 0
      : 0;
  const totalBytes = state.rcloneProgress.totalBytes;
  const bytesTransferred = state.rcloneProgress.bytes;
  const bytesRemaining =
    totalBytes !== null ? Math.max(totalBytes - bytesTransferred, 0) : null;
  const transferPercentage =
    rclonePercentage ??
    (totalBytes && totalBytes > 0
      ? Math.round((Math.min(bytesTransferred, totalBytes) / totalBytes) * 100)
      : null);
  const hasTransferPercentage = transferPercentage !== null;
  const barPercentage = isRcloneActive
    ? Math.max(0, Math.min(100, transferPercentage ?? 0))
    : Math.max(0, Math.min(100, workflowPercentage));
  const shouldShowIndeterminateBar = hasOperationStatus && !state.isScanningFiles && !isRcloneActive;
  const isIndeterminateProgress = shouldShowIndeterminateBar || (isRcloneActive && !hasTransferPercentage);

  return (
    <footer className="fixed bottom-4 left-1/2 z-50 w-[min(680px,calc(100%-1.5rem))] -translate-x-1/2">
      <div className="rounded-xl border border-[#c8d9ee] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(22,55,90,0.18)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#21476c]">
              <Loader className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span className="truncate">Etapa {currentStage} de {totalSteps}</span>
              {isRcloneActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-semibold text-[#23558b]">
                  <Cloud className="h-3 w-3" />
                  Nuvem {state.rcloneProgress.direction === "upload" ? "upload" : "download"}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[11px] text-[#5e7390]">{title}</p>
            {detail && <p className="truncate text-[11px] text-[#5e7390]">{detail}</p>}
          </div>
          <span className="shrink-0 text-[12px] font-bold text-[#2464a8]">
            {isIndeterminateProgress ? "..." : `${barPercentage}%`}
          </span>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e8f0fa]">
          {isIndeterminateProgress ? (
            <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-[#2f7fd1] to-[#40b0ff]" />
          ) : (
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2f7fd1] to-[#40b0ff] transition-all duration-300"
              style={{ width: `${barPercentage}%` }}
            />
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-[#4f6887]">
          {isRcloneActive ? (
            <>
              {(bytesTransferred > 0 || totalBytes !== null) && (
                <span>
                  {formatBytes(bytesTransferred)}
                  {totalBytes !== null ? ` / ${formatBytes(totalBytes)}` : ""}
                </span>
              )}
              {state.rcloneProgress.speedBytesPerSec > 0 && (
                <span>{formatBytes(state.rcloneProgress.speedBytesPerSec)}/s</span>
              )}
              {bytesRemaining !== null && <span>Faltam {formatBytes(bytesRemaining)}</span>}
              {etaText && <span>ETA {etaText}</span>}
            </>
          ) : null}
          {!isRcloneActive && itemProgressText && <span>{itemProgressText}</span>}
        </div>
      </div>
    </footer>
  );
}
