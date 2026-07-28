import { ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation, Trans } from "react-i18next";

import type { ScanResult } from "../api/commands";
import { compareInstrumentNames } from "../utils/instrumentOrder";
import {
  normalizeKey,
  formatScoreDisplayName,
  parseScoreReference,
  parseCustomScoreStatusChange,
  resolveEntityAction,
  getScoreReviewSongNameFromText,
  parseReviewItem,
  dedupeReviewItems,
  coalesceExtensionOnlyScoreChanges,
  coalesceScoreRenameAdditions,
  coalesceScoreFileAndStatusChanges,
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
  const { t, i18n } = useTranslation();

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
  const sections = buildReviewSections(reportItems, t, i18n);
  const hasAnyChanges = sections.some((section) => section.groups.length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("scanReportModal.title")}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg border border-[#c5cfdb] px-4 py-2 text-sm font-semibold text-[#344b61] transition-colors hover:bg-[#f2f5fa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("scanReportModal.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-[#4f84d7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? t("scanReportModal.applying") : t("scanReportModal.continue")}
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
              {t("scanReportModal.reviewChanges")}
            </div>
            <div className="mt-3 space-y-4">
              {sections.map((section) => (
                <ActionSectionCard
                  key={section.action}
                  title={section.title}
                  action={section.action}
                  groups={section.groups}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d3deea] bg-white px-4 py-8 text-center text-sm text-[#60748d]">
            {t("scanReportModal.noChanges")}
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
  action: ReviewAction;
  groups: EntityGroup[];
};

function buildReviewSections(
  reportItems: string[],
  t: (key: string, options?: Record<string, unknown>) => string,
  i18n: { language: string },
): ReviewSection[] {
  const parsedItems = coalesceScoreFileAndStatusChanges(
    coalesceExtensionOnlyScoreChanges(
      coalesceScoreRenameAdditions(
        dedupeReviewItems(
          reportItems
            .map(parseReviewItem)
            .filter((item): item is ReviewItem => item !== null),
        ),
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
      title: t("scanReportModal.adding"),
      action: "adding",
      groups: buildActionGroups(parsedItems, "adding", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }, t, i18n),
    },
    {
      title: t("scanReportModal.modified"),
      action: "modified",
      groups: buildActionGroups(parsedItems, "modified", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }, t, i18n),
    },
    {
      title: t("scanReportModal.deleted"),
      action: "deleted",
      groups: buildActionGroups(parsedItems, "deleted", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }, t, i18n),
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
  t: (key: string, options?: Record<string, unknown>) => string,
  i18n: { language: string },
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
      hasCombinedScores: boolean;
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
        renderPersonItem("compositor", resolvedAction, item.value, songName, t),
      );
      continue;
    }

    if (item.entity === "arranger") {
      const songName = item.songName ?? item.raw;
      const resolvedAction = resolveEntityAction(action, songName, songSets);
      arrangerItems.push(
        renderPersonItem("arranjador", resolvedAction, item.value, songName, t),
      );
      continue;
    }

    if (item.entity === "song") {
      songItems.push(
        item.customText
          ? renderCustomSongText(item.customText, t)
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
          const isCombined = item.customText.includes("foi alterada e");

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

            if (isCombined) {
              existingGroup.hasCombinedScores = true;
            }

            continue;
          }

          customScoreGroups.set(key, {
            songName: statusChange.songName,
            previousStatus: statusChange.previousStatus,
            nextStatus: statusChange.nextStatus,
            scoreNames: [statusChange.scoreName],
            hasCombinedScores: isCombined,
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
        content: renderCustomScoreText(entry.item.customText ?? entry.item.raw, t, i18n),
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
          group.          hasCombinedScores,
          t,
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
    groups.push({ title: t("scanReportModal.categories"), items: categoryItems });
  }

  if (composerItems.length > 0) {
    groups.push({ title: t("scanReportModal.composers"), items: composerItems });
  }

  if (arrangerItems.length > 0) {
    groups.push({ title: t("scanReportModal.arrangers"), items: arrangerItems });
  }

  if (songItems.length > 0) {
    groups.push({ title: t("scanReportModal.songs"), items: songItems });
  }

  if (scoreItems.length > 0) {
    const scoreGroupItemsBySong = new Map<string, ReactNode[]>();
    const scoreGroupOrder: string[] = [];

    for (const item of scoreItems) {
      const groupTitle = item.songName
        ? t("scanReportModal.scoresWithSong", { song: item.songName })
        : t("scanReportModal.scores");

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
  songName: string | undefined,
): ReactNode {
  if (action === "adding") {
    if (songName) {
      return (
        <Trans
          i18nKey="scanReportModal.categoryAddedToSong"
          values={{ name: categoryName, song: songName }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.categoryAdded"
        values={{ name: categoryName }}
      />
    );
  }

  if (action === "deleted") {
    if (songName) {
      return (
        <Trans
          i18nKey="scanReportModal.categoryRemoved"
          values={{ name: categoryName, song: songName }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.categoryDeleted"
        values={{ name: categoryName }}
      />
    );
  }

  return (
    <Trans
      i18nKey="scanReportModal.categoryModified"
      values={{ name: categoryName }}
    />
  );
}

function renderPersonItem(
  role: "compositor" | "arranjador",
  action: ReviewAction,
  value: string | undefined,
  songName: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): ReactNode {
  const keyPrefix = role === "compositor" ? "composer" : "arranger";
  const personName = value ?? t("scanReportModal.noName");

  if (action === "adding") {
    return (
      <Trans
        i18nKey={`scanReportModal.${keyPrefix}Added`}
        values={{ name: personName, song: songName }}
      />
    );
  }

  if (action === "deleted") {
    return (
      <Trans
        i18nKey={`scanReportModal.${keyPrefix}Deleted`}
        values={{ name: personName, song: songName }}
      />
    );
  }

  return (
    <Trans
      i18nKey={`scanReportModal.${keyPrefix}Modified`}
      values={{ song: songName, name: personName }}
    />
  );
}

function formatSongItem(
  action: ReviewAction,
  songName: string,
): ReactNode {
  if (action === "adding") {
    return (
      <Trans
        i18nKey="scanReportModal.songAdded"
        values={{ name: songName }}
      />
    );
  }

  if (action === "deleted") {
    return (
      <Trans
        i18nKey="scanReportModal.songDeleted"
        values={{ name: songName }}
      />
    );
  }

  return (
    <Trans
      i18nKey="scanReportModal.songModified"
      values={{ name: songName }}
    />
  );
}

function renderCustomSongText(
  text: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): ReactNode {
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

    const formatStatusLabelT = (value: string) => {
      const v = value.toLowerCase();
      if (v === "ignored" || v === "ignorada") return t("scoreStatus.ignored");
      if (v === "draft" || v === "rascunho") return t("scoreStatus.draft");
      if (v === "not_found" || v === "sem partitura") return t("scoreStatus.not_found");
      if (v === "main" || v === "principal") return t("scoreStatus.main");
      return value;
    };

    if (returnsToMain) {
      return (
        <Trans
          i18nKey="scanReportModal.songStatusReturnedToMain"
          values={{
            song: songName,
            from: formatStatusLabelT(previousStatus),
            status: formatStatusLabelT("main"),
          }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.songStatusWentToStatus"
        values={{
          song: songName,
          from: formatStatusLabelT(previousStatus),
          status: formatStatusLabelT(nextStatus ?? "main"),
        }}
      />
    );
  }

  return (
    <Trans
      i18nKey="scanReportModal.songNameChanged"
      values={{ name: match[1] }}
    />
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
        <Trans
          i18nKey="scanReportModal.scoreAdded"
          values={{ name: displayScoreName }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.scoreAddedToSong"
        values={{ name: displayScoreName, song: songName }}
      />
    );
  }

  if (action === "deleted") {
    if (isStandaloneScoreName) {
      return (
        <Trans
          i18nKey="scanReportModal.scoreDeleted"
          values={{ name: displayScoreName }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.scoreDeletedFromSong"
        values={{ name: displayScoreName, song: songName }}
      />
    );
  }

  if (isStandaloneScoreName) {
    return (
      <Trans
        i18nKey="scanReportModal.scoreModified"
        values={{ name: displayScoreName }}
      />
    );
  }

  return (
    <Trans
      i18nKey="scanReportModal.scoreModifiedInSong"
      values={{ name: displayScoreName, song: songName }}
    />
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
  const count = scoreNames.length;

  const key = action === "adding"
    ? (songName ? "scanReportModal.scoresAddedPluralSong" : "scanReportModal.scoresAddedPlural")
    : action === "deleted"
      ? (songName ? "scanReportModal.scoresDeletedPluralSong" : "scanReportModal.scoresDeletedPlural")
      : (songName ? "scanReportModal.scoresModifiedPluralSong" : "scanReportModal.scoresModifiedPlural");

  return (
    <Trans
      i18nKey={key}
      count={count}
      values={songName ? { song: songName } : undefined}
      components={{ scoreList: <>{scoreList}</> }}
    />
  );
}

function renderGroupedCustomScoreStatusItem(
  action: ReviewAction,
  songName: string,
  previousStatus: string,
  nextStatus: string,
  scoreNames: string[],
  hasCombinedScores: boolean | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): ReactNode {
  const scoreList = joinStrongList(
    scoreNames.map((value) => formatScoreDisplayName(value, songName)),
  );
  const count = scoreNames.length;
  const previousStatusLabel = formatStatusLabelT(previousStatus, t);
  const nextStatusLabel = formatStatusLabelT(nextStatus, t);

  if (action === "deleted") {
    return (
      <Trans
        i18nKey="scanReportModal.scoresStatusPluralDeleted"
        count={count}
        values={{ song: songName }}
        components={{ scoreList: <>{scoreList}</> }}
      />
    );
  }

  if (hasCombinedScores) {
    const combinedKey =
      nextStatus === "main"
        ? "scanReportModal.scoresCombinedReturned"
        : "scanReportModal.scoresCombinedChanged";

    const noun = t(count === 1 ? "scanReportModal.theScore" : "scanReportModal.theScores");

    return (
      <>
        {noun} {scoreList}{" "}
        <Trans
          i18nKey={combinedKey}
          count={count}
          values={{
            from: previousStatusLabel,
            to: nextStatusLabel,
            song: songName,
          }}
        />
      </>
    );
  }

  const statusKey =
    nextStatus === "main"
      ? "scanReportModal.scoresStatusPluralReturned"
      : "scanReportModal.scoresStatusPluralChanged";

  return (
    <Trans
      i18nKey={statusKey}
      count={count}
      values={{
        from: previousStatusLabel,
        to: nextStatusLabel,
        song: songName,
      }}
      components={{ scoreList: <>{scoreList}</> }}
    />
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

function formatStatusLabelT(
  value: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const v = value.toLowerCase();
  if (v === "ignored" || v === "ignorada") return t("scoreStatus.ignored");
  if (v === "draft" || v === "rascunho") return t("scoreStatus.draft");
  if (v === "not_found" || v === "sem partitura") return t("scoreStatus.not_found");
  if (v === "main" || v === "principal") return t("scoreStatus.main");
  return value;
}

function renderCustomScoreText(
  text: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  _i18n: { language: string },
): ReactNode {
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
        <Trans
          i18nKey="scanReportModal.scoreExtensionChanged"
          values={{ name: scoreName }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.scoreExtensionChangedInSong"
        values={{ name: scoreName, song: songName }}
      />
    );
  }

  const deleteMatch = text.match(/^A partitura\s+(.+?)\s+foi deletada\.$/);
  if (deleteMatch) {
    const parsed = parseScoreReference(deleteMatch[1]);
    return (
      <Trans
        i18nKey="scanReportModal.scoreDeleted"
        values={{ name: formatScoreDisplayName(parsed.scoreName, parsed.songName) }}
      />
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
          <Trans
            i18nKey="scanReportModal.scoreStatusReturnedToMain"
            values={{
              score: scoreName,
              from: formatStatusLabelT(previousStatus, t),
              status: formatStatusLabelT("main", t),
            }}
          />
        );
      }

      return (
        <Trans
          i18nKey="scanReportModal.scoreStatusWentToStatus"
          values={{
            score: scoreName,
            from: formatStatusLabelT(previousStatus, t),
            status: formatStatusLabelT(nextStatus, t),
          }}
        />
      );
    }

    if (nextStatus === "main") {
      return (
        <Trans
          i18nKey="scanReportModal.scoreStatusReturnedToMainInSong"
          values={{
            score: scoreName,
            from: formatStatusLabelT(previousStatus, t),
            status: formatStatusLabelT("main", t),
            song: songName,
          }}
        />
      );
    }

    return (
      <Trans
        i18nKey="scanReportModal.scoreStatusWentToStatusInSong"
        values={{
          score: scoreName,
          from: formatStatusLabelT(previousStatus, t),
          status: formatStatusLabelT(nextStatus, t),
          song: songName,
        }}
      />
    );
  }

  const renameMatch = text.match(
    /^A partitura\s+(.+?)\s+teve o nome alterado\.$/,
  );
  if (renameMatch) {
    return (
      <Trans
        i18nKey="scanReportModal.scoreNameChanged"
        values={{ name: formatScoreDisplayName(renameMatch[1]) }}
      />
    );
  }

  const renameWithSongMatch = text.match(
    /^A partitura\s+(.+?)\s+teve o nome alterado na música\s+(.+)\.$/,
  );
  if (renameWithSongMatch) {
    return (
      <Trans
        i18nKey="scanReportModal.scoreNameChangedInSong"
        values={{
          name: formatScoreDisplayName(renameWithSongMatch[1]),
          song: renameWithSongMatch[2],
        }}
      />
    );
  }

  return text;
}

function ActionSectionCard({
  title,
  action,
  groups,
}: {
  title: string;
  action: ReviewAction;
  groups: EntityGroup[];
}) {
  const sectionStyles = getActionSectionStyles(action);

  return (
    <section className={`rounded-xl border p-4 ${sectionStyles.container}`}>
      <div className={`text-sm font-semibold ${sectionStyles.title}`}>
        {title}
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <EntityGroupCard
            key={`${action}-${group.title}`}
            title={group.title}
            items={group.items}
          />
        ))}
      </div>
    </section>
  );
}

function getActionSectionStyles(action: ReviewAction): {
  container: string;
  title: string;
} {
  if (action === "adding") {
    return {
      container: "border-emerald-200 bg-emerald-50",
      title: "text-emerald-800",
    };
  }

  if (action === "modified") {
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
