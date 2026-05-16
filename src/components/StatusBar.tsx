import { Cloud } from "lucide-react";
import { useAppState } from "../context/AppContext";
import { formatBytes, formatEta } from "../utils/formatters";
import Metronome from "./ui/Metronome";

export default function StatusBar() {
  const { state } = useAppState();

  const rclonePercentage =
    state.rcloneProgress.percentage !== null
      ? Math.round(state.rcloneProgress.percentage)
      : null;

  const hasOperationStatus = state.operationStatus.stepCurrent !== null;
  const isRcloneActive = state.rcloneProgress.active;
  const isVisible = state.isScanningFiles || hasOperationStatus || isRcloneActive;

  const etaText = formatEta(state.rcloneProgress.etaSeconds);

  const titleStageLabel = extractStageLabelFromTitle(state.operationStatus.title);

  const stageLabel =
    titleStageLabel !== null && state.operationStatus.stepTotal === 1
      ? titleStageLabel
      : state.operationStatus.stepCurrent !== null && state.operationStatus.stepTotal !== null
      ? `Etapa ${state.operationStatus.stepCurrent} de ${state.operationStatus.stepTotal}`
      : state.operationStatus.stepCurrent !== null
        ? `Etapa ${state.operationStatus.stepCurrent}`
        : state.rcloneProgress.active
          ? state.rcloneProgress.direction === null
            ? "Consultando alterações"
            : state.rcloneProgress.direction === "upload"
              ? "Enviando"
              : "Baixando"
          : null;

  if (!isVisible) {
    return null;
  }

  const title =
    state.operationStatus.title ||
    (state.isScanningFiles
      ? "Verificando alterações"
      : state.rcloneProgress.active && state.rcloneProgress.direction === null
        ? "Consultando alterações na nuvem"
        : state.rcloneProgress.active
          ? "Sincronizando com a nuvem"
          : "Processando");
  const detail =
    state.operationStatus.detail ||
    (state.rcloneProgress.active && state.rcloneProgress.direction === null
      ? "Verificando snapshot e events da nuvem"
      : null);
  const itemProgressText =
    state.operationStatus.itemCurrent !== null && state.operationStatus.itemTotal !== null
      ? `${state.operationStatus.itemCurrent} de ${state.operationStatus.itemTotal}`
      : null;
  const workflowPercentage =
    state.operationStatus.stepCurrent !== null && state.operationStatus.stepTotal !== null
      ? Math.round(
          (state.operationStatus.stepCurrent / state.operationStatus.stepTotal) * 100
        )
      : state.isScanningFiles
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
            <div className="flex items-center text-[12px] gap-2 font-semibold text-[#21476c]">
              {stageLabel ? (
                <>
                  <Metronome />
                  <span className="truncate">{stageLabel}</span>
                </>
              ) : (
                <span className="truncate">Processando</span>
              )}
              {isRcloneActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-semibold text-[#23558b]">
                  <Cloud className="h-3 w-3" />
                  {state.rcloneProgress.direction === "upload"
                    ? "Enviando"
                    : state.rcloneProgress.direction === "download"
                      ? "Baixando"
                      : "Consultando"}
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

function extractStageLabelFromTitle(title: string): string | null {
  const match = title.match(/^Etapa\s+(\d+)\s*-/i);
  if (!match) {
    return null;
  }

  return `Etapa ${match[1]}`;
}
