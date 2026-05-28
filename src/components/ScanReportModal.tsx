import { ListChecks } from "lucide-react";

import type { ScanResult } from "../api/commands";
import { Modal } from "./ui";

interface ScanReportModalProps {
  isOpen: boolean;
  report: ScanResult | null;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ScanReportModal({
  isOpen,
  report,
  isConfirming,
  onClose,
  onConfirm,
}: ScanReportModalProps) {
  if (!isOpen || !report) {
    return null;
  }

  const reportItems = report.report_items ?? [
    ...report.added_files.map((item) => `Partitura adicionada: ${item}`),
    ...report.changed_files.map((item) => `Partitura alterada: ${item}`),
    ...report.not_found_files.map((item) => `Partitura removida: ${item}`),
    ...report.recovered_files.map((item) => `Partitura recuperada: ${item}`),
    ...report.failed_files.map(([path, error]) => `Falha ao processar ${path}: ${error}`),
  ];
  const sections = groupReportItems(reportItems);
  const hasAnyChanges = sections.some((section) => section.items.length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Relatório da verificação"
      maxWidth="max-w-3xl"
      footer={(
        <div className="flex w-full justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg border border-[#c5cfdb] px-4 py-2 text-sm font-semibold text-[#344b61] transition-colors hover:bg-[#f2f5fa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-[#4f84d7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? "Aplicando..." : "Continuar"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {hasAnyChanges ? (
          <section className="rounded-xl border border-[#dbe5f0] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2f4259]">
              <span className="text-[#4f84d7]">
                <ListChecks className="h-4 w-4" />
              </span>
              Resumo das alterações
            </div>
            <div className="mt-3 space-y-4">
              {sections.map((section) => (
                <ReportSectionCard key={section.title} title={section.title} items={section.items} />
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d3deea] bg-white px-4 py-8 text-center text-sm text-[#60748d]">
            Nenhuma alteração encontrada.
          </div>
        )}
      </div>
    </Modal>
  );
}

type ReportSection = {
  title: string;
  items: string[];
};

type ScoreGroupMap = Map<string, string[]>;

function groupReportItems(reportItems: string[]): ReportSection[] {
  const songsCreated: string[] = [];
  const songsUpdated: string[] = [];
  const songsRemoved: string[] = [];
  const categoriesCreated: string[] = [];
  const categoriesRemoved: string[] = [];
  const composersUpdated: string[] = [];
  const composersRemoved: string[] = [];
  const arrangersUpdated: string[] = [];
  const arrangersRemoved: string[] = [];
  const scoresAdded = new Map<string, string[]>();
  const scoresChanged = new Map<string, string[]>();
  const scoresRemoved = new Map<string, string[]>();
  const otherItems: string[] = [];

  for (const item of reportItems) {
    const songCreatedMatch = item.match(/^Música criada:\s*(.+)$/);
    if (songCreatedMatch) {
      songsCreated.push(songCreatedMatch[1]);
      continue;
    }

    const songUpdatedMatch = item.match(/^Música alterada:\s*(.+)$/);
    if (songUpdatedMatch) {
      songsUpdated.push(songUpdatedMatch[1]);
      continue;
    }

    const songRemovedMatch = item.match(/^Música removida:\s*(.+)$/);
    if (songRemovedMatch) {
      songsRemoved.push(songRemovedMatch[1]);
      continue;
    }

    const categoryCreatedMatch = item.match(/^Categoria criada:\s*(.+)$/);
    if (categoryCreatedMatch) {
      categoriesCreated.push(categoryCreatedMatch[1]);
      continue;
    }

    const categoryRemovedMatch = item.match(/^Categoria removida:\s*(.+)$/);
    if (categoryRemovedMatch) {
      categoriesRemoved.push(categoryRemovedMatch[1]);
      continue;
    }

    const composerUpdatedMatch = item.match(/^Compositor da música\s+(.+?):\s*(.+)$/);
    if (composerUpdatedMatch) {
      composersUpdated.push(`${composerUpdatedMatch[1]}: ${composerUpdatedMatch[2]}`);
      continue;
    }

    const composerRemovedMatch = item.match(/^Compositor removido da música\s+(.+)$/);
    if (composerRemovedMatch) {
      composersRemoved.push(composerRemovedMatch[1]);
      continue;
    }

    const arrangerUpdatedMatch = item.match(/^Arranjador da música\s+(.+?):\s*(.+)$/);
    if (arrangerUpdatedMatch) {
      arrangersUpdated.push(`${arrangerUpdatedMatch[1]}: ${arrangerUpdatedMatch[2]}`);
      continue;
    }

    const arrangerRemovedMatch = item.match(/^Arranjador removido da música\s+(.+)$/);
    if (arrangerRemovedMatch) {
      arrangersRemoved.push(arrangerRemovedMatch[1]);
      continue;
    }

    const scoreAddedMatch = item.match(/^Partitura adicionada:\s*(.+)$/);
    if (scoreAddedMatch) {
      addScoreItem(scoresAdded, scoreAddedMatch[1]);
      continue;
    }

    const scoreChangedMatch = item.match(/^Partitura alterada:\s*(.+)$/);
    if (scoreChangedMatch) {
      addScoreItem(scoresChanged, scoreChangedMatch[1]);
      continue;
    }

    const scoreRemovedMatch = item.match(/^Partitura removida:\s*(.+)$/);
    if (scoreRemovedMatch) {
      addScoreItem(scoresRemoved, scoreRemovedMatch[1]);
      continue;
    }

    const recoveredMatch = item.match(/^Partitura recuperada:\s*(.+)$/);
    if (recoveredMatch) {
      otherItems.push(`Partitura recuperada: ${formatScoreLabel(recoveredMatch[1])}`);
      continue;
    }

    otherItems.push(item);
  }

  const sections: ReportSection[] = [
    { title: "Músicas criadas", items: songsCreated },
    { title: "Músicas alteradas", items: songsUpdated },
    { title: "Músicas removidas", items: songsRemoved },
    { title: "Partituras adicionadas", items: formatScoreGroups(scoresAdded) },
    { title: "Partituras alteradas", items: formatScoreGroups(scoresChanged) },
    { title: "Partituras removidas", items: formatScoreGroups(scoresRemoved) },
    { title: "Categorias criadas", items: categoriesCreated },
    { title: "Categorias removidas", items: categoriesRemoved },
    { title: "Compositores alterados", items: composersUpdated },
    { title: "Compositores removidos", items: composersRemoved },
    { title: "Arranjadores alterados", items: arrangersUpdated },
    { title: "Arranjadores removidos", items: arrangersRemoved },
    { title: "Outras alterações", items: otherItems },
  ];

  return sections.filter((section) => section.items.length > 0);
}

function addScoreItem(groups: ScoreGroupMap, rawPath: string) {
  const scoreInfo = parseScorePath(rawPath);
  const key = scoreInfo.songName;
  const current = groups.get(key) ?? [];
  current.push(scoreInfo.scoreName);
  groups.set(key, current);
}

function formatScoreGroups(groups: ScoreGroupMap): string[] {
  return Array.from(groups.entries()).map(([songName, scores]) => `${songName}: ${scores.join(", ")}`);
}

function parseScorePath(rawPath: string): { songName: string; scoreName: string } {
  const normalizedPath = rawPath.split("\\").join("/");
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  const fileNameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
  const parts = fileNameWithoutExtension.split(" - ");

  if (parts.length >= 2) {
    const [songName, ...rest] = parts;
    return {
      songName: songName.trim() || fileNameWithoutExtension,
      scoreName: rest.join(" - ").trim() || fileNameWithoutExtension,
    };
  }

  return {
    songName: fileNameWithoutExtension,
    scoreName: fileNameWithoutExtension,
  };
}

function formatScoreLabel(rawPath: string): string {
  const { songName, scoreName } = parseScorePath(rawPath);
  return `${scoreName} da música ${songName}`;
}

function ReportSectionCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-xl border border-[#dbe5f0] bg-white p-4">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[#2f4259]">
        <span>{title}</span>
        <span className="rounded-full bg-[#edf4fb] px-2 py-0.5 text-xs font-medium text-[#56718a]">
          {items.length}
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#4a6278]">
        {items.map((item) => (
          <li
            key={`${title}-${item}`}
            className="rounded-lg border border-[#e5edf6] bg-[#f9fbfe] px-3 py-2 break-all whitespace-normal"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

