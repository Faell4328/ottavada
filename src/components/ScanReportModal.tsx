import { ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import type { ScanResult } from "../api/commands";
import { compareInstrumentNames } from "../utils/instrumentOrder";
import {
  normalizeKey,
  formatScoreDisplayName,
  formatStatusLabel,
  parseScoreReference,
  parseCustomScoreStatusChange,
  resolveEntityAction,
  getScoreReviewSongNameFromText,
  parseReviewItem,
  dedupeReviewItems,
  coalesceExtensionOnlyScoreChanges,
  coalesceScoreRenameAdditions,
  type ReviewAction,
  type ReviewItem,
} from "../utils/scanReport";
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
    ...report.failed_files.map(
      ([path, error]) => `Falha ao processar ${path}: ${error}`,
    ),
  ];
  const sections = buildReviewSections(reportItems);
  const hasAnyChanges = sections.some((section) => section.groups.length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Relatório da verificação"
      maxWidth="max-w-3xl"
      footer={
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
      }
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
                <ActionSectionCard
                  key={section.title}
                  title={section.title}
                  groups={section.groups}
                />
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
      dedupeReviewItems(
        reportItems
          .map(parseReviewItem)
          .filter((item): item is ReviewItem => item !== null),
      ),
    ),
  );
  const createdSongNames = new Set(
    parsedItems
      .filter((item) => item.entity === "song" && item.action === "adding")
      .map((item) => normalizeKey(item.songName ?? item.value ?? item.raw)),
  );
  const modifiedSongNames = new Set(
    parsedItems
      .filter((item) => item.entity === "song" && item.action === "modified")
      .map((item) => normalizeKey(item.songName ?? item.value ?? item.raw)),
  );
  const deletedSongNames = new Set(
    parsedItems
      .filter((item) => item.entity === "song" && item.action === "deleted")
      .map((item) => normalizeKey(item.songName ?? item.value ?? item.raw)),
  );

  const sections: ReviewSection[] = [
    {
      title: "Adicionando",
      groups: buildActionGroups(parsedItems, "adding", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }),
    },
    {
      title: "Modificado",
      groups: buildActionGroups(parsedItems, "modified", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }),
    },
    {
      title: "Deletado",
      groups: buildActionGroups(parsedItems, "deleted", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }),
    },
  ];

  return sections.filter((section) => section.groups.length > 0);
}

function buildActionGroups(
  items: ReviewItem[],
  action: ReviewAction,
  songSets: {
    createdSongNames: Set<string>;
    modifiedSongNames: Set<string>;
    deletedSongNames: Set<string>;
  },
): EntityGroup[] {
  const categoryItems: ReactNode[] = [];
  const composerItems: ReactNode[] = [];
  const arrangerItems: ReactNode[] = [];
  const songItems: ReactNode[] = [];
  const scoreGroups = new Map<
    string,
    { action: ReviewAction; songName: string; scoreNames: string[] }
  >();
  const customScoreGroups = new Map<
    string,
    {
      songName: string;
      previousStatus: string;
      nextStatus: string;
      scoreNames: string[];
    }
  >();
  const scoreOrder: Array<
    | { kind: "group"; key: string }
    | { kind: "custom"; item: ReviewItem }
    | { kind: "custom-group"; key: string }
  > = [];

  const matchingItems = items.filter((item) => item.action === action);

  for (const item of matchingItems) {
    if (item.entity === "category") {
      categoryItems.push(
        renderCategoryItem(action, item.value ?? item.raw, item.songName),
      );
      continue;
    }

    if (item.entity === "composer") {
      const songName = item.songName ?? item.raw;
      const resolvedAction = resolveEntityAction(action, songName, songSets);
      composerItems.push(
        renderPersonItem("compositor", resolvedAction, item.value, songName),
      );
      continue;
    }

    if (item.entity === "arranger") {
      const songName = item.songName ?? item.raw;
      const resolvedAction = resolveEntityAction(action, songName, songSets);
      arrangerItems.push(
        renderPersonItem("arranjador", resolvedAction, item.value, songName),
      );
      continue;
    }

    if (item.entity === "song") {
      songItems.push(
        item.customText
          ? renderCustomSongText(item.customText)
          : formatSongItem(action, item.songName ?? item.value ?? item.raw),
      );
      continue;
    }

    if (item.entity === "score") {
      if (item.customText) {
        const statusChange = parseCustomScoreStatusChange(item.customText);
        if (statusChange) {
          const key = `${action}|${normalizeKey(statusChange.songName)}|${normalizeKey(statusChange.previousStatus)}|${normalizeKey(statusChange.nextStatus)}`;
          const existingGroup = customScoreGroups.get(key);

          if (existingGroup) {
            if (
              !existingGroup.scoreNames.some(
                (existingName) =>
                  normalizeKey(existingName) ===
                  normalizeKey(statusChange.scoreName),
              )
            ) {
              existingGroup.scoreNames.push(statusChange.scoreName);
              existingGroup.scoreNames.sort((a, b) =>
                compareInstrumentNames(
                  formatScoreDisplayName(a),
                  formatScoreDisplayName(b),
                ),
              );
            }

            continue;
          }

          customScoreGroups.set(key, {
            songName: statusChange.songName,
            previousStatus: statusChange.previousStatus,
            nextStatus: statusChange.nextStatus,
            scoreNames: [statusChange.scoreName],
          });
          scoreOrder.push({ kind: "custom-group", key });
          continue;
        }

        scoreOrder.push({ kind: "custom", item });
        continue;
      }

      const songName = item.songName ?? item.scoreName ?? item.raw;
      const scoreName = item.scoreName ?? item.raw;
      const key = `${action}|${normalizeKey(songName)}`;
      const group = scoreGroups.get(key);

      if (group) {
        if (
          !group.scoreNames.some(
            (existingName) =>
              normalizeKey(existingName) === normalizeKey(scoreName),
          )
        ) {
          group.scoreNames.push(scoreName);
          group.scoreNames.sort((a, b) =>
            compareInstrumentNames(
              formatScoreDisplayName(a),
              formatScoreDisplayName(b),
            ),
          );
        }
      } else {
        scoreGroups.set(key, { action, songName, scoreNames: [scoreName] });
        scoreOrder.push({ kind: "group", key });
      }
    }
  }

  const scoreItems: Array<{ songName: string | null; content: ReactNode }> = [];
  for (const entry of scoreOrder) {
    if (entry.kind === "custom") {
      scoreItems.push({
        songName:
          entry.item.songName ??
          getScoreReviewSongNameFromText(
            entry.item.customText ?? entry.item.raw,
          ),
        content: renderCustomScoreText(entry.item.customText ?? entry.item.raw),
      });
      continue;
    }

    if (entry.kind === "custom-group") {
      const group = customScoreGroups.get(entry.key);
      if (!group) {
        continue;
      }

      scoreItems.push({
        songName: group.songName,
        content: renderGroupedCustomScoreStatusItem(
          action,
          group.songName,
          group.previousStatus,
          group.nextStatus,
          group.scoreNames,
        ),
      });
      continue;
    }

    const group = scoreGroups.get(entry.key);
    if (!group) {
      continue;
    }

    if (group.scoreNames.length === 1) {
      scoreItems.push({
        songName: group.songName,
        content: renderScoreItem(action, group.scoreNames[0], group.songName),
      });
      continue;
    }

    scoreItems.push({
      songName: group.songName,
      content: renderGroupedScoreItem(action, group.songName, group.scoreNames),
    });
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
    const scoreGroupItemsBySong = new Map<string, ReactNode[]>();
    const scoreGroupOrder: string[] = [];

    for (const item of scoreItems) {
      const groupTitle = item.songName
        ? `Partituras · ${item.songName}`
        : "Partituras";

      if (!scoreGroupItemsBySong.has(groupTitle)) {
        scoreGroupOrder.push(groupTitle);
        scoreGroupItemsBySong.set(groupTitle, []);
      }

      scoreGroupItemsBySong.get(groupTitle)?.push(item.content);
    }

    for (const groupTitle of scoreGroupOrder) {
      groups.push({
        title: groupTitle,
        items: scoreGroupItemsBySong.get(groupTitle) ?? [],
      });
    }
  }

  return groups;
}

function renderCategoryItem(
  action: ReviewAction,
  categoryName: string,
  songName?: string,
): ReactNode {
  if (action === "adding") {
    if (songName) {
      return (
        <>
          A categoria <strong>{categoryName}</strong> foi adicionada à música{" "}
          <strong>{songName}</strong>.
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
          A categoria <strong>{categoryName}</strong> foi removida da música{" "}
          <strong>{songName}</strong>.
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
  songName: string,
): ReactNode {
  const personName = value ?? "sem nome";

  if (action === "adding") {
    return (
      <>
        O {role} <strong>{personName}</strong> foi adicionado à música{" "}
        {songName}.
      </>
    );
  }

  if (action === "deleted") {
    return (
      <>
        O {role} <strong>{personName}</strong> foi deletado da música {songName}
        .
      </>
    );
  }

  return (
    <>
      O {role} da música <strong>{songName}</strong> foi alterado para{" "}
      <strong>{personName}</strong>.
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
    const statusChangeMatch = text.match(
      /^A música\s+(.+?)\s+saiu de\s+(.+?)\s+e\s+(?:voltou para principal|foi para\s+(.+?))\.$/,
    );

    if (!statusChangeMatch) {
      return text;
    }

    const songName = statusChangeMatch[1];
    const previousStatus = statusChangeMatch[2];
    const nextStatus = statusChangeMatch[3];
    const returnsToMain = text.includes("voltou para principal");

    const labelForStatus = (value: string) => {
      if (value === "ignored") {
        return "ignorada";
      }

      if (value === "draft") {
        return "rascunho";
      }

      if (value === "not_found") {
        return "sem partitura";
      }

      if (value === "main") {
        return "principal";
      }

      return value;
    };

    return (
      <>
        A música <strong>{songName}</strong> saiu de{" "}
        <strong>{labelForStatus(previousStatus)}</strong> e{" "}
        {returnsToMain ? (
          <>
            voltou para <strong>principal</strong>
          </>
        ) : (
          <>
            foi para{" "}
            <strong>{labelForStatus(nextStatus ?? "principal")}</strong>
          </>
        )}
        .
      </>
    );
  }

  return (
    <>
      A música <strong>{match[1]}</strong> teve o nome alterado.
    </>
  );
}

function renderScoreItem(
  action: ReviewAction,
  scoreName: string,
  songName: string,
): ReactNode {
  const displayScoreName = formatScoreDisplayName(scoreName, songName);
  const isStandaloneScoreName =
    normalizeKey(displayScoreName) === normalizeKey(songName);

  if (action === "adding") {
    if (isStandaloneScoreName) {
      return (
        <>
          A partitura <strong>{displayScoreName}</strong> foi adicionada.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{displayScoreName}</strong> foi adicionada na música{" "}
        <strong>{songName}</strong>.
      </>
    );
  }

  if (action === "deleted") {
    if (isStandaloneScoreName) {
      return (
        <>
          A partitura <strong>{displayScoreName}</strong> foi deletada.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{displayScoreName}</strong> foi deletada na música{" "}
        <strong>{songName}</strong>.
      </>
    );
  }

  if (isStandaloneScoreName) {
    return (
      <>
        A partitura <strong>{displayScoreName}</strong> foi alterada.
      </>
    );
  }

  return (
    <>
      A partitura <strong>{displayScoreName}</strong> foi alterada na música{" "}
      <strong>{songName}</strong>.
    </>
  );
}

function renderGroupedScoreItem(
  action: ReviewAction,
  songName: string,
  scoreNames: string[],
): ReactNode {
  const scoreList = joinStrongList(
    scoreNames.map((value) => formatScoreDisplayName(value, songName)),
  );
  const noun = scoreNames.length === 1 ? "A partitura" : "As partituras";

  if (action === "adding") {
    return songName ? (
      <>
        {noun} {scoreList}{" "}
        {scoreNames.length === 1 ? "foi adicionada" : "foram adicionadas"} na
        música <strong>{songName}</strong>.
      </>
    ) : (
      <>
        {noun} {scoreList}{" "}
        {scoreNames.length === 1 ? "foi adicionada" : "foram adicionadas"}.
      </>
    );
  }

  if (action === "deleted") {
    return songName ? (
      <>
        {noun} {scoreList}{" "}
        {scoreNames.length === 1 ? "foi deletada" : "foram deletadas"} na música{" "}
        <strong>{songName}</strong>.
      </>
    ) : (
      <>
        {noun} {scoreList}{" "}
        {scoreNames.length === 1 ? "foi deletada" : "foram deletadas"}.
      </>
    );
  }

  return songName ? (
    <>
      {noun} {scoreList}{" "}
      {scoreNames.length === 1 ? "foi alterada" : "foram alteradas"} na música{" "}
      <strong>{songName}</strong>.
    </>
  ) : (
    <>
      {noun} {scoreList}{" "}
      {scoreNames.length === 1 ? "foi alterada" : "foram alteradas"}.
    </>
  );
}

function renderGroupedCustomScoreStatusItem(
  action: ReviewAction,
  songName: string,
  previousStatus: string,
  nextStatus: string,
  scoreNames: string[],
): ReactNode {
  const scoreList = joinStrongList(
    scoreNames.map((value) => formatScoreDisplayName(value, songName)),
  );
  const noun = scoreNames.length === 1 ? "A partitura" : "As partituras";
  const previousStatusLabel = formatStatusLabel(previousStatus);
  const nextStatusLabel = formatStatusLabel(nextStatus);

  if (action === "deleted") {
    return (
      <>
        {noun} {scoreList}{" "}
        {scoreNames.length === 1 ? "foi deletada" : "foram deletadas"} na música{" "}
        <strong>{songName}</strong>.
      </>
    );
  }

  if (nextStatus === "main") {
    return (
      <>
        {noun} {scoreList} {scoreNames.length === 1 ? "saiu" : "saíram"} de{" "}
        {previousStatusLabel} e{" "}
        {scoreNames.length === 1 ? "voltou" : "voltaram"} para principal na
        música <strong>{songName}</strong>.
      </>
    );
  }

  return (
    <>
      {noun} {scoreList} {scoreNames.length === 1 ? "saiu" : "saíram"} de{" "}
      {previousStatusLabel} e {scoreNames.length === 1 ? "foi" : "foram"} para{" "}
      {nextStatusLabel} na música <strong>{songName}</strong>.
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
  const extensionOnlyMatch = text.match(
    /^A partitura\s+(.+?)\s+teve a extensão alterada na música\s+(.+)\.$/,
  );
  if (extensionOnlyMatch) {
    const scoreName = formatScoreDisplayName(extensionOnlyMatch[1]);
    const songName = extensionOnlyMatch[2];
    const isStandaloneScoreName =
      normalizeKey(scoreName) === normalizeKey(songName);
    if (isStandaloneScoreName) {
      return (
        <>
          A partitura <strong>{scoreName}</strong> teve a extensão alterada.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{scoreName}</strong> teve a extensão alterada na
        música <strong>{songName}</strong>.
      </>
    );
  }

  const deleteMatch = text.match(/^A partitura\s+(.+?)\s+foi deletada\.$/);
  if (deleteMatch) {
    const parsed = parseScoreReference(deleteMatch[1]);
    return (
      <>
        A partitura{" "}
        <strong>
          {formatScoreDisplayName(parsed.scoreName, parsed.songName)}
        </strong>{" "}
        foi deletada.
      </>
    );
  }

  const statusChange = parseCustomScoreStatusChange(text);
  if (statusChange) {
    const scoreName = formatScoreDisplayName(statusChange.scoreName);
    const previousStatus = statusChange.previousStatus;
    const nextStatus = statusChange.nextStatus;
    const songName = statusChange.songName;
    const isStandaloneScoreName =
      normalizeKey(scoreName) === normalizeKey(songName);

    if (isStandaloneScoreName) {
      if (nextStatus === "main") {
        return (
          <>
            A partitura <strong>{scoreName}</strong> saiu de{" "}
            {formatStatusLabel(previousStatus)} e voltou para principal.
          </>
        );
      }

      return (
        <>
          A partitura <strong>{scoreName}</strong> saiu de{" "}
          {formatStatusLabel(previousStatus)} e foi para{" "}
          {formatStatusLabel(nextStatus)}.
        </>
      );
    }

    return (
      <>
        A partitura <strong>{scoreName}</strong> saiu de{" "}
        {formatStatusLabel(previousStatus)} e{" "}
        {nextStatus === "main"
          ? "voltou para principal"
          : `foi para ${formatStatusLabel(nextStatus)}`}{" "}
        na música <strong>{songName}</strong>.
      </>
    );
  }

  const renameMatch = text.match(
    /^A partitura\s+(.+?)\s+teve o nome alterado\.$/,
  );
  if (renameMatch) {
    return (
      <>
        A partitura <strong>{formatScoreDisplayName(renameMatch[1])}</strong>{" "}
        teve o nome alterado.
      </>
    );
  }

  const renameWithSongMatch = text.match(
    /^A partitura\s+(.+?)\s+teve o nome alterado na música\s+(.+)\.$/,
  );
  if (renameWithSongMatch) {
    return (
      <>
        A partitura{" "}
        <strong>{formatScoreDisplayName(renameWithSongMatch[1])}</strong> teve o
        nome alterado na música <strong>{renameWithSongMatch[2]}</strong>.
      </>
    );
  }

  return text;
}

function ActionSectionCard({
  title,
  groups,
}: {
  title: string;
  groups: EntityGroup[];
}) {
  const sectionStyles = getActionSectionStyles(title);

  return (
    <section className={`rounded-xl border p-4 ${sectionStyles.container}`}>
      <div className={`text-sm font-semibold ${sectionStyles.title}`}>
        {title}
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <EntityGroupCard
            key={`${title}-${group.title}`}
            title={group.title}
            items={group.items}
          />
        ))}
      </div>
    </section>
  );
}

function getActionSectionStyles(title: string): {
  container: string;
  title: string;
} {
  if (title === "Adicionando") {
    return {
      container: "border-emerald-200 bg-emerald-50",
      title: "text-emerald-800",
    };
  }

  if (title === "Modificado") {
    return {
      container: "border-amber-200 bg-amber-50",
      title: "text-amber-800",
    };
  }

  return {
    container: "border-red-200 bg-red-50",
    title: "text-red-800",
  };
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
          <li
            key={`${title}-${index}`}
            className="rounded-md bg-white px-3 py-2 break-all whitespace-normal"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
