import { useState, useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, ChevronDown, ChevronRight, Heart, FileMusic, Plus, FolderPlus, Edit2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../context/AppContext";
import { EditMusicModal } from "./EditMusicModal";
import { EditInstrumentModal } from "./EditInstrumentModal";
import * as api from "../api/commands";
import toast from "react-hot-toast";
import type { ScoreListItem, ScoreFileItem } from "../types";

export default function ScoreList() {
  const { state, setSearchQuery, selectScore, selectFile, toggleFavorite, loadScores, updateScore, updateScoreFile } =
    useAppState();
  const [localQuery, setLocalQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ScoreListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreListItem | null>(null);
  const [isEditMusicModalOpen, setIsEditMusicModalOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<ScoreFileItem | null>(null);
  const [isEditInstrumentModalOpen, setIsEditInstrumentModalOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  // Handle click outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSuggestions]);

  // Flatten the scores with their instruments for virtualization
  const flatScores = useMemo(() => {
    const items: Array<{
      type: "score" | "instrument";
      score?: ScoreListItem;
      instrument?: ScoreFileItem;
      scoreId?: string;
    }> = [];

    state.scores.forEach((score) => {
      items.push({ type: "score", score });
      if (state.selectedScore?.id === score.id) {
        score.instruments.forEach((instrument) => {
          items.push({
            type: "instrument",
            score,
            instrument,
            scoreId: score.id,
          });
        });
      }
    });

    return items;
  }, [state.scores, state.selectedScore?.id]);

  const virtualizer = useVirtualizer({
    count: flatScores.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

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

  const handleSuggestionClick = (score: ScoreListItem) => {
    setLocalQuery(score.title);
    setShowSuggestions(false);
    setSearchQuery(score.title);
  };

  function getDirectoryPath(path: string) {
    const normalized = path.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) {
      return ".";
    }
    return normalized.slice(0, lastSlash);
  }

  async function handleAddFileToScore(scoreId: string) {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
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

      const selectedPath = Array.isArray(selected) ? selected[0] : selected;
      const directory = getDirectoryPath(selectedPath);
      const scannedFiles = await api.scanDirectory(directory);
      const indexed = scannedFiles.filter((file) => file.path === selectedPath);

      if (indexed.length > 0) {
        await api.addFileToScore(scoreId, indexed[0]);
        await loadScores();
        toast.success("Arquivo adicionado com sucesso");
      }
    } catch (err) {
      console.error("Failed to add file to score:", err);
      toast.error("Erro ao adicionar arquivo");
    }
  }

  async function handleAddDirectoryToScore(scoreId: string) {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected) {
        return;
      }

      const directory = selected as string;
      const files = await api.scanDirectory(directory);

      if (files.length === 0) {
        toast.error("Nenhuma partitura encontrada neste diretório");
        return;
      }

      await api.addFilesToScore(scoreId, files);
      await loadScores();
      toast.success(`${files.length} arquivo(s) adicionado(s) com sucesso`);
    } catch (err) {
      console.error("Failed to add directory to score:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro ao adicionar diretório";
      toast.error(errorMsg);
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-[#2f4259]">{viewLabel}</h2>
        <span className="text-xs text-[#6b849e]">
          {state.scores.length} partitura{state.scores.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search with Suggestions */}
      <div className="relative flex gap-1.5 flex-1 max-h-[40px]" ref={suggestionsRef}>
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
          
          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c5cfdb] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {suggestions.map((score) => (
                <button
                  key={score.id}
                  onClick={() => handleSuggestionClick(score)}
                  className="w-full text-left px-3 py-2 hover:bg-[#f2f5fa] border-b border-[#e8ecf0] last:border-b-0 text-sm text-[#344b61] transition-colors"
                >
                  <div className="font-medium">{score.title}</div>
                  <div className="text-xs text-[#8b9db2]">
                    {[score.composer, score.arranger].filter(Boolean).join(" / ") || "Sem informações"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-[#c8d1dc] bg-[#f8fafd] flex-1 flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center border-b border-[#ced7e3] bg-[#eef2f6] px-3.5 py-2.5 text-xs font-bold text-[#34485d] flex-shrink-0">
          <span>Título</span>
          <span>Compositor / Arranjador</span>
          <span>Modificado</span>
        </div>

        {/* Virtualized Rows */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
        >
          {state.scores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#8b9db2]">
              <FileMusic className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Nenhuma partitura encontrada</p>
              <p className="text-xs mt-1">
                Indexe um diretório para começar
              </p>
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = flatScores[virtualItem.index];
                if (!item) return null;
                
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {item.type === "score" && item.score ? (
                      <ScoreRow
                        score={item.score}
                        isExpanded={state.selectedScore?.id === item.score.id}
                        onToggle={() => {
                          selectScore(
                            state.selectedScore?.id === item.score?.id
                              ? null
                              : item.score ?? null
                          );
                        }}
                        onToggleFavorite={() => {
                          if (item.score) toggleFavorite(item.score.id);
                        }}
                        onAddFile={() => {
                          if (item.score) handleAddFileToScore(item.score.id);
                        }}
                        onAddDirectory={() => {
                          if (item.score) handleAddDirectoryToScore(item.score.id);
                        }}
                        onEdit={() => {
                          setEditingScore(item.score ?? null);
                          setIsEditMusicModalOpen(true);
                        }}
                      />
                    ) : item.type === "instrument" && item.instrument && item.score ? (
                      (() => {
                        const instrument = item.instrument;
                        return (
                          <InstrumentRow
                            instrument={instrument}
                            isSelected={state.selectedFile?.id === instrument.id}
                            onSelectFile={() =>
                              selectFile(
                                state.selectedFile?.id === instrument.id
                                  ? null
                                  : instrument
                              )
                            }
                            onEdit={() => {
                              setEditingInstrument(instrument);
                              setIsEditInstrumentModalOpen(true);
                            }}
                          />
                        );
                      })()
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Music Modal */}
      <EditMusicModal
        isOpen={isEditMusicModalOpen}
        score={editingScore}
        onClose={() => {
          setIsEditMusicModalOpen(false);
          setEditingScore(null);
        }}
        onSave={updateScore}
      />

      {/* Edit Instrument Modal */}
      <EditInstrumentModal
        isOpen={isEditInstrumentModalOpen}
        instrument={editingInstrument}
        onClose={() => {
          setIsEditInstrumentModalOpen(false);
          setEditingInstrument(null);
        }}
        onSave={updateScoreFile}
      />
    </section>
  );
}

function ScoreRow({
  score,
  isExpanded,
  onToggle,
  onToggleFavorite,
  onAddFile,
  onAddDirectory,
  onEdit,
}: {
  score: ScoreListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onAddFile: () => void;
  onAddDirectory: () => void;
  onEdit: () => void;
}) {
  const author = [score.composer, score.arranger].filter(Boolean).join(" / ");

  return (
    <div
      className={`grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center px-3.5 py-2 text-[13px] text-[#344b61] h-full ${
        isExpanded ? "bg-[#eef3f9] font-bold" : "hover:bg-[#f2f5fa]"
      } cursor-pointer transition-colors divide-y divide-[#d8e0ea]`}
      onClick={onToggle}
    >
      <span className="flex items-center gap-2">
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[#7b8da1] flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[#7b8da1] flex-shrink-0" />
        )}
        <span className="font-bold truncate">{score.title}</span>

        {/* Action Buttons - só aparecem ao passar o mouse */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="p-1 rounded transition-colors hover:bg-white/10"
            title={score.favorited ? "Remover de favoritos" : "Adicionar aos favoritos"}
          >
            <Heart
              className={`h-4 w-4 ${
                score.favorited
                  ? "fill-red-400 text-red-400"
                  : "text-[#8b9db2] hover:text-red-300"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddFile();
            }}
            className="p-1 rounded transition-colors hover:bg-white/10 hover:text-[#5c9ae6]"
            title="Adicionar arquivo"
          >
            <Plus className="h-4 w-4 text-[#8b9db2]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddDirectory();
            }}
            className="p-1 rounded transition-colors hover:bg-white/10 hover:text-[#5c9ae6]"
            title="Adicionar diretório"
          >
            <FolderPlus className="h-4 w-4 text-[#8b9db2]" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded transition-colors hover:bg-white/10 hover:text-[#5c9ae6]"
            title="Editar música"
          >
            <Edit2 className="h-4 w-4 text-[#8b9db2]" />
          </button>
        </div>
      </span>
      <span className="text-[#5c7089]">{author || "—"}</span>
      <span className="text-[#5c7089]">{formatDate(score.updated_at)}</span>
    </div>
  );
}

function InstrumentRow({
  instrument,
  isSelected,
  onSelectFile,
  onEdit,
}: {
  instrument: ScoreFileItem;
  isSelected: boolean;
  onSelectFile: () => void;
  onEdit: () => void;
}) {
  const [isOpening, setIsOpening] = useState(false);

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpening(true);
    try {
      await api.openFile(instrument.id);
    } catch (err) {
      console.error("Failed to open file:", err);
      toast.error("Erro ao abrir arquivo");
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div
      onClick={onSelectFile}
      onDoubleClick={handleDoubleClick}
      title={isOpening ? "Abrindo arquivo..." : "Duplo clique para abrir"}
      className={`grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center px-3.5 py-1.5 pl-9 text-[13px] cursor-pointer transition-colors h-full ${
        isSelected
          ? "bg-[#d8e6f5] text-[#1e3a5f]"
          : "bg-[#fbfdff] text-[#4a6278] hover:bg-[#f2f6fb]"
      } ${isOpening ? "opacity-60" : ""}`}
    >
      <span className="flex items-center gap-1.5">
        <FileMusic className={`h-3.5 w-3.5 text-[#8fa3b8] ${isOpening ? "animate-pulse" : ""}`} />
        {instrument.instrument ?? "Sem instrumento"}
        {instrument.has_draft && (
          <span
            className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-400"
            title="Rascunho ativo"
          />
        )}
        {/* Edit button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="ml-auto p-1 rounded transition-colors hover:bg-white/10 hover:text-[#5c9ae6]"
          title="Editar partitura"
        >
          <Edit2 className="h-3.5 w-3.5 text-[#8b9db2]" />
        </button>
      </span>
      <span className="text-xs text-[#8b9db2]">.{instrument.file_extension}</span>
      <span className="text-xs text-[#8b9db2]">
        {instrument.version_count} versão
        {instrument.version_count !== 1 ? "ões" : ""}
      </span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Hoje ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffDays === 1) {
      return `Ontem ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}
