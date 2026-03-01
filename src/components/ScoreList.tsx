import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, ChevronRight, Heart, FileMusic } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { ScoreListItem, ScoreFileItem } from "../types";

export default function ScoreList() {
  const { state, setSearchQuery, selectScore, selectFile, toggleFavorite } =
    useAppState();
  const [localQuery, setLocalQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localQuery, setSearchQuery]);

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

  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-[#2f4259]">{viewLabel}</h2>
        <span className="text-xs text-[#6b849e]">
          {state.scores.length} partitura{state.scores.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8694a6]" />
          <input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            className="h-9 w-full rounded border border-[#c5cfdb] bg-white pl-9 pr-3 text-sm text-[#4d6075] placeholder-[#8e9fb3] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
            placeholder="Buscar partituras..."
            aria-label="Buscar partituras"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-[#c8d1dc] bg-[#f8fafd] flex-1">
        {/* Header */}
        <div className="grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center border-b border-[#ced7e3] bg-[#eef2f6] px-3.5 py-2.5 text-xs font-bold text-[#34485d]">
          <span>Título</span>
          <span>Compositor / Arranjador</span>
          <span>Modificado</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#d8e0ea]">
          {state.scores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#8b9db2]">
              <FileMusic className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Nenhuma partitura encontrada</p>
              <p className="text-xs mt-1">
                Indexe um diretório para começar
              </p>
            </div>
          ) : (
            state.scores.map((score) => (
              <ScoreGroup
                key={score.id}
                score={score}
                isExpanded={state.selectedScore?.id === score.id}
                selectedFileId={state.selectedFile?.id ?? null}
                onToggle={() =>
                  selectScore(
                    state.selectedScore?.id === score.id ? null : score
                  )
                }
                onSelectFile={selectFile}
                onToggleFavorite={() => toggleFavorite(score.id)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ScoreGroup({
  score,
  isExpanded,
  selectedFileId,
  onToggle,
  onSelectFile,
  onToggleFavorite,
}: {
  score: ScoreListItem;
  isExpanded: boolean;
  selectedFileId: string | null;
  onToggle: () => void;
  onSelectFile: (file: ScoreFileItem | null) => void;
  onToggleFavorite: () => void;
}) {
  const author = [score.composer, score.arranger].filter(Boolean).join(" / ");

  return (
    <>
      <div
        className={`grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center px-3.5 py-2 text-[13px] text-[#344b61] ${
          isExpanded ? "bg-[#eef3f9] font-bold" : "hover:bg-[#f2f5fa]"
        } cursor-pointer transition-colors`}
        onClick={onToggle}
      >
        <span className="flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#7b8da1]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#7b8da1]" />
          )}
          <span className="font-bold">{score.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="ml-1 border-0 bg-transparent cursor-pointer p-0"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${
                score.favorited
                  ? "fill-red-400 text-red-400"
                  : "text-[#b0bfcf] hover:text-red-300"
              }`}
            />
          </button>
        </span>
        <span className="text-[#5c7089]">{author || "—"}</span>
        <span className="text-[#5c7089]">{formatDate(score.updated_at)}</span>
      </div>

      {isExpanded &&
        score.instruments.map((file) => (
          <div
            key={file.id}
            onClick={() =>
              onSelectFile(selectedFileId === file.id ? null : file)
            }
            className={`grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center px-3.5 py-1.5 pl-9 text-[13px] cursor-pointer transition-colors ${
              selectedFileId === file.id
                ? "bg-[#d8e6f5] text-[#1e3a5f]"
                : "bg-[#fbfdff] text-[#4a6278] hover:bg-[#f2f6fb]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileMusic className="h-3.5 w-3.5 text-[#8fa3b8]" />
              {file.instrument ?? "Sem instrumento"}
              {file.has_draft && (
                <span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-400" title="Rascunho ativo" />
              )}
            </span>
            <span className="text-xs text-[#8b9db2]">.{file.file_extension}</span>
            <span className="text-xs text-[#8b9db2]">
              {file.version_count} versão{file.version_count !== 1 ? "ões" : ""}
            </span>
          </div>
        ))}
    </>
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
