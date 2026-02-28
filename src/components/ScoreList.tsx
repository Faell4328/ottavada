import type { ScoreRow } from "../types";

interface ScoreListProps {
  rows: ScoreRow[];
}

export default function ScoreList({ rows }: ScoreListProps) {
  return (
    <section className="flex flex-1 flex-col gap-2.5 bg-[#edf1f6] p-3.5 border-r border-[#c8d1dc] overflow-auto">
      <SearchBar />
      <ScoreTable rows={rows} />
    </section>
  );
}

function SearchBar() {
  return (
    <div className="flex gap-1.5">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8694a6] text-sm">🔍</span>
        <input
          className="h-9 w-full rounded border border-[#c5cfdb] bg-white pl-9 pr-3 text-sm text-[#4d6075] placeholder-[#8e9fb3] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
          placeholder="Buscar partituras..."
          aria-label="Buscar partituras"
        />
      </div>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded border border-[#c5cfdb] bg-white text-sm text-[#4d6075] hover:bg-[#f0f4f8] transition-colors cursor-pointer"
      >
        ▾
      </button>
    </div>
  );
}

function ScoreTable({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="overflow-hidden rounded border border-[#c8d1dc] bg-[#f8fafd] flex-1">
      {/* Header */}
      <div className="grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center border-b border-[#ced7e3] bg-[#eef2f6] px-3.5 py-2.5 text-xs font-bold text-[#34485d]">
        <span>Título</span>
        <span>Autor / Arranjador</span>
        <span>Modificado</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#d8e0ea]">
        {rows.map((row) => (
          <ScoreGroup key={row.title} row={row} />
        ))}
      </div>
    </div>
  );
}

function ScoreGroup({ row }: { row: ScoreRow }) {
  return (
    <>
      <div
        className={`grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center px-3.5 py-2 text-[13px] text-[#344b61] ${
          row.expanded ? "bg-[#eef3f9] font-bold" : "hover:bg-[#f2f5fa]"
        } cursor-pointer transition-colors`}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#7b8da1]">
            {row.expanded ? "▼" : "▸"}
          </span>
          <span className="font-bold">{row.title}</span>
        </span>
        <span className="text-[#5c7089]">{row.author}</span>
        <span className="flex items-center justify-between text-[#5c7089]">
          {row.modified}
          {row.expanded && (
            <span className="text-[10px] text-[#8b9db2]">›</span>
          )}
        </span>
      </div>

      {row.expanded &&
        row.children?.map((child) => (
          <div
            key={child.title}
            className="grid grid-cols-[1.5fr_0.9fr_0.6fr] items-center bg-[#fbfdff] px-3.5 py-1.5 pl-9 text-[13px] text-[#4a6278] hover:bg-[#f2f6fb] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#8fa3b8]">▸</span>
              {child.title}
            </span>
            <span>{child.author}</span>
            <span>{child.modified}</span>
          </div>
        ))}
    </>
  );
}
