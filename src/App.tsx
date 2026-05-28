import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  TopBar,
  Sidebar,
  SongsList,
  StatusBar,
  SettingsPage,
  FirstRunPage,
  UpdateModal,
  ScanReportModal,
} from "./components";
import { AppProvider, useAppState } from "./context/AppContext";
import * as api from "./api/commands";
import { ConfirmationModal } from "./components/ui/ConfirmationModal";
import { getErrorMessage } from "./utils/errors";
import { isUpdateActionLocked as getIsUpdateActionLocked } from "./utils/updateLock";
import { restoreMainWindow } from "./utils/window";
import type { UpdateInfo } from "./types";
import type { UpdateCheckResult } from "./types";
import { resolveStartupUpdateState } from "./utils/startupUpdate";

const STARTUP_UPDATE_TIMEOUT_MS = 2000;
const STARTUP_UPDATE_TIMEOUT = Symbol("startup-update-timeout");

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#fbfcfe] to-[#eef3f8]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,132,215,0.08),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(93,109,130,0.08),_transparent_36%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-[#dce6f1] bg-white/90 px-8 py-10 text-center shadow-[0_24px_80px_rgba(36,68,104,0.12)] backdrop-blur-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d6e2ef] bg-[#f7faff] shadow-inner">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#dbe7f4] border-t-[#4f84d7]" />
        </div>
        <div>
          <p className="text-lg font-semibold text-[#29445f]">Carregando Score Maestro</p>
          <p className="mt-1 text-sm text-[#6e8399]">Preparando a interface inicial</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ecf2f8]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#4f84d7] to-[#7cb6ff]" />
        </div>
      </div>
    </div>
  );
}

export function StartupUpdateGate({ onReady }: { onReady: (update: UpdateInfo | null) => void }) {
  const finishStartup = useCallback(
    (update: UpdateInfo | null) => {
      onReady(update);
    },
    [onReady]
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        const result: UpdateCheckResult | typeof STARTUP_UPDATE_TIMEOUT = await Promise.race([
          api.checkForUpdates(),
          new Promise<UpdateCheckResult | typeof STARTUP_UPDATE_TIMEOUT>((resolve) => {
            timeoutId = setTimeout(
              () => resolve(STARTUP_UPDATE_TIMEOUT),
              STARTUP_UPDATE_TIMEOUT_MS
            );
          }),
        ]);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (cancelled) {
          return;
        }

        if (result === STARTUP_UPDATE_TIMEOUT) {
          console.warn(
            `Startup update check timed out after ${STARTUP_UPDATE_TIMEOUT_MS}ms`
          );
          finishStartup(null);
          return;
        }

        const nextState = resolveStartupUpdateState(result);

        if (nextState.status === "ready") {
          finishStartup(null);
          return;
        }

        finishStartup(nextState.update);
      } catch (error) {
        console.error("Failed to check startup updates:", error);
        if (!cancelled) {
          finishStartup(null);
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [finishStartup]);

  return (
    <LoadingScreen />
  );
}

interface MainPageProps {
  onUpdateClick: () => void;
  isUpdateBusy: boolean;
  hasAvailableUpdate: boolean;
  isUpdateActionLocked: boolean;
}

function MainPage({
  onUpdateClick,
  isUpdateBusy,
  hasAvailableUpdate,
  isUpdateActionLocked,
}: MainPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#5d6d82] via-[#73849a] to-[#d8dee8] select-none pt-[70px]">
      <TopBar
        onUpdateClick={onUpdateClick}
        isUpdateBusy={isUpdateBusy}
        hasAvailableUpdate={hasAvailableUpdate}
        isUpdateActionLocked={isUpdateActionLocked}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <SongsList />
      </div>
      <StatusBar />
    </div>
  );
}

interface AppContentProps {
  startupUpdate: UpdateInfo | null;
}

function AppContent({ startupUpdate }: AppContentProps) {
  const { state, resetScanReport, scanFilesForChanges } = useAppState();
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitMessage, setExitMessage] = useState("");
  const [isExitProcessing, setIsExitProcessing] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isConfirmingScanReport, setIsConfirmingScanReport] = useState(false);

  const isAppBusy =
    state.isLoading ||
    state.isScanningFiles ||
    state.rcloneProgress.active ||
    state.operationStatus.stepCurrent !== null;

  const isUpdateBusy = isCheckingUpdate || isInstallingUpdate;
  const isUpdateActionLocked = getIsUpdateActionLocked({
    isCheckingUpdate,
    isInstallingUpdate,
    isUpdateModalOpen,
  });

  useEffect(() => {
    if (!startupUpdate) {
      return;
    }

    setAvailableUpdate(startupUpdate);
    setIsUpdateModalOpen(true);
  }, [startupUpdate]);

  const checkForUpdates = useCallback(async (manual = false) => {
    if (isCheckingUpdate || isInstallingUpdate) {
      return;
    }

    setIsCheckingUpdate(true);

    try {
      const result = await api.checkForUpdates();

      if (!result.configured) {
        if (manual) {
          toast.error("Atualização não configurada no aplicativo");
        }
        return;
      }

      if (result.update) {
        setAvailableUpdate(result.update);
        setIsUpdateModalOpen(true);
      } else if (manual) {
        toast.success("Nenhuma atualização disponível no momento");
      }
    } catch (error) {
      console.error("Failed to check updates:", error);
      if (manual) {
        //toast.error(`Falha ao verificar atualização: ${getErrorMessage(error)}`);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [isCheckingUpdate, isInstallingUpdate]);

  const handleUpdateButtonClick = useCallback(() => {
    if (isUpdateBusy) {
      return;
    }

    if (availableUpdate) {
      setIsUpdateModalOpen(true);
      return;
    }

    void checkForUpdates(true);
  }, [availableUpdate, checkForUpdates, isUpdateBusy]);

  const handleInstallUpdate = useCallback(async () => {
    if (!availableUpdate) {
      return;
    }

    setIsInstallingUpdate(true);

    try {
      await api.installUpdate();
      setIsUpdateModalOpen(false);
      setAvailableUpdate(null);
      toast.success("Atualização instalada com sucesso");
    } catch (error) {
      console.error("Failed to install update:", error);
      toast.error(`Erro ao instalar atualização: ${getErrorMessage(error)}`);
    } finally {
      setIsInstallingUpdate(false);
    }
  }, [availableUpdate]);

  const handleConfirmScanReport = useCallback(async () => {
    if (isConfirmingScanReport) {
      return;
    }

    setIsConfirmingScanReport(true);

    try {
      await scanFilesForChanges({ forceCloudSync: true, rethrowOnError: true });
      resetScanReport();
    } catch (error) {
      console.error("Failed to apply confirmed scan report:", error);
    } finally {
      setIsConfirmingScanReport(false);
    }
  }, [isConfirmingScanReport, resetScanReport, scanFilesForChanges]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const registerCloseHandler = async () => {
      const closeListener = await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();

        if (isAppBusy) {
          setExitMessage(
            "Há uma operação em andamento. Sair agora vai encerrar o rclone e interromper snapshot, upload ou download."
          );
          setShowExitModal(true);
          return;
        }

        try {
          const hasPendingChanges = await api.hasPendingChanges();

          if (hasPendingChanges) {
            setExitMessage("Há alterações pendentes para aplicar. Deseja sair mesmo assim?");
            setShowExitModal(true);
            return;
          }

          setIsExitProcessing(true);
          await api.exitApplication();
        } catch (error) {
          console.error("Failed to handle close request:", error);
          setExitMessage(
            "Não foi possível confirmar o estado atual. Deseja sair mesmo assim?"
          );
          setShowExitModal(true);
          setIsExitProcessing(false);
        }
      });

      if (disposed) {
        void closeListener();
        return;
      }

      unlisten = closeListener;
    };

    void registerCloseHandler();

    return () => {
      disposed = true;
      void unlisten?.();
    };
  }, [isAppBusy]);

  async function handleConfirmExit() {
    setIsExitProcessing(true);

    try {
      await api.exitApplication();
    } catch (error) {
      console.error("Failed to exit application:", error);
      toast.error("Falha ao encerrar o aplicativo");
      setIsExitProcessing(false);
    }
  }

  function handleCancelExit() {
    setShowExitModal(false);
    setExitMessage("");
    setIsExitProcessing(false);
  }

  if (state.isLoading) {
    return (
      <>
        <LoadingScreen />
        <ConfirmationModal
          isOpen={showExitModal}
          title="Sair do aplicativo?"
          message={exitMessage}
          isLoading={isExitProcessing}
          onConfirm={handleConfirmExit}
          onCancel={handleCancelExit}
        />
      </>
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          {state.isFirstRun ? (
            <Route path="*" element={<FirstRunPage />} />
          ) : (
            <>
              <Route
                path="/"
                element={(
                  <MainPage
                    onUpdateClick={handleUpdateButtonClick}
                    isUpdateBusy={isUpdateBusy}
                    hasAvailableUpdate={availableUpdate !== null}
                    isUpdateActionLocked={isUpdateActionLocked}
                  />
                )}
              />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      <UpdateModal
        isOpen={isUpdateModalOpen}
        update={availableUpdate}
        isInstalling={isInstallingUpdate}
        onCancel={() => setIsUpdateModalOpen(false)}
        onConfirm={() => {
          void handleInstallUpdate();
        }}
      />
      <ScanReportModal
        isOpen={state.scanReport !== null}
        report={state.scanReport}
        isConfirming={isConfirmingScanReport}
        onClose={resetScanReport}
        onConfirm={() => {
          void handleConfirmScanReport();
        }}
      />
      <ConfirmationModal
        isOpen={showExitModal}
        title="Sair do aplicativo?"
        message={exitMessage}
        isLoading={isExitProcessing}
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
      />
    </>
  );
}

function App() {
  const [startupReady, setStartupReady] = useState(false);
  const [startupUpdate, setStartupUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    void restoreMainWindow();
  }, []);

  return (
    <>
      {startupReady ? (
        <AppProvider>
          <AppContent startupUpdate={startupUpdate} />
        </AppProvider>
      ) : (
        <StartupUpdateGate
          onReady={(update) => {
            setStartupUpdate(update);
            setStartupReady(true);
          }}
        />
      )}
      <Toaster position="bottom-right" toastOptions={{ duration: 8000 }} />
    </>
  );
}

export default App;
