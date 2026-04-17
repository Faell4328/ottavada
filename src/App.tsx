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
} from "./components";
import { AppProvider, useAppState } from "./context/AppContext";
import * as api from "./api/commands";
import { ConfirmationModal } from "./components/ui/ConfirmationModal";
import { getErrorMessage } from "./utils/errors";
import { isUpdateActionLocked as getIsUpdateActionLocked } from "./utils/updateLock";
import type { UpdateInfo } from "./types";
import {
  initialStartupUpdateState,
  resolveStartupUpdateState,
  type StartupUpdateState,
} from "./utils/startupUpdate";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#5d6d82]">
      <div className="text-white text-lg font-semibold animate-pulse">
        Carregando...
      </div>
    </div>
  );
}

export function StartupUpdateGate({ onReady }: { onReady: () => void }) {
  const [startupState, setStartupState] = useState<StartupUpdateState>(initialStartupUpdateState);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  const finishStartup = useCallback(() => {
    setStartupState({ status: "ready", update: null });
    onReady();
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await api.checkForUpdates();

        if (cancelled) {
          return;
        }

        const nextState = resolveStartupUpdateState(result);

        if (nextState.status === "ready") {
          finishStartup();
          return;
        }

        setAvailableUpdate(nextState.update);
        setStartupState(nextState);
      } catch (error) {
        console.error("Failed to check startup updates:", error);
        if (!cancelled) {
          //toast.error(`Falha ao verificar atualização: ${getErrorMessage(error)}`);
          finishStartup();
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [finishStartup]);

  const handlePostpone = useCallback(() => {
    setAvailableUpdate(null);
    finishStartup();
  }, [finishStartup]);

  const handleInstall = useCallback(async () => {
    if (!availableUpdate || isInstallingUpdate) {
      return;
    }

    setIsInstallingUpdate(true);

    try {
      await api.installUpdate();
      finishStartup();
    } catch (error) {
      console.error("Failed to install startup update:", error);
      toast.error(`Erro ao instalar atualização: ${getErrorMessage(error)}`);
    } finally {
      setIsInstallingUpdate(false);
    }
  }, [availableUpdate, finishStartup, isInstallingUpdate]);

  return (
    <>
      <LoadingScreen />
      <UpdateModal
        isOpen={startupState.status === "update-available" && availableUpdate !== null}
        update={availableUpdate}
        isInstalling={isInstallingUpdate}
        onCancel={handlePostpone}
        onConfirm={() => {
          void handleInstall();
        }}
      />
    </>
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

function AppContent() {
  const { state } = useAppState();
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitMessage, setExitMessage] = useState("");
  const [isExitProcessing, setIsExitProcessing] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  const isAppBusy =
    state.isLoading ||
    state.isScanningFiles ||
    state.rcloneProgress.direction !== null ||
    state.operationStatus.stepCurrent !== null;

  const isUpdateBusy = isCheckingUpdate || isInstallingUpdate;
  const isUpdateActionLocked = getIsUpdateActionLocked({
    isCheckingUpdate,
    isInstallingUpdate,
    isUpdateModalOpen,
  });

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

  return (
    <>
      {startupReady ? (
        <AppProvider>
          <AppContent />
        </AppProvider>
      ) : (
        <StartupUpdateGate onReady={() => setStartupReady(true)} />
      )}
      <Toaster position="bottom-right" toastOptions={{ duration: 8000 }} />
    </>
  );
}

export default App;
