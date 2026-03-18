import React, { useState, useEffect, useRef } from "react";
import { Search, FileMusic } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../context/AppContext";
import { EditMusicModal } from "./EditMusicModal";
import { EditScoreModal } from "./EditScoreModal";
import { MemoizedSongRow } from "./SongRow";
import { MemoizedScoreRow } from "./ScoreRow";
import { getDirectoryPath } from "../utils/paths";
import * as api from "../api/commands";
import toast from "react-hot-toast";
import type { SongListItem, ScoreListItem } from "../types";

export default function SongsList() {
  const { state, setSearchQuery, selectSong, selectScore, toggleFavorite, loadSongs, updateSong, updateScore } =
    useAppState();
  const [localQuery, setLocalQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SongListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingSong, setEditingSong] = useState<SongListItem | null>(null);
  const [isEditMusicModalOpen, setIsEditMusicModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreListItem | null>(null);
  const [isEditScoreModalOpen, setIsEditScoreModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  // Debounced search for suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (localQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchQuery("");
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.getSearchSuggestions(localQuery, 8);
        setSuggestions(results);
        setShowSuggestions(true);
        setSearchQuery(localQuery);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
        setSuggestions([]);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localQuery, setSearchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const viewLabel =
    state.sidebarView === "all"
      ? "Todas as Partituras"
      : state.sidebarView === "favorites"
        ? "Favoritos"
        : state.sidebarView === "drafts"
          ? "Rascunhos Ativos"
          : typeof state.sidebarView === "object"
            ? state.sidebarView.name
            : "";

  const handleSuggestionClick = (song: SongListItem) => {
    setLocalQuery(song.name);
    setShowSuggestions(false);
    setSearchQuery(song.name);
  };

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
        await api.addScoreToSong(songId, indexed[0]);
        setLocalQuery("");
        setSearchQuery("");
        await loadSongs();
        toast.success("Arquivo adicionado com sucesso");
      }
    } catch (err) {
      console.error("Failed to add file to song:", err);
      toast.error("Erro ao adicionar arquivo");
    }
  }

  async function handleAddDirectoryToSong(songId: string) {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected) return;

      const files = await api.scanDirectory(selected as string);
      if (files.length === 0) {
        toast.error("Nenhuma partitura encontrada neste diretório");
        return;
      }

      await api.addScoresToSong(songId, files);
      setLocalQuery("");
      setSearchQuery("");
      await loadSongs();
      toast.success(`${files.length} arquivo(s) adicionado(s) com sucesso`);
    } catch (err) {
      console.error("Failed to add directory to song:", err);
      const errorMsg =
        typeof err === "string" ? err
        : err instanceof Error ? err.message
        : "Erro ao adicionar diretório";
      toast.error(errorMsg);
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-[#2f4259]">{viewLabel}</h2>
        <span className="text-xs text-[#6b849e]">
          {state.songs.length} partitura{state.songs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search with Suggestions */}
      <div className="relative flex gap-1.5 h-9" ref={suggestionsRef}>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8694a6]" />
          <input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="h-9 w-full rounded border border-[#c5cfdb] bg-white pl-9 pr-3 text-sm text-[#4d6075] placeholder-[#8e9fb3] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
            placeholder="Buscar partituras..."
            aria-label="Buscar partituras"
            autoComplete="off"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c5cfdb] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {suggestions.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSuggestionClick(song)}
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
                <th className="text-left px-3.5 py-2.5 font-bold w-1/3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {state.songs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-[#8b9db2]">
                      <FileMusic className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm">Nenhuma partitura encontrada</p>
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
                      onAddDirectory={() => handleAddDirectoryToSong(song.id)}
                      onEdit={() => {
                        setEditingSong(song);
                        setIsEditMusicModalOpen(true);
                      }}
                      menuId={`song-${song.id}`}
                      isMenuOpen={openMenuId === `song-${song.id}`}
                      onMenuOpen={(id) => setOpenMenuId(id)}
                      onMenuClose={closeAllMenus}
                    />
                    {state.selectedSong?.id === song.id &&
                      song.scores.map((score) => (
                        <MemoizedScoreRow
                          key={score.id}
                          score={score}
                          isSelected={state.selectedScore?.id === score.id}
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
