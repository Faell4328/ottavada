import { useEffect, useState } from "react";
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
} from "./components";
import { AppProvider, useAppState } from "./context/AppContext";
import * as api from "./api/commands";
import { ConfirmationModal } from "./components/ui/ConfirmationModal";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#33465d] to-[#5d6d82]">
      <div className="text-white text-lg font-semibold animate-pulse">
        Carregando...
      </div>
    </div>
  );
}

function MainPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#5d6d82] via-[#73849a] to-[#d8dee8] select-none pt-[70px]">
      <TopBar />
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

  const isAppBusy =
    state.isLoading ||
    state.isScanningFiles ||
    state.rcloneProgress.direction !== null ||
    state.operationStatus.stepCurrent !== null;

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
              <Route path="/" element={<MainPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
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
  return (
    <AppProvider>
      <AppContent />
      <Toaster position="bottom-right" toastOptions={{ duration: 8000 }} />
    </AppProvider>
  );
}

export default App;
