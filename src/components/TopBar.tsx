import { Download, Music, FolderSearch, Settings, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../context/AppContext";
import * as api from "../api/commands";
import toast from "react-hot-toast";
import type { IndexedFile, SongListItem } from "../types";
import { getErrorMessage } from "../utils/errors";
import { isClientComputer } from "../utils/computer";
import { AddFilesModal } from "./AddFilesModal.tsx";
import { AddMusicModal } from "./AddMusicModal";

interface TopBarProps {
  title?: string;
  onUpdateClick: () => void;
  isUpdateBusy: boolean;
  hasAvailableUpdate: boolean;
}

export default function TopBar({
  title = "Score Maestro",
  onUpdateClick,
  isUpdateBusy,
  hasAvailableUpdate,
}: TopBarProps) {
  const { loadSongs, loadCategories, state, scanFilesForChanges } = useAppState();
  const navigate = useNavigate();
  const isClient = isClientComputer(state.settings?.computer_type);
  const isSyncLocked = state.isScanningFiles || state.rcloneProgress.direction !== null;
  const clientBlockedTitle = "Operação não permitida para cliente";
  const syncBlockedTitle = "Operação bloqueada durante sincronização";
  const [showAddMusicModal, setShowAddMusicModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<IndexedFile[]>([]);
  const [existingSongsForAddFiles, setExistingSongsForAddFiles] = useState<SongListItem[]>([]);
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const selectedCategoryIds = useMemo(
    () =>
      typeof state.sidebarView === "object" && state.sidebarView.type === "category"
        ? [state.sidebarView.id]
        : [],
    [state.sidebarView]
  );

  // Forçar reload quando scores muda - isso garante que a UI atualiza
  const handleScoresChange = async () => {
    // Pequeno delay para garantir que backend processou tudo
    await new Promise(resolve => setTimeout(resolve, 100));
    await Promise.all([
      loadSongs(),
      loadCategories()
    ]);
  };

  async function handleScanDirectory() {
    if (isSyncLocked) {
      toast.error(syncBlockedTitle);
      return;
    }

    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const files = await api.scanDirectory(selected as string);
        if (files.length === 0) {
          toast.error("Nenhuma música encontrada no diretório selecionado");
          return;
        }
        const existingSongs = await api.getAllSongs();
        setPendingFiles(files);
        setExistingSongsForAddFiles(existingSongs);
        setShowAddFilesModal(true);
      }
    } catch (err) {
      console.error("Failed to scan directory:", err);
      toast.error(`Erro ao escanear diretório: ${getErrorMessage(err)}`);
    }
  }

  function handleAddMusic() {
    if (isSyncLocked) {
      toast.error(syncBlockedTitle);
      return;
    }

    setShowAddMusicModal(true);
  }

  async function handleCreateMusic(data: {
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) {
    try {
      await api.createSongWithMetadata(
        data.title,
        data.composer,
        data.arranger,
        data.categoryIds
      );
      await loadSongs();
      toast.success("Música criada com sucesso!");
    } catch (err) {
      console.error("Failed to create music:", err);
      toast.error(`Erro ao adicionar música: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  function handleCloseAddFilesModal() {
    setShowAddFilesModal(false);
    setPendingFiles([]);
    setExistingSongsForAddFiles([]);
  }

  async function handleAddFilesModalSuccess(addedCount: number) {
    toast.success(`${addedCount} arquivo(s) adicionado(s) com sucesso`);
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
          {hasAvailableUpdate && (
            <ActionButton
              icon={<Download className={`h-4 w-4 ${isUpdateBusy ? "animate-spin" : "animate-pulse"}`} />}
              title={isSyncLocked ? syncBlockedTitle : "Atualização disponível"}
              onClick={onUpdateClick}
              disabled={isSyncLocked || isUpdateBusy}
              accent
            />
          )}
          <ActionButton
            icon={<Music className="h-4 w-4" />}
            title={isClient ? clientBlockedTitle : isSyncLocked ? syncBlockedTitle : "Adicionar música"}
            onClick={handleAddMusic}
            disabled={isClient || isSyncLocked}
          />
          <ActionButton
            icon={<FolderSearch className="h-4 w-4" />}
            title={isClient ? clientBlockedTitle : isSyncLocked ? syncBlockedTitle : "Indexar diretório"}
            onClick={handleScanDirectory}
            disabled={isClient || isSyncLocked}
          />
          <ActionButton
            icon={<RefreshCw className={`h-4 w-4 ${state.isScanningFiles ? 'animate-spin' : ''}`} />}
            title={isSyncLocked ? syncBlockedTitle : isClient ? "Consultar alterações" : "Aplicar alterações"}
            onClick={() => {
              if (isSyncLocked) {
                toast.error(syncBlockedTitle);
                return;
              }

              void scanFilesForChanges();
            }}
            disabled={isSyncLocked}
          />
          <ActionButton
            icon={<Settings className="h-4 w-4" />}
            title={isSyncLocked ? syncBlockedTitle : "Configurações"}
            onClick={() => {
              if (isSyncLocked) {
                toast.error(syncBlockedTitle);
                return;
              }

              navigate("/settings");
            }}
            disabled={isSyncLocked}
          />
        </div>
      </header>

      <AddMusicModal
        isOpen={showAddMusicModal}
        onClose={() => setShowAddMusicModal(false)}
        onSave={handleCreateMusic}
        defaultCategoryIds={selectedCategoryIds}
      />

      <AddFilesModal
        isOpen={showAddFilesModal}
        files={pendingFiles}
        existingSongs={existingSongsForAddFiles}
        onClose={handleCloseAddFilesModal}
        onSuccess={handleAddFilesModalSuccess}
        defaultCategoryIds={selectedCategoryIds}
      />
    </>
  );
}

function ActionButton({
  icon,
  title,
  onClick,
  disabled = false,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
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
          : accent
            ? "bg-amber-400/15 hover:bg-amber-400/25"
            : "bg-white/8 hover:bg-white/15"
      }`}
    >
      {icon}
    </button>
  );
}
