import { Music, FolderSearch, Plus, Settings } from "lucide-react";
import { useNavigate } from "react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import type { IndexedFile } from "../types";

interface TopBarProps {
  title?: string;
}

export default function TopBar({
  title = "Score Maestro",
}: TopBarProps) {
  const { loadScores } = useAppState();
  const navigate = useNavigate();

  async function importFiles(files: IndexedFile[]) {
    if (files.length === 0) {
      return;
    }

    await api.importIndexedFiles(files);
    await loadScores();
  }

  function getDirectoryPath(path: string) {
    const normalized = path.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) {
      return ".";
    }
    return normalized.slice(0, lastSlash);
  }

  async function handleAddFile() {
    try {
      const selected = await open({
        directory: false,
        multiple: true,
        filters: [
          {
            name: "Partituras",
            extensions: ["pdf", "mus", "musx"],
          },
        ],
      });

      if (!selected) {
        return;
      }

      const selectedPaths = Array.isArray(selected) ? selected : [selected];
      const selectedSet = new Set(selectedPaths);
      const directories = Array.from(
        new Set(selectedPaths.map((filePath) => getDirectoryPath(filePath)))
      );

      const scans = await Promise.all(
        directories.map((directory) => api.scanDirectory(directory))
      );

      const indexed = scans
        .flat()
        .filter((file) => selectedSet.has(file.path));

      await importFiles(indexed);
    } catch (err) {
      console.error("Failed to add file:", err);
    }
  }

  async function handleScanDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const files = await api.scanDirectory(selected as string);
        await importFiles(files);
      }
    } catch (err) {
      console.error("Failed to scan directory:", err);
    }
  }

  return (
    <header
      className="flex h-[70px] items-center justify-between bg-gradient-to-b from-[#33465d] to-[#23364b] px-4 text-white border-b border-white/15"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3">
        <img src="public/logo.png" alt="Logo" className="h-auto w-[70px] rounded-full" />
        <span className="text-xl font-bold tracking-tight">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        <ActionButton
          icon={<Plus className="h-4 w-4" />}
          title="Adicionar arquivo"
          onClick={handleAddFile}
        />
        <ActionButton
          icon={<FolderSearch className="h-4 w-4" />}
          title="Indexar diretório"
          onClick={handleScanDirectory}
        />
        <ActionButton
          icon={<Settings className="h-4 w-4" />}
          title="Configurações"
          onClick={() => navigate("/settings")}
        />
      </div>
    </header>
  );
}

function ActionButton({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 w-9 items-center justify-center rounded border border-white/25 bg-white/8 text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
    >
      {icon}
    </button>
  );
}
