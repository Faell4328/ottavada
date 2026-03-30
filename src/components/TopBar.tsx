import { Music, FolderSearch, Plus, Settings, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import toast from "react-hot-toast";
import type { IndexedFile } from "../types";
import { getDirectoryPath } from "../utils/paths";
import { AddFilesModal } from "./AddFilesModal";
import { AddMusicModal } from "./AddMusicModal";

interface TopBarProps {
  title?: string;
}

export default function TopBar({
  title = "Score Maestro",
}: TopBarProps) {
  const { loadSongs, loadCategories, state, scanFilesForChanges } = useAppState();
  const navigate = useNavigate();
  const isClient = state.settings?.computer_type === "Client";
  const clientBlockedTitle = "Operação não permitida para cliente";
  const [showAddMusicModal, setShowAddMusicModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<IndexedFile[]>([]);
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);

  // Forçar reload quando scores muda - isso garante que a UI atualiza
  const handleScoresChange = async () => {
    // Pequeno delay para garantir que backend processou tudo
    await new Promise(resolve => setTimeout(resolve, 100));
    await Promise.all([
      loadSongs(),
      loadCategories()
    ]);
  };

  async function handleAddFile() {
    try {
      const selected = await open({
        directory: false,
        multiple: true,
        filters: [
          {
            name: "Partituras",
            extensions: ["pdf", "PDF", "mus", "MUS", "musx", "MUSX"],
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

      if (indexed.length === 0) {
        toast.error("Nenhuma música encontrada");
        return;
      }

      setPendingFiles(indexed);
      setShowAddFilesModal(true);
    } catch (err) {
      console.error("Failed to add file:", err);
      toast.error("Erro ao selecionar arquivo");
    }
  }

  async function handleScanDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const files = await api.scanDirectory(selected as string);
        if (files.length === 0) {
          toast.error("Nenhuma música encontrada no diretório selecionado");
          return;
        }
        setPendingFiles(files);
        setShowAddFilesModal(true);
      }
    } catch (err) {
      console.error("Failed to scan directory:", err);
      toast.error("Erro ao escanear diretório");
    }
  }

  async function handleAddMusic() {
    setShowAddMusicModal(true);
  }

  async function handleCreateMusic(data: {
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) {
    await api.createSongWithMetadata(
      data.title,
      data.composer,
      data.arranger,
      data.categoryIds
    );
    await loadSongs();
    toast.success("Música criada com sucesso!");
  }

  function handleCloseAddFilesModal() {
    setShowAddFilesModal(false);
    setPendingFiles([]);
  }

  async function handleAddFilesModalSuccess() {
    toast.success(`${pendingFiles.length} arquivo(s) adicionado(s) com sucesso`);
    handleCloseAddFilesModal();
    await handleScoresChange();
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 w-full flex h-[70px] items-center justify-between bg-gradient-to-b from-[#33465d] to-[#23364b] px-4 text-white border-b border-white/15 z-50"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-auto w-[70px] rounded-full" />
          <span className="text-xl font-bold tracking-tight">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            icon={<Music className="h-4 w-4" />}
            title={isClient ? clientBlockedTitle : "Adicionar música"}
            onClick={handleAddMusic}
            disabled={isClient}
          />
          <ActionButton
            icon={<Plus className="h-4 w-4" />}
            title={isClient ? clientBlockedTitle : "Adicionar arquivo"}
            onClick={handleAddFile}
            disabled={isClient}
          />
          <ActionButton
            icon={<FolderSearch className="h-4 w-4" />}
            title={isClient ? clientBlockedTitle : "Indexar diretório"}
            onClick={handleScanDirectory}
            disabled={isClient}
          />
          <ActionButton
            icon={<RefreshCw className={`h-4 w-4 ${state.isScanningFiles ? 'animate-spin' : ''}`} />}
            title="Verificar alterações"
            onClick={scanFilesForChanges}
            disabled={state.isScanningFiles}
          />
          <ActionButton
            icon={<Settings className="h-4 w-4" />}
            title="Configurações"
            onClick={() => navigate("/settings")}
          />
        </div>
      </header>

      <AddMusicModal
        isOpen={showAddMusicModal}
        onClose={() => setShowAddMusicModal(false)}
        onSave={handleCreateMusic}
      />

      <AddFilesModal
        isOpen={showAddFilesModal}
        files={pendingFiles}
        onClose={handleCloseAddFilesModal}
        onSuccess={handleAddFilesModalSuccess}
      />
    </>
  );
}

function ActionButton({
  icon,
  title,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-9 items-center justify-center rounded border border-white/25 text-white/90 transition-colors cursor-pointer ${
        disabled
          ? "bg-white/5 opacity-50 cursor-not-allowed"
          : "bg-white/8 hover:bg-white/15"
      }`}
    >
      {icon}
    </button>
  );
}
