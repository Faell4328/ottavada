import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Search, FileMusic } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import * as api from "../api/commands";
import { useAppState } from "../context/AppContext";
import { compareInstrumentNames } from "../utils/instrumentOrder";
import { getSidebarViewLabel } from "../utils/sidebarView";
import { normalizeSearchText, songMatchesAuthorFilter, songMatchesSearchQuery } from "../utils/songSearch";
import type { ScoreListItem, SongListItem } from "../types";
import { EditMusicModal } from "./EditMusicModal";
import { EditScoreModal } from "./EditScoreModal";
import { UseAsBaseScoreModal } from "./UseAsBaseScoreModal";
import { MemoizedScoreRow } from "./ScoreRow";
import { MemoizedSongRow } from "./SongRow";

export default function SongsList() {
  const {
    state,
    loadSongs,
    refreshSelectedSong,
    setSearchQuery,
    selectSong,
    selectScore,
    toggleFavorite,
    updateSong,
    updateSongStatus,
    updateScore,
    updateScoreStatus,
    deleteScore,
    deleteSong,
    deleteSongWithFiles,
    useScoreAsBase,
  } = useAppState();

  const expandedSongIdRef = useRef<string | null>(null);
  const { t } = useTranslation();
  const [editingSong, setEditingSong] = useState<SongListItem | null>(null);
  const [isEditMusicModalOpen, setIsEditMusicModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreListItem | null>(null);
  const [isEditScoreModalOpen, setIsEditScoreModalOpen] = useState(false);
  const [baseScore, setBaseScore] = useState<ScoreListItem | null>(null);
  const [isUseAsBaseModalOpen, setIsUseAsBaseModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [scoresBySongId, setScoresBySongId] = useState<Record<string, ScoreListItem[]>>({});
  const [loadingScoresBySongId, setLoadingScoresBySongId] = useState<Record<string, boolean>>({});
  const [isSearchPending, startSearchTransition] = useTransition();
  const isSyncLocked =
    state.isScanningFiles ||
    state.rcloneProgress.active ||
    state.operationStatus.stepCurrent !== null;
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchText(state.searchQuery),
    [state.searchQuery]
  );
  const deferredSearchQuery = useDeferredValue(normalizedSearchQuery);

  const displayedSongs = useMemo(() => {
    return state.songs.filter((song) => {
      const matchesSearch = deferredSearchQuery ? songMatchesSearchQuery(song, deferredSearchQuery) : true;
      const matchesAuthors = songMatchesAuthorFilter(song, state.authorFilters);
      return matchesSearch && matchesAuthors;
    });
  }, [deferredSearchQuery, state.authorFilters, state.songs]);

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
          toast.error(t("scoreRow.statusChangeError"));
        throw err;
      } finally {
        setLoadingScoresBySongId((prev) => ({ ...prev, [songId]: false }));
      }
    },
    [scoresBySongId]
  );

  const sortScoresForDisplay = useCallback((scores: ScoreListItem[]) => {
    return [...scores].sort((a, b) => compareInstrumentNames(a.name, b.name));
  }, []);

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
    const selectedSong = state.selectedSong;

    if (selectedSong) {
      if (selectedSong.scores.length > 0) {
        setScoresBySongId((prev) => ({
          ...prev,
          [selectedSong.id]: sortScoresForDisplay(selectedSong.scores),
        }));
      }
      return;
    }

    expandedSongIdRef.current = null;
    setScoresBySongId({});
    setLoadingScoresBySongId({});
  }, [sortScoresForDisplay, state.selectedSong]);

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
  }) => {
    await updateScore(data.scoreFileId, data.instrumentName);
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
      void (async () => {
        try {
          await loadSongScores(song.id);
          scrollSongIntoView(song.id);
        } catch {
          // loadSongScores already shows the error toast.
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
    async (songId: string, scoreId: string, status: "main" | "draft" | "ignored") => {
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

  const getDisplayedScoresForSong = useCallback(
    (song: SongListItem) => {
      const cachedScores = scoresBySongId[song.id];

      if (cachedScores) {
        return cachedScores;
      }

      return [...song.scores].sort((a, b) => compareInstrumentNames(a.name, b.name));
    },
    [scoresBySongId]
  );

  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-[#2f4259]">{getSidebarViewLabel(state.sidebarView)}</h2>
        <span className="text-xs text-[#6b849e]">
          {t("songsList.songsCount", { count: displayedSongs.length })}
        </span>
      </div>

      <div className="relative flex gap-1.5 h-9">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8694a6]" />
          <input
            value={state.searchQuery}
            onChange={(e) => {
              const nextValue = e.target.value;
              startSearchTransition(() => {
                setSearchQuery(nextValue);
              });
            }}
            className="h-9 w-full rounded border border-[#c5cfdb] bg-white pl-9 pr-3 text-sm text-[#4d6075] placeholder-[#8e9fb3] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
            placeholder={t("songsList.filterPlaceholder")}
            aria-label={t("songsList.filterPlaceholder")}
            autoComplete="off"
          />
          {isSearchPending && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8e9fb3]">
              {t("songsList.filtering")}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded border border-[#c8d1dc] bg-[#f8fafd] flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1 scroll-smooth">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#ced7e3] bg-[#eef2f6] text-xs font-bold text-[#34485d] sticky top-0">
                <th className="text-left px-3.5 py-2.5 font-bold">{t("songsList.headerTitle")}</th>
                <th className="text-left px-3.5 py-2.5 font-bold">{t("songsList.headerAuthor")}</th>
                <th className="text-left px-3.5 py-2.5 font-bold">{t("songsList.headerCategory")}</th>
                <th className="text-left px-3.5 py-2.5 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {displayedSongs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-[#8b9db2]">
                      <FileMusic className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm">{t("songsList.noSongs")}</p>
                      <p className="text-xs mt-1">{t("songsList.noSongsHint")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedSongs.map((song) => {
                  const displayedScores = getDisplayedScoresForSong(song);
                  const shouldShowLoadingRow =
                    state.selectedSong?.id === song.id &&
                    loadingScoresBySongId[song.id] &&
                    !scoresBySongId[song.id] &&
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
                        onEdit={() => {
                          setEditingSong({
                            ...song,
                            category_ids: [...song.category_ids],
                            scores: [...song.scores],
                          });
                          setIsEditMusicModalOpen(true);
                        }}
                        onDelete={deleteSong}
                        onDeleteWithFiles={deleteSongWithFiles}
                        onStatusChange={updateSongStatus}
                        onReindex={async () => {
                          await loadSongs();
                          await refreshSelectedSong();
                        }}
                        menuId={`song-${song.id}`}
                        isMenuOpen={openMenuId === `song-${song.id}`}
                        onMenuOpen={(id) => setOpenMenuId(id)}
                        onMenuClose={closeAllMenus}
                        computerType={state.settings?.computer_type}
                        isLocked={isSyncLocked}
                        categories={state.categories}
                      />
                      {state.selectedSong?.id === song.id &&
                        (shouldShowLoadingRow ? (
                          <tr>
                            <td colSpan={4} className="px-3.5 py-3 text-sm text-[#7b8da1] bg-[#f7f9fc]">
                              {t("songsList.loadingScores")}
                            </td>
                          </tr>
                        ) : (
                          displayedScores.map((score, scoreIndex) => (
                            <MemoizedScoreRow
                              key={score.id}
                              score={score}
                              displayIndex={scoreIndex}
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
                              onUseAsBase={() => {
                                setBaseScore(score);
                                setIsUseAsBaseModalOpen(true);
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

      <UseAsBaseScoreModal
        isOpen={isUseAsBaseModalOpen}
        song={state.selectedSong}
        score={baseScore}
        onClose={() => {
          setIsUseAsBaseModalOpen(false);
          setBaseScore(null);
        }}
        onSave={async (sourceScoreId, newScoreName) => {
          try {
            await useScoreAsBase(sourceScoreId, newScoreName);
            setIsUseAsBaseModalOpen(false);
            setBaseScore(null);
          } catch (err) {
            console.error("Failed to use score as base:", err);
            toast.error(err instanceof Error ? err.message : t("useAsBaseScoreModal.saveError"));
            throw err;
          }
        }}
      />
    </section>
  );
}
