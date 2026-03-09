import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "react-hot-toast";
import {
  TopBar,
  Sidebar,
  ScoreList,
  VersionPanel,
  StatusBar,
  SettingsPage,
  FirstRunPage,
} from "./components";
import { AppProvider, useAppState } from "./context/AppContext";

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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#5d6d82] via-[#73849a] to-[#d8dee8] select-none">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <ScoreList />
        <VersionPanel />
      </div>
      <StatusBar />
    </div>
  );
}

function AppContent() {
  const { state } = useAppState();

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
      <Toaster position="bottom-right" />
    </AppProvider>
  );
}

export default App;
