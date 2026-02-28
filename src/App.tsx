import { TopBar, Sidebar, ScoreList, VersionPanel, StatusBar } from "./components";
import { libraryRows, versions, menuSections, statusItems } from "./data/mockData";

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#5d6d82] via-[#73849a] to-[#d8dee8]">
      <TopBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar sections={menuSections} />
        <ScoreList rows={libraryRows} />
        <VersionPanel scoreName="Canon in D" versions={versions} />
      </div>

      <StatusBar items={statusItems} />
    </div>
  );
}

export default App;
