import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "react-hot-toast";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  TopBar,
  Sidebar,
  SongsList,
  StatusBar,
  SettingsPage,
  FirstRunPage,
} from "./components";
import { AppProvider, useAppState } from "./context/AppContext";
import { hasPendingChanges } from "./api/commands";

const PENDING_CHANGES_TIMEOUT_MS = 1500;

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
  const isForceClosingRef = useRef(false);

  useEffect(() => {
    // Em testes/web puro nao existe janela Tauri para interceptar fechamento.
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setupCloseListener = async () => {
      const appWindow = getCurrentWindow();
      const off = await appWindow.onCloseRequested(async (event) => {
        try {
          if (isForceClosingRef.current) {
            return;
          }

          const hasChangesResult = await Promise.race<boolean | null>([
            hasPendingChanges(),
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), PENDING_CHANGES_TIMEOUT_MS);
            }),
          ]);

          if (hasChangesResult === null) {
            event.preventDefault();

            const shouldCloseWhileBusy = await confirm(
              "Existe uma operação em andamento (ex: importação de backup). Deseja fechar agora mesmo?",
              {
                title: "Operação em andamento",
                kind: "warning",
                okLabel: "Fechar agora",
                cancelLabel: "Aguardar",
              }
            );

            if (shouldCloseWhileBusy) {
              isForceClosingRef.current = true;
              await appWindow.destroy();
            }

            return;
          }

          if (!hasChangesResult) {
            event.preventDefault();
            isForceClosingRef.current = true;
            await appWindow.destroy();
            return;
          }

          event.preventDefault();
          const shouldClose = await confirm(
            "Existem alterações pendentes. Clique em 'Aplicar alterações' antes de fechar para enviar para a nuvem.",
            {
              title: "Alterações pendentes",
              kind: "warning",
              okLabel: "Fechar sem aplicar",
              cancelLabel: "Continuar no app",
            }
          );

          if (shouldClose) {
            isForceClosingRef.current = true;
            await appWindow.destroy();
          }
        } catch (error) {
          console.error("Erro ao validar alterações pendentes no fechamento:", error);
        }
      });

      // Evita listener duplicado no StrictMode (mount/unmount duplo em dev).
      if (disposed) {
        off();
        return;
      }

      unlisten = off;
    };

    void setupCloseListener();

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  return (
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
