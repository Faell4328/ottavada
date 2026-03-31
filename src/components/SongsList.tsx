import React, { useState } from "react";
import { Search, FileMusic } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../context/AppContext";
import { EditMusicModal } from "./EditMusicModal";
import { EditScoreModal } from "./EditScoreModal";
import { MemoizedSongRow } from "./SongRow";
import { MemoizedScoreRow } from "./ScoreRow";
import { getDirectoryPath } from "../utils/paths";
import { useSearch } from "../hooks/useSearch";
import * as api from "../api/commands";
import toast from "react-hot-toast";
import type { SongListItem, ScoreListItem } from "../types";

function getViewLabel(sidebarView: ReturnType<typeof useAppState>["state"]["sidebarView"]): string {
  if (sidebarView === "all") return "Todas as Músicas";
  if (sidebarView === "favorites") return "Favoritos";
  if (sidebarView === "drafts") return "Rascunhos Ativos";
  if (sidebarView === "not_found") return "Partituras não encontradas";
  if (typeof sidebarView === "object") return sidebarView.name;
  return "";
}

export default function SongsList() {
  const { state, setSearchQuery, selectSong, selectScore, toggleFavorite, loadSongs, updateSong, updateScore, updateScoreStatus, deleteScore, deleteSong } =
    useAppState();
  const search = useSearch(setSearchQuery);
  const [editingSong, setEditingSong] = useState<SongListItem | null>(null);
  const [isEditMusicModalOpen, setIsEditMusicModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreListItem | null>(null);
  const [isEditScoreModalOpen, setIsEditScoreModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const closeAllMenus = () => setOpenMenuId(null);

  const handleSaveMusic = async (data: {
    songId: string;
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => {
    await updateSong(data.songId, data.title, data.composer, data.arranger, data.categoryIds);
  };

  const handleSaveScore = async (data: {
    songId: string;
    scoreFileId: string;
    instrumentName: string | null;
    filePath: string;
  }) => {
    await updateScore(data.scoreFileId, data.instrumentName, data.filePath);
  };

  const viewLabel = getViewLabel(state.sidebarView);

  async function handleAddFileToSong(songId: string) {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "Partituras", extensions: ["pdf", "PDF", "mus", "MUS", "musx", "MUSX"] }],
      });

      if (!selected) return;

      const selectedPath = Array.isArray(selected) ? selected[0] : selected;
      const directory = getDirectoryPath(selectedPath);
      const scannedFiles = await api.scanDirectory(directory);
      const indexed = scannedFiles.filter((file) => file.path === selectedPath);

      if (indexed.length > 0) {
        const updatedSong = await api.addScoreToSong(songId, indexed[0]);
        search.clearSearch();
        await loadSongs();
        selectSong(updatedSong);
        toast.success("Arquivo adicionado com sucesso");
      }
    } catch (err) {
      console.error("Failed to add file to song:", err);
      toast.error("Erro ao adicionar arquivo");
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-[#2f4259]">{viewLabel}</h2>
        <span className="text-xs text-[#6b849e]">
          {state.songs.length} música{state.songs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search with Suggestions */}
      <div className="relative flex gap-1.5 h-9" ref={search.suggestionsRef}>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8694a6]" />
          <input
            value={search.localQuery}
            onChange={(e) => search.setLocalQuery(e.target.value)}
            onFocus={search.onFocus}
            className="h-9 w-full rounded border border-[#c5cfdb] bg-white pl-9 pr-3 text-sm text-[#4d6075] placeholder-[#8e9fb3] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
            placeholder="Buscar músicas..."
            aria-label="Buscar músicas"
            autoComplete="off"
          />

          {search.showSuggestions && search.suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c5cfdb] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {search.suggestions.map((song) => (
                <button
                  key={song.id}
                  onClick={() => search.handleSuggestionClick(song)}
                  className="w-full text-left px-3 py-2 hover:bg-[#f2f5fa] border-b border-[#e8ecf0] last:border-b-0 text-sm text-[#344b61] transition-colors"
                >
                  <div className="font-medium">{song.name}</div>
                  <div className="text-xs text-[#8b9db2]">
                    {[song.composer, song.arranger].filter(Boolean).join(" / ") || "Sem informações"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-[#c8d1dc] bg-[#f8fafd] flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#ced7e3] bg-[#eef2f6] text-xs font-bold text-[#34485d] sticky top-0">
                <th className="text-left px-3.5 py-2.5 font-bold w-1/3">Título</th>
                <th className="text-left px-3.5 py-2.5 font-bold w-1/3">Compositor / Arranjador</th>
                <th className="text-left px-3.5 py-2.5 font-bold w-1/3"></th>
              </tr>
            </thead>
            <tbody>
              {state.songs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-[#8b9db2]">
                      <FileMusic className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm">Nenhuma música encontrada</p>
                      <p className="text-xs mt-1">Indexe um diretório para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                state.songs.map((song) => (
                  <React.Fragment key={song.id}>
                    <MemoizedSongRow
                      song={song}
                      isExpanded={state.selectedSong?.id === song.id}
                      onToggle={() => {
                        selectSong(state.selectedSong?.id === song.id ? null : song);
                        closeAllMenus();
                      }}
                      onToggleFavorite={() => toggleFavorite(song.id)}
                      onAddFile={() => handleAddFileToSong(song.id)}
                      onEdit={() => {
                        setEditingSong(song);
                        setIsEditMusicModalOpen(true);
                      }}
                      onDelete={deleteSong}
                      menuId={`song-${song.id}`}
                      isMenuOpen={openMenuId === `song-${song.id}`}
                      onMenuOpen={(id) => setOpenMenuId(id)}
                      onMenuClose={closeAllMenus}
                      computerType={state.settings?.computer_type}
                    />
                    {state.selectedSong?.id === song.id &&
                      song.scores.map((score) => (
                        <MemoizedScoreRow
                          key={score.id}
                          score={score}
                          onSelectScore={() => {
                            selectScore(state.selectedScore?.id === score.id ? null : score);
                            closeAllMenus();
                          }}
                          menuId={`score-${score.id}`}
                          isMenuOpen={openMenuId === `score-${score.id}`}
                          onMenuOpen={(id) => setOpenMenuId(id)}
                          onMenuClose={closeAllMenus}
                          onEdit={() => {
                            setEditingScore(score);
                            setIsEditScoreModalOpen(true);
                          }}
                          onStatusChange={updateScoreStatus}
                          onDelete={deleteScore}
                          computerType={state.settings?.computer_type}
                        />
                      ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <EditMusicModal
        isOpen={isEditMusicModalOpen}
        score={editingSong}
        onClose={() => { setIsEditMusicModalOpen(false); setEditingSong(null); }}
        onSave={handleSaveMusic}
      />
      <EditScoreModal
        isOpen={isEditScoreModalOpen}
        score={state.selectedSong}
        instrument={editingScore}
        onClose={() => { setIsEditScoreModalOpen(false); setEditingScore(null); }}
        onSave={handleSaveScore}
      />
    </section>
  );
}
