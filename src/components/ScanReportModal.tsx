import { ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import type { ScanResult } from "../api/commands";
import { compareInstrumentNames } from "../utils/instrumentOrder";
import { normalizeScoreNameForSave, normalizeSongNameForSave } from "../utils/nameFormat";
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
    ...report.deleted_files.map((item) => `A partitura ${item} foi deletada.`),
    ...report.recovered_files.map((item) => `Partitura recuperada: ${item}`),
    ...report.failed_files.map(([path, error]) => `Falha ao processar ${path}: ${error}`),
  ];
  const sections = buildReviewSections(reportItems);
  const hasAnyChanges = sections.some((section) => section.groups.length > 0);

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
              Revisão das alterações
            </div>
            <div className="mt-3 space-y-4">
              {sections.map((section) => (
                <ActionSectionCard key={section.title} title={section.title} groups={section.groups} />
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

type ReviewAction = "adding" | "modified" | "deleted";
type ReviewEntity = "category" | "composer" | "arranger" | "song" | "score" | "other";

type ReviewItem = {
  action: ReviewAction;
  entity: ReviewEntity;
  songName?: string;
  scoreName?: string;
  value?: string;
  customText?: string;
  raw: string;
};

type EntityGroup = {
  title: string;
  items: ReactNode[];
};

type ReviewSection = {
  title: string;
  groups: EntityGroup[];
};

function buildReviewSections(reportItems: string[]): ReviewSection[] {
  const parsedItems = coalesceExtensionOnlyScoreChanges(
    coalesceScoreRenameAdditions(
      dedupeReviewItems(reportItems.map(parseReviewItem).filter((item): item is ReviewItem => item !== null))
    )
  );
  const createdSongNames = new Set(parsedItems.filter((item) => item.entity === "song" && item.action === "adding").map((item) => normalizeKey(item.songName ?? item.value ?? item.raw)));
  const modifiedSongNames = new Set(parsedItems.filter((item) => item.entity === "song" && item.action === "modified").map((item) => normalizeKey(item.songName ?? item.value ?? item.raw)));
  const deletedSongNames = new Set(parsedItems.filter((item) => item.entity === "song" && item.action === "deleted").map((item) => normalizeKey(item.songName ?? item.value ?? item.raw)));

  const sections: ReviewSection[] = [
    {
      title: "Adicionando",
      groups: buildActionGroups(parsedItems, "adding", { createdSongNames, modifiedSongNames, deletedSongNames }),
    },
    {
      title: "Modificado",
      groups: buildActionGroups(parsedItems, "modified", { createdSongNames, modifiedSongNames, deletedSongNames }),
    },
    {
      title: "Deletado",
      groups: buildActionGroups(parsedItems, "deleted", { createdSongNames, modifiedSongNames, deletedSongNames }),
    },
  ];

  return sections.filter((section) => section.groups.length > 0);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseReviewItem(raw: string): ReviewItem | null {
  const songCreatedMatch = raw.match(/^Música criada:\s*(.+)$/);
  if (songCreatedMatch) {
    return { action: "adding", entity: "song", songName: songCreatedMatch[1].trim(), raw };
  }

  const songRenamedMatch = raw.match(/^A música\s+(.+?)\s+teve o nome alterado\.$/);
  if (songRenamedMatch) {
    return {
      action: "modified",
      entity: "song",
      songName: songRenamedMatch[1].trim(),
      customText: raw,
      raw,
    };
  }

  const songUpdatedMatch = raw.match(/^Música alterada:\s*(.+)$/);
  if (songUpdatedMatch) {
    return { action: "modified", entity: "song", songName: songUpdatedMatch[1].trim(), raw };
  }

  const songRemovedMatch = raw.match(/^A música\s+(.+?)\s+foi deletada\.$/);
  if (songRemovedMatch) {
    return { action: "deleted", entity: "song", songName: songRemovedMatch[1].trim(), raw };
  }

  const categoryCreatedMatch = raw.match(/^Categoria criada:\s*(.+)$/);
  if (categoryCreatedMatch) {
    return { action: "adding", entity: "category", value: categoryCreatedMatch[1].trim(), raw };
  }

  const categoryAddedToSongMatch = raw.match(/^A categoria\s+(.+?)\s+foi adicionada à música\s+(.+)\.$/);
  if (categoryAddedToSongMatch) {
    if (categoryAddedToSongMatch[1].trim().toLowerCase() === "sem categoria") {
      return null;
    }

    return {
      action: "adding",
      entity: "category",
      value: categoryAddedToSongMatch[1].trim(),
      songName: categoryAddedToSongMatch[2].trim(),
      raw,
    };
  }

  const categoryRemovedMatch = raw.match(/^A categoria\s+(.+?)\s+foi deletada\.$/);
  if (categoryRemovedMatch) {
    return { action: "deleted", entity: "category", value: categoryRemovedMatch[1].trim(), raw };
  }

  const categoryRemovedFromSongMatch = raw.match(/^A categoria\s+(.+?)\s+foi removida da música\s+(.+)\.$/);
  if (categoryRemovedFromSongMatch) {
    if (categoryRemovedFromSongMatch[1].trim().toLowerCase() === "sem categoria") {
      return null;
    }

    return {
      action: "deleted",
      entity: "category",
      value: categoryRemovedFromSongMatch[1].trim(),
      songName: categoryRemovedFromSongMatch[2].trim(),
      raw,
    };
  }

  const composerAddedMatch = raw.match(/^O compositor\s+(.+?)\s+foi adicionado à música\s+(.+)\.$/);
  if (composerAddedMatch) {
    return { action: "adding", entity: "composer", songName: composerAddedMatch[2].trim(), value: composerAddedMatch[1].trim(), raw };
  }

  const composerRemovedMatch = raw.match(/^O compositor\s+(.+?)\s+foi deletado da música\s+(.+)\.$/);
  if (composerRemovedMatch) {
    return { action: "deleted", entity: "composer", songName: composerRemovedMatch[2].trim(), value: composerRemovedMatch[1].trim(), raw };
  }

  const arrangerAddedMatch = raw.match(/^O arranjador\s+(.+?)\s+foi adicionado à música\s+(.+)\.$/);
  if (arrangerAddedMatch) {
    return { action: "adding", entity: "arranger", songName: arrangerAddedMatch[2].trim(), value: arrangerAddedMatch[1].trim(), raw };
  }

  const arrangerRemovedMatch = raw.match(/^O arranjador\s+(.+?)\s+foi deletado da música\s+(.+)\.$/);
  if (arrangerRemovedMatch) {
    return { action: "deleted", entity: "arranger", songName: arrangerRemovedMatch[2].trim(), value: arrangerRemovedMatch[1].trim(), raw };
  }

  const scoreAddedMatch = raw.match(/^Partitura adicionada:\s*(.+)$/);
  if (scoreAddedMatch) {
    const parsed = parseScoreReference(scoreAddedMatch[1].trim());
    return { action: "adding", entity: "score", songName: parsed.songName, scoreName: parsed.scoreName, raw };
  }

  const scoreChangedMatch = raw.match(/^Partitura alterada:\s*(.+)$/);
  if (scoreChangedMatch) {
    const parsed = parseScoreReference(scoreChangedMatch[1].trim());
    return { action: "modified", entity: "score", songName: parsed.songName, scoreName: parsed.scoreName, raw };
  }

  const scoreRenamedMatch = raw.match(/^A partitura\s+(.+?)\s+teve o nome alterado\.$/);
  if (scoreRenamedMatch) {
    return {
      action: "modified",
      entity: "score",
      scoreName: scoreRenamedMatch[1].trim(),
      customText: raw,
      raw,
    };
  }

  const scoreRenamedWithSongMatch = raw.match(/^A partitura\s+(.+?)\s+teve o nome alterado na música\s+(.+)\.$/);
  if (scoreRenamedWithSongMatch) {
    return {
      action: "modified",
      entity: "score",
      scoreName: scoreRenamedWithSongMatch[1].trim(),
      songName: scoreRenamedWithSongMatch[2].trim(),
      customText: raw,
      raw,
    };
  }

  const scoreRemovedMatch = raw.match(/^A partitura\s+(.+?)\s+foi deletada\.$/);
  if (scoreRemovedMatch) {
    const parsed = parseScoreReference(scoreRemovedMatch[1].trim());
    return { action: "deleted", entity: "score", songName: parsed.songName, scoreName: parsed.scoreName, raw };
  }

  const scoreExtensionOnlyMatch = raw.match(/^A partitura\s+(.+?)\s+teve a extensão alterada na música\s+(.+)\.$/);
  if (scoreExtensionOnlyMatch) {
    return {
      action: "modified",
      entity: "score",
      scoreName: scoreExtensionOnlyMatch[1].trim(),
      songName: scoreExtensionOnlyMatch[2].trim(),
      customText: raw,
      raw,
    };
  }

  const recoveredMatch = raw.match(/^Partitura recuperada:\s*(.+)$/);
  if (recoveredMatch) {
    const parsed = parseScoreReference(recoveredMatch[1].trim());
    const isStandaloneScoreName = parsed.songName === parsed.scoreName;
    return {
      action: "modified",
      entity: "score",
      songName: parsed.songName,
      scoreName: parsed.scoreName,
      customText: isStandaloneScoreName
        ? `A partitura ${parsed.scoreName} saiu de draft e voltou para main.`
        : `A partitura ${parsed.scoreName} saiu de draft e voltou para main na música ${parsed.songName}.`,
      raw,
    };
  }

  const statusChangeMatch = raw.match(/^A partitura\s+(.+?)\s+saiu de\s+(.+?)\s+e\s+(?:voltou para main|foi para\s+(.+?))\s+na música\s+(.+)\.$/);
  if (statusChangeMatch) {
    return {
      action: "modified",
      entity: "score",
      songName: statusChangeMatch[4].trim(),
      scoreName: statusChangeMatch[1].trim(),
      customText: raw,
      raw,
    };
  }

  return null;
}

function dedupeReviewItems(items: ReviewItem[]): ReviewItem[] {
  const seen = new Set<string>();
  const deduped: ReviewItem[] = [];

  for (const item of items) {
    const key = `${item.action}|${item.entity}|${item.songName ?? ""}|${item.scoreName ?? ""}|${item.value ?? ""}|${item.customText ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function coalesceExtensionOnlyScoreChanges(items: ReviewItem[]): ReviewItem[] {
  const additionsByKey = new Map<string, ReviewItem[]>();
  const deletionsByKey = new Map<string, ReviewItem[]>();

  for (const item of items) {
    if (item.entity !== "score" || !item.scoreName) {
      continue;
    }

    const keys = buildScoreChangeKeys(item.songName, item.scoreName);
    if (item.action === "adding") {
      for (const key of keys) {
        additionsByKey.set(key, [...(additionsByKey.get(key) ?? []), item]);
      }
    }

    if (item.action === "deleted") {
      for (const key of keys) {
        deletionsByKey.set(key, [...(deletionsByKey.get(key) ?? []), item]);
      }
    }
  }

  const consumed = new Set<ReviewItem>();
  const result: ReviewItem[] = [];

  for (const item of items) {
    if (consumed.has(item)) {
      continue;
    }

    if (item.entity !== "score" || !item.scoreName || item.action === "modified") {
      result.push(item);
      continue;
    }

    const partnerBucket = item.action === "adding" ? deletionsByKey : additionsByKey;
    const partner = findMatchingScorePartner(partnerBucket, item.songName, item.scoreName);

    if (partner) {
      consumed.add(partner);
      result.push({
        action: "modified",
        entity: "score",
        songName: item.songName ?? partner.songName,
        scoreName: item.scoreName,
        customText: buildExtensionOnlyScoreChangeText(item.songName ?? partner.songName ?? "", item.scoreName),
        raw: `${partner.raw} || ${item.raw}`,
      });
      continue;
    }

    result.push(item);
  }

  return result;
}

function coalesceScoreRenameAdditions(items: ReviewItem[]): ReviewItem[] {
  const renameKeys = new Set<string>();

  for (const item of items) {
    if (item.entity !== "score" || item.action !== "modified" || !item.scoreName || !item.songName) {
      continue;
    }

    if (!item.customText?.includes("teve o nome alterado")) {
      continue;
    }

    renameKeys.add(`${normalizeKey(item.songName)}|${normalizeKey(stripFileExtension(item.scoreName))}`);
  }

  return items.filter((item) => {
    if (item.entity !== "score" || item.action !== "adding" || !item.scoreName || !item.songName) {
      return true;
    }

    const key = `${normalizeKey(item.songName)}|${normalizeKey(stripFileExtension(item.scoreName))}`;
    return !renameKeys.has(key);
  });
}

function buildScoreChangeKeys(songName: string | undefined, scoreName: string): string[] {
  const normalizedScoreName = normalizeKey(stripFileExtension(scoreName));
  const normalizedSongName = normalizeKey(songName ?? "");

  if (!normalizedSongName) {
    return [normalizedScoreName];
  }

  return [`${normalizedSongName}|${normalizedScoreName}`, normalizedScoreName];
}

function findMatchingScorePartner(
  bucket: Map<string, ReviewItem[]>,
  songName: string | undefined,
  scoreName: string
): ReviewItem | undefined {
  for (const key of buildScoreChangeKeys(songName, scoreName)) {
    const partner = bucket.get(key)?.shift();
    if (partner) {
      return partner;
    }
  }

  return undefined;
}

function stripFileExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "");
}

function buildExtensionOnlyScoreChangeText(songName: string, scoreName: string): string {
  return `A partitura ${scoreName} teve a extensão alterada na música ${songName}.`;
}

function buildActionGroups(
  items: ReviewItem[],
  action: ReviewAction,
  songSets: {
    createdSongNames: Set<string>;
    modifiedSongNames: Set<string>;
    deletedSongNames: Set<string>;
  }
): EntityGroup[] {
  const categoryItems: ReactNode[] = [];
  const composerItems: ReactNode[] = [];
  const arrangerItems: ReactNode[] = [];
  const songItems: ReactNode[] = [];
  const scoreGroups = new Map<string, { action: ReviewAction; songName: string; scoreNames: string[] }>();
  const scoreOrder: Array<{ kind: "group"; key: string } | { kind: "custom"; item: ReviewItem }> = [];

  const matchingItems = items.filter((item) => item.action === action);

  for (const item of matchingItems) {
    if (item.entity === "category") {
      categoryItems.push(renderCategoryItem(action, item.value ?? item.raw, item.songName));
      continue;
    }

    if (item.entity === "composer") {
      const songName = item.songName ?? item.raw;
      const resolvedAction = resolveEntityAction(action, songName, songSets);
      composerItems.push(renderPersonItem("compositor", resolvedAction, item.value, songName));
      continue;
    }

    if (item.entity === "arranger") {
      const songName = item.songName ?? item.raw;
      const resolvedAction = resolveEntityAction(action, songName, songSets);
      arrangerItems.push(renderPersonItem("arranjador", resolvedAction, item.value, songName));
      continue;
    }

    if (item.entity === "song") {
      songItems.push(item.customText ? renderCustomSongText(item.customText) : formatSongItem(action, item.songName ?? item.value ?? item.raw));
      continue;
    }

    if (item.entity === "score") {
      if (item.customText) {
        scoreOrder.push({ kind: "custom", item });
        continue;
      }

      const songName = item.songName ?? item.scoreName ?? item.raw;
      const scoreName = item.scoreName ?? item.raw;
      const key = `${action}|${normalizeKey(songName)}`;
      const group = scoreGroups.get(key);

      if (group) {
        if (!group.scoreNames.some((existingName) => normalizeKey(existingName) === normalizeKey(scoreName))) {
          group.scoreNames.push(scoreName);
          group.scoreNames.sort((a, b) => compareInstrumentNames(formatScoreDisplayName(a), formatScoreDisplayName(b)));
        }
      } else {
        scoreGroups.set(key, { action, songName, scoreNames: [scoreName] });
        scoreOrder.push({ kind: "group", key });
      }
    }
  }

  const scoreItems: ReactNode[] = [];
  for (const entry of scoreOrder) {
    if (entry.kind === "custom") {
      scoreItems.push(renderCustomScoreText(entry.item.customText ?? entry.item.raw));
      continue;
    }

    const group = scoreGroups.get(entry.key);
    if (!group) {
      continue;
    }

    if (group.scoreNames.length === 1) {
      scoreItems.push(renderScoreItem(action, group.scoreNames[0], group.songName));
      continue;
    }

    scoreItems.push(renderGroupedScoreItem(action, group.songName, group.scoreNames));
  }

  const groups: EntityGroup[] = [];

  if (categoryItems.length > 0) {
    groups.push({ title: "Categorias", items: categoryItems });
  }

  if (composerItems.length > 0) {
    groups.push({ title: "Compositores", items: composerItems });
  }

  if (arrangerItems.length > 0) {
    groups.push({ title: "Arranjadores", items: arrangerItems });
  }

  if (songItems.length > 0) {
    groups.push({ title: "Músicas", items: songItems });
  }

  if (scoreItems.length > 0) {
    groups.push({ title: "Partituras", items: scoreItems });
  }

  return groups;
}

function resolveEntityAction(
  fallbackAction: ReviewAction,
  songName: string,
  songSets: {
    createdSongNames: Set<string>;
    modifiedSongNames: Set<string>;
    deletedSongNames: Set<string>;
  }
): ReviewAction {
  const normalizedSongName = normalizeKey(songName);

  if (fallbackAction === "deleted") {
    return "deleted";
  }

  if (songSets.createdSongNames.has(normalizedSongName)) {
    return "adding";
  }

  if (songSets.deletedSongNames.has(normalizedSongName)) {
    return "deleted";
  }

  if (songSets.modifiedSongNames.has(normalizedSongName)) {
    return "modified";
  }

  return fallbackAction;
}

function renderCategoryItem(action: ReviewAction, categoryName: string, songName?: string): ReactNode {
  if (action === "adding") {
    if (songName) {
      return (
        <>
          A categoria <strong>{categoryName}</strong> foi adicionada à música <strong>{songName}</strong>.
        </>
      );
    }

    return (
      <>
        A categoria <strong>{categoryName}</strong> foi adicionada.
      </>
    );
  }

  if (action === "deleted") {
    if (songName) {
      return (
        <>
          A categoria <strong>{categoryName}</strong> foi removida da música <strong>{songName}</strong>.
        </>
      );
    }

    return (
      <>
        A categoria <strong>{categoryName}</strong> foi deletada.
      </>
    );
  }

  return (
    <>
      A categoria <strong>{categoryName}</strong> foi modificada.
    </>
  );
}

function renderPersonItem(
  role: "compositor" | "arranjador",
  action: ReviewAction,
  value: string | undefined,
  songName: string
): ReactNode {
  const personName = value ?? "sem nome";

  if (action === "adding") {
    return (
      <>
        O {role} <strong>{personName}</strong> foi adicionado à música {songName}.
      </>
    );
  }

  if (action === "deleted") {
    return (
      <>
        O {role} <strong>{personName}</strong> foi deletado da música {songName}.
      </>
    );
  }

  return (
    <>
      O {role} <strong>{personName}</strong> foi modificado na música {songName}.
    </>
  );
}

function formatSongItem(action: ReviewAction, songName: string): ReactNode {
  if (action === "adding") {
    return (
      <>
        A música <strong>{songName}</strong> foi adicionada.
      </>
    );
  }

  if (action === "deleted") {
    return (
      <>
        A música <strong>{songName}</strong> foi deletada.
      </>
    );
  }

  return (
    <>
      A música <strong>{songName}</strong> foi modificada.
    </>
  );
}

function renderCustomSongText(text: string): ReactNode {
  const match = text.match(/^A música\s+(.+?)\s+teve o nome alterado\.$/);
  if (!match) {
    return text;
  }

  return (
    <>
      A música <strong>{match[1]}</strong> teve o nome alterado.
    </>
  );
}

function renderScoreItem(action: ReviewAction, scoreName: string, songName: string): ReactNode {
  scoreName = formatScoreDisplayName(scoreName);
  const isStandaloneScoreName = normalizeKey(scoreName) === normalizeKey(songName);

  if (action === "adding") {
    if (isStandaloneScoreName) {
      return (
        <>
          A partitura <strong>{scoreName}</strong> foi adicionada.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{scoreName}</strong> foi adicionada na música <strong>{songName}</strong>.
      </>
    );
  }

  if (action === "deleted") {
    if (isStandaloneScoreName) {
      return (
        <>
          A partitura <strong>{scoreName}</strong> foi deletada.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{scoreName}</strong> foi deletada na música <strong>{songName}</strong>.
      </>
    );
  }

  if (isStandaloneScoreName) {
    return (
      <>
        A partitura <strong>{scoreName}</strong> foi alterada.
      </>
    );
  }

  return (
    <>
      A partitura <strong>{scoreName}</strong> foi alterada na música <strong>{songName}</strong>.
    </>
  );
}

function renderGroupedScoreItem(action: ReviewAction, songName: string, scoreNames: string[]): ReactNode {
  const scoreList = joinStrongList(scoreNames.map(formatScoreDisplayName));
  const noun = scoreNames.length === 1 ? "A partitura" : "As partituras";

  if (action === "adding") {
    return songName
      ? (
        <>
          {noun} {scoreList} {scoreNames.length === 1 ? "foi adicionada" : "foram adicionadas"} na música <strong>{songName}</strong>.
        </>
      )
      : (
        <>
          {noun} {scoreList} {scoreNames.length === 1 ? "foi adicionada" : "foram adicionadas"}.
        </>
      );
  }

  if (action === "deleted") {
    return songName
      ? (
        <>
          {noun} {scoreList} {scoreNames.length === 1 ? "foi deletada" : "foram deletadas"} na música <strong>{songName}</strong>.
        </>
      )
      : (
        <>
          {noun} {scoreList} {scoreNames.length === 1 ? "foi deletada" : "foram deletadas"}.
        </>
      );
  }

  return songName
    ? (
      <>
        {noun} {scoreList} {scoreNames.length === 1 ? "foi alterada" : "foram alteradas"} na música <strong>{songName}</strong>.
      </>
    )
    : (
      <>
        {noun} {scoreList} {scoreNames.length === 1 ? "foi alterada" : "foram alteradas"}.
      </>
    );
}

function joinStrongList(values: string[]): ReactNode[] {
  return values.flatMap((value, index) => {
    const parts: ReactNode[] = [];

    if (index > 0) {
      parts.push(index === values.length - 1 ? " e " : ", ");
    }

    parts.push(<strong key={`${value}-${index}`}>{value}</strong>);
    return parts;
  });
}

function renderCustomScoreText(text: string): ReactNode {
  const extensionOnlyMatch = text.match(/^A partitura\s+(.+?)\s+teve a extensão alterada na música\s+(.+)\.$/);
  if (extensionOnlyMatch) {
    const scoreName = formatScoreDisplayName(extensionOnlyMatch[1]);
    const songName = extensionOnlyMatch[2];
    const isStandaloneScoreName = normalizeKey(scoreName) === normalizeKey(songName);
    if (isStandaloneScoreName) {
      return (
        <>
          A partitura <strong>{scoreName}</strong> teve a extensão alterada.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{scoreName}</strong> teve a extensão alterada na música <strong>{songName}</strong>.
      </>
    );
  }

  const deleteMatch = text.match(/^A partitura\s+(.+?)\s+foi deletada\.$/);
  if (deleteMatch) {
    return (
      <>
        A partitura <strong>{formatScoreDisplayName(deleteMatch[1])}</strong> foi deletada.
      </>
    );
  }

  const statusChangeMatch = text.match(/^A partitura\s+(.+?)\s+saiu de\s+(.+?)\s+e\s+(?:voltou para main|foi para\s+(.+?))\s+na música\s+(.+)\.$/);
  if (statusChangeMatch) {
    const scoreName = formatScoreDisplayName(statusChangeMatch[1]);
    const previousStatus = statusChangeMatch[2];
    const nextStatus = statusChangeMatch[3] ?? "main";
    const songName = statusChangeMatch[4];
    const isStandaloneScoreName = normalizeKey(scoreName) === normalizeKey(songName);

    const labelForStatus = (value: string) => {
      if (value === "ignored") {
        return "ignorada";
      }

      if (value === "draft") {
        return "rascunho";
      }

      if (value === "main") {
        return "main";
      }

      return value;
    };

    if (isStandaloneScoreName) {
      if (nextStatus === "main") {
        return (
          <>
            A partitura <strong>{scoreName}</strong> saiu de {labelForStatus(previousStatus)} e voltou para main.
          </>
        );
      }

      return (
        <>
          A partitura <strong>{scoreName}</strong> saiu de {labelForStatus(previousStatus)} e foi para {labelForStatus(nextStatus)}.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{scoreName}</strong> saiu de {labelForStatus(previousStatus)} e {nextStatus === "main" ? "voltou para main" : `foi para ${labelForStatus(nextStatus)}`} na música <strong>{songName}</strong>.
      </>
    );
  }

  const renameMatch = text.match(/^A partitura\s+(.+?)\s+teve o nome alterado\.$/);
  if (renameMatch) {
    return (
      <>
        A partitura <strong>{formatScoreDisplayName(renameMatch[1])}</strong> teve o nome alterado.
      </>
    );
  }

  const renameWithSongMatch = text.match(/^A partitura\s+(.+?)\s+teve o nome alterado na música\s+(.+)\.$/);
  if (renameWithSongMatch) {
    return (
      <>
        A partitura <strong>{formatScoreDisplayName(renameWithSongMatch[1])}</strong> teve o nome alterado na música <strong>{renameWithSongMatch[2]}</strong>.
      </>
    );
  }

  return text;
}

function parseScoreReference(rawPath: string): { songName: string; scoreName: string } {
  const legacyParts = rawPath.split("||");
  if (legacyParts.length === 2) {
    return {
      songName: legacyParts[0].trim(),
      scoreName: legacyParts[1].trim(),
    };
  }

  const normalizedPath = rawPath.split("\\").join("/");
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  const parts = fileName.split(" - ");

  if (parts.length >= 2) {
    const [songName, ...rest] = parts;
    return {
      songName: songName.trim() || fileName,
      scoreName: rest.join(" - ").trim() || fileName,
    };
  }

  const extensionMatch = fileName.match(/(\.[^.]+)$/);

  return {
    songName: normalizeSongNameForSave(stripFileExtension(fileName)) ?? stripFileExtension(fileName),
    scoreName: `Sem instrumento${extensionMatch ? ` (${extensionMatch[1]})` : ""}`,
  };
}

function formatScoreDisplayName(value: string): string {
  const normalized = normalizeScoreNameForSave(value) ?? value.trim();

  if (normalizeKey(normalized) === normalizeKey("Score")) {
    return "Score";
  }

  return normalized;
}

function ActionSectionCard({
  title,
  groups,
}: {
  title: string;
  groups: EntityGroup[];
}) {
  return (
    <section className="rounded-xl border border-[#dbe5f0] bg-white p-4">
      <div className="text-sm font-semibold text-[#2f4259]">{title}</div>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <EntityGroupCard key={`${title}-${group.title}`} title={group.title} items={group.items} />
        ))}
      </div>
    </section>
  );
}

function EntityGroupCard({
  title,
  items,
}: {
  title: string;
  items: ReactNode[];
}) {
  return (
    <section className="rounded-lg border border-[#e5edf6] bg-[#f9fbfe] p-3">
      <div className="text-sm font-medium text-[#2f4259]">{title}</div>
      <ul className="mt-2 space-y-2 text-sm text-[#4a6278]">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-md bg-white px-3 py-2 break-all whitespace-normal">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

