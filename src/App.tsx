import { useState } from "react";
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

function AppContent() {
  const { state } = useAppState();
  const [showSettings, setShowSettings] = useState(false);

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#33465d] to-[#5d6d82]">
        <div className="text-white text-lg font-semibold animate-pulse">
          Carregando...
        </div>
      </div>
    );
  }

  if (state.isFirstRun) {
    return <FirstRunPage />;
  }

  if (showSettings) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#5d6d82] via-[#73849a] to-[#d8dee8]">
        <TopBar onOpenSettings={() => setShowSettings(false)} />
        <SettingsPage onBack={() => setShowSettings(false)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#5d6d82] via-[#73849a] to-[#d8dee8]">
      <TopBar onOpenSettings={() => setShowSettings(true)} />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <ScoreList />
        <VersionPanel />
      </div>
      <StatusBar onOpenSettings={() => setShowSettings(true)} />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
