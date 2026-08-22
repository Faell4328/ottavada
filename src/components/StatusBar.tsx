import { Cloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useAppState } from "../context/AppContext";
import { formatBytes, formatEta } from "../utils/formatters";
import Metronome from "./ui/Metronome";

export default function StatusBar() {
  const { state } = useAppState();
  const { t } = useTranslation();

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
      ? `${t("statusBar.stepPrefix")} ${state.operationStatus.stepCurrent} ${t("statusBar.stepOf")} ${state.operationStatus.stepTotal}`
      : state.operationStatus.stepCurrent !== null
        ? `${t("statusBar.stepPrefix")} ${state.operationStatus.stepCurrent}`
        : state.rcloneProgress.active
          ? state.rcloneProgress.direction === null
            ? t("statusBar.checkingChanges")
            : state.rcloneProgress.direction === "upload"
              ? t("statusBar.uploading")
              : t("statusBar.downloading")
          : null;

  if (!isVisible) {
    return null;
  }

  const title =
    state.operationStatus.title ||
    (state.isScanningFiles
      ? t("statusBar.verifyingChanges")
      : state.rcloneProgress.active && state.rcloneProgress.direction === null
        ? t("statusBar.checkingCloud")
        : state.rcloneProgress.active
          ? t("statusBar.syncing")
          : t("statusBar.processing"));
  const detail =
    state.operationStatus.detail ||
    (state.rcloneProgress.active && state.rcloneProgress.direction === null
      ? t("statusBar.verifyingSnapshot")
      : null);
  const itemProgressText =
    state.operationStatus.itemCurrent !== null && state.operationStatus.itemTotal !== null
      ? `${state.operationStatus.itemCurrent} ${t("statusBar.itemOf")} ${state.operationStatus.itemTotal}`
      : null;
  const workflowPercentage =
    state.operationStatus.stepCurrent !== null && state.operationStatus.stepTotal !== null
      ? Math.round(
          (state.operationStatus.stepCurrent / state.operationStatus.stepTotal) * 100
        )
      : state.isScanningFiles
        ? 0
        : 0;
  const itemPercentage =
    state.operationStatus.itemCurrent !== null && state.operationStatus.itemTotal !== null
      ? Math.round(
          (Math.min(state.operationStatus.itemCurrent, state.operationStatus.itemTotal) /
            Math.max(state.operationStatus.itemTotal, 1)) *
            100
        )
      : null;
  const scanProgress = state.scanProgress ?? { total: 0, completed: 0, changedFiles: 0 };
  const scanPercentage =
    scanProgress.total > 0 && state.isScanningFiles
      ? Math.round(
          (Math.min(scanProgress.completed, scanProgress.total) /
            scanProgress.total) *
            100
        )
      : null;
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
    : itemPercentage !== null
      ? Math.max(0, Math.min(100, itemPercentage))
      : scanPercentage !== null
        ? Math.max(0, Math.min(100, scanPercentage))
        : Math.max(0, Math.min(100, workflowPercentage));
  const shouldShowIndeterminateBar = hasOperationStatus && !state.isScanningFiles && !isRcloneActive;
  const isIndeterminateProgress = shouldShowIndeterminateBar || (isRcloneActive && !hasTransferPercentage);

  return (
    <footer className="fixed bottom-4 left-1/2 z-50 w-[min(680px,calc(100%-1.5rem))] -translate-x-1/2">
      <div className="rounded-xl border border-[#c8d9ee] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(22,55,90,0.18)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center text-[12px] gap-2 font-semibold text-[#21476c]">
              <Metronome />
              <span className="truncate">{stageLabel ?? t("statusBar.loading")}</span>
              {isRcloneActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-semibold text-[#23558b]">
                  <Cloud className="h-3 w-3" />
                  {state.rcloneProgress.direction === "upload"
                    ? t("statusBar.uploading")
                    : state.rcloneProgress.direction === "download"
                      ? t("statusBar.downloading")
                      : t("statusBar.checkingChanges")}
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
              {bytesRemaining !== null && <span>{t("statusBar.remaining")} {formatBytes(bytesRemaining)}</span>}
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
  const match = title.match(/^(?:Etapa|Step)\s+(\d+)\s*-/i);
  if (!match) {
    return null;
  }

  return `${i18n.t("statusBar.stepPrefix")} ${match[1]}`;
}
