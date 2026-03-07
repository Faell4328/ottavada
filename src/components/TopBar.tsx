import { Music, FolderSearch, Plus, Settings, X } from "lucide-react";
import { useState } from "react";
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
  const [showAddMusicModal, setShowAddMusicModal] = useState(false);
  const [musicTitle, setMusicTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleAddMusic() {
    setShowAddMusicModal(true);
    setError(null);
  }

  async function handleCreateMusic() {
    if (!musicTitle.trim()) {
      setError("Digite o título da música");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.createScore(musicTitle.trim());
      await loadScores();
      setShowAddMusicModal(false);
      setMusicTitle("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao criar música";
      setError(errorMessage);
      console.error("Failed to create score:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCloseModal() {
    setShowAddMusicModal(false);
    setMusicTitle("");
    setError(null);
  }

  return (
    <>
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
            icon={<Music className="h-4 w-4" />}
            title="Adicionar música"
            onClick={handleAddMusic}
          />
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

      {showAddMusicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[#1e2836] p-6 shadow-xl border border-white/15">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Adicionar Música</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Nome da música"
                value={musicTitle}
                onChange={(e) => setMusicTitle(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleCreateMusic();
                  }
                }}
                className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/40 focus:bg-white/10 transition-colors"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 rounded bg-red-500/20 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isLoading}
                className="rounded border border-white/20 px-4 py-2 text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateMusic}
                disabled={isLoading}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Criando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
