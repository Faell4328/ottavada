import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, FileMusic } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import toast from "react-hot-toast";

import * as api from "../api/commands";
import { useAppState } from "../context/AppContext";
import { useSearch } from "../hooks/useSearch";
import { compareInstrumentNames } from "../utils/instrumentOrder";
import { getErrorMessage } from "../utils/errors";
import { getDirectoryPath, isSamePath } from "../utils/paths";
import { getSidebarViewLabel } from "../utils/sidebarView";
import type { IndexedFile, ScoreListItem, SongListItem } from "../types";
import { AddScoreToSongModal } from "./AddScoreToSongModal.tsx";
import { EditMusicModal } from "./EditMusicModal";
import { EditScoreModal } from "./EditScoreModal";
import { MemoizedScoreRow } from "./ScoreRow";
import { MemoizedSongRow } from "./SongRow";

export default function SongsList() {
  const {
    state,
    setSearchQuery,
    selectSong,
    selectScore,
    toggleFavorite,
    loadSongs,
    updateSong,
    updateScore,
    updateScoreStatus,
    deleteScore,
    deleteSong,
  } = useAppState();

  const search = useSearch(setSearchQuery);
  const expandedSongIdRef = useRef<string | null>(null);
  const [editingSong, setEditingSong] = useState<SongListItem | null>(null);
  const [isEditMusicModalOpen, setIsEditMusicModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreListItem | null>(null);
  const [isEditScoreModalOpen, setIsEditScoreModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [songForAddFile, setSongForAddFile] = useState<SongListItem | null>(null);
  const [pendingFilesToAdd, setPendingFilesToAdd] = useState<IndexedFile[]>([]);
  const [existingScoresForAddFile, setExistingScoresForAddFile] = useState<ScoreListItem[]>([]);
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [scoresBySongId, setScoresBySongId] = useState<Record<string, ScoreListItem[]>>({});
  const [loadingScoresBySongId, setLoadingScoresBySongId] = useState<Record<string, boolean>>({});
  const isSyncLocked = state.isScanningFiles || state.rcloneProgress.direction !== null;

  const closeAllMenus = useCallback(() => setOpenMenuId(null), []);

  const clearSongScores = useCallback((songId: string) => {
    setScoresBySongId((prev) => {
      if (!(songId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[songId];
      return next;
    });

    setLoadingScoresBySongId((prev) => {
      if (!(songId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[songId];
      return next;
    });
  }, []);

  const loadSongScores = useCallback(
    async (songId: string, force = false) => {
      if (!force && scoresBySongId[songId]) {
        return scoresBySongId[songId];
      }

      expandedSongIdRef.current = songId;
      setLoadingScoresBySongId((prev) => ({ ...prev, [songId]: true }));

      try {
        const scores = await api.getScoresForSong(songId);
        const sortedScores = [...scores].sort((a, b) => compareInstrumentNames(a.name, b.name));

        setScoresBySongId((prev) => ({ ...prev, [songId]: sortedScores }));

        return sortedScores;
      } catch (err) {
        console.error("Failed to load scores for song:", err);
        toast.error("Erro ao carregar partituras da música");
        throw err;
      } finally {
        setLoadingScoresBySongId((prev) => ({ ...prev, [songId]: false }));
      }
    },
    [scoresBySongId]
  );

  const refreshScoresForSong = useCallback(
    async (songId: string | null) => {
      if (!songId || expandedSongIdRef.current !== songId) {
        return;
      }

      await loadSongScores(songId, true);
    },
    [loadSongScores]
  );

  const scrollSongIntoView = useCallback((songId: string) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`song-row-${songId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    });
  }, []);

  useEffect(() => {
    if (state.selectedSong) {
      return;
    }

    expandedSongIdRef.current = null;
    setScoresBySongId({});
    setLoadingScoresBySongId({});
  }, [state.selectedSong]);

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
    await refreshScoresForSong(data.songId);
  };

  const handleToggleSong = useCallback(
    async (song: SongListItem) => {
      const isExpanded = state.selectedSong?.id === song.id;

      if (isExpanded) {
        expandedSongIdRef.current = null;
        selectScore(null);
        selectSong(null);
        clearSongScores(song.id);
        closeAllMenus();
        return;
      }

      if (state.selectedSong?.id) {
        clearSongScores(state.selectedSong.id);
      }

      selectScore(null);
      selectSong(song);
      closeAllMenus();
      scrollSongIntoView(song.id);
      void (async () => {
        try {
          await loadSongScores(song.id);
        } catch {
          // loadSongScores já exibe o toast de erro.
        }
      })();
    },
    [
      clearSongScores,
      closeAllMenus,
      loadSongScores,
      scrollSongIntoView,
      selectScore,
      selectSong,
      state.selectedSong?.id,
    ]
  );

  const handleToggleScoreStatus = useCallback(
    async (songId: string, scoreId: string, status: "main") => {
      await updateScoreStatus(scoreId, status);
      await refreshScoresForSong(songId);
    },
    [refreshScoresForSong, updateScoreStatus]
  );

  const handleDeleteScore = useCallback(
    async (songId: string, scoreId: string) => {
      await deleteScore(scoreId);
      await refreshScoresForSong(songId);
    },
    [deleteScore, refreshScoresForSong]
  );

  async function handleSaveFilesToSong(files: IndexedFile[]) {
    if (!songForAddFile) {
      throw new Error("Música inválida para adicionar arquivo");
    }

    try {
      const updatedSong = await api.addScoresToSong(songForAddFile.id, files);
      search.clearSearch();
      await loadSongs();
      selectSong(updatedSong);
      setScoresBySongId((prev) => ({
        ...prev,
        [updatedSong.id]: [...updatedSong.scores].sort((a, b) => compareInstrumentNames(a.name, b.name)),
      }));
      toast.success(`${files.length} arquivo(s) adicionado(s) com sucesso`);
    } catch (err) {
      console.error("Failed to add file to song:", err);
      throw new Error(getErrorMessage(err));
    }
  }

  async function handleAddFileToSong(song: SongListItem) {
    try {
      const selected = await open({
        directory: false,
        multiple: true,
        filters: [{ name: "Partituras", extensions: ["pdf", "PDF", "mus", "MUS", "musx", "MUSX"] }],
      });

      if (!selected) return;

      const selectedPaths = Array.isArray(selected) ? selected : [selected];
      const indexedFiles: IndexedFile[] = [];

      for (const selectedPath of selectedPaths) {
        const directory = getDirectoryPath(selectedPath);
        const scannedFiles = await api.scanDirectory(directory);
        const indexedFile = scannedFiles.find((file) => isSamePath(file.path, selectedPath));

        if (!indexedFile) {
          toast.error("Não foi possível identificar um dos arquivos selecionados. Tente novamente.");
          return;
        }

        indexedFiles.push(indexedFile);
      }

      setSongForAddFile(song);
      const existingScores = await api.getScoresForSong(song.id);
      setExistingScoresForAddFile(existingScores);
      setPendingFilesToAdd(indexedFiles.map((file) => ({
        ...file,
        name: song.name,
      })));
      setIsAddFileModalOpen(true);
    } catch (err) {
      console.error("Failed to add file to song:", err);
      toast.error(`Erro ao adicionar partitura: ${getErrorMessage(err)}`);
    }
  }

  const sortedScoresBySongId = useMemo(() => {
    const map = new Map<string, ScoreListItem[]>();

    for (const [songId, scores] of Object.entries(scoresBySongId)) {
      map.set(songId, [...scores]);
    }

    return map;
  }, [scoresBySongId]);

  const getDisplayedScoresForSong = useCallback(
    (song: SongListItem) => {
      const cachedScores = sortedScoresBySongId.get(song.id);

      if (cachedScores) {
        return cachedScores;
      }

      return [...song.scores].sort((a, b) => compareInstrumentNames(a.name, b.name));
    },
    [sortedScoresBySongId]
  );

  const closeAddFileModal = () => {
    setIsAddFileModalOpen(false);
    setSongForAddFile(null);
    setPendingFilesToAdd([]);
    setExistingScoresForAddFile([]);
  };

  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-[#2f4259]">{getSidebarViewLabel(state.sidebarView)}</h2>
        <span className="text-xs text-[#6b849e]">
          {state.songs.length} música{state.songs.length !== 1 ? "s" : ""}
        </span>
      </div>

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

      <div className="overflow-hidden rounded border border-[#c8d1dc] bg-[#f8fafd] flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1 scroll-smooth">
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
                state.songs.map((song) => {
                  const displayedScores = getDisplayedScoresForSong(song);
                  const shouldShowLoadingRow =
                    state.selectedSong?.id === song.id &&
                    loadingScoresBySongId[song.id] &&
                    !sortedScoresBySongId.has(song.id) &&
                    song.scores.length === 0;

                  return (
                    <React.Fragment key={song.id}>
                      <MemoizedSongRow
                        song={song}
                        isExpanded={state.selectedSong?.id === song.id}
                        onToggle={() => {
                          void handleToggleSong(song);
                        }}
                        onToggleFavorite={() => toggleFavorite(song.id)}
                        onAddFile={() => handleAddFileToSong(song)}
                        onEdit={() => {
                          setEditingSong({
                            ...song,
                            category_ids: [...song.category_ids],
                            scores: [...song.scores],
                          });
                          setIsEditMusicModalOpen(true);
                        }}
                        onDelete={deleteSong}
                        menuId={`song-${song.id}`}
                        isMenuOpen={openMenuId === `song-${song.id}`}
                        onMenuOpen={(id) => setOpenMenuId(id)}
                        onMenuClose={closeAllMenus}
                        computerType={state.settings?.computer_type}
                        isLocked={isSyncLocked}
                      />
                      {state.selectedSong?.id === song.id &&
                        (shouldShowLoadingRow ? (
                          <tr>
                            <td colSpan={3} className="px-3.5 py-3 text-sm text-[#7b8da1] bg-[#f7f9fc]">
                              Carregando partituras...
                            </td>
                          </tr>
                        ) : (
                          displayedScores.map((score) => (
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
                              onStatusChange={async (scoreId, status) => {
                                await handleToggleScoreStatus(song.id, scoreId, status);
                              }}
                              onDelete={async (scoreId) => {
                                await handleDeleteScore(song.id, scoreId);
                              }}
                              computerType={state.settings?.computer_type}
                              isLocked={isSyncLocked}
                            />
                          ))
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditMusicModal
        isOpen={isEditMusicModalOpen}
        score={editingSong}
        onClose={() => {
          setIsEditMusicModalOpen(false);
          setEditingSong(null);
        }}
        onSave={handleSaveMusic}
      />

      <EditScoreModal
        isOpen={isEditScoreModalOpen}
        score={state.selectedSong}
        instrument={editingScore}
        onClose={() => {
          setIsEditScoreModalOpen(false);
          setEditingScore(null);
        }}
        onSave={handleSaveScore}
      />

      <AddScoreToSongModal
        isOpen={isAddFileModalOpen}
        songName={songForAddFile?.name ?? ""}
        files={pendingFilesToAdd}
        existingScores={existingScoresForAddFile}
        onClose={closeAddFileModal}
        onSave={handleSaveFilesToSong}
      />
    </section>
  );
}
