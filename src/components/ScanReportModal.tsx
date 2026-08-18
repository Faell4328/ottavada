import { AlertTriangle, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation, Trans } from "react-i18next";

import type {
  ScanResult,
  ScoreStatusChange,
  ScoreStatusOverride,
} from "../api/commands";
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

const OVERRIDE_TARGETS = ["main", "draft", "ignored"] as const;

interface ScanReportModalProps {
  isOpen: boolean;
  report: ScanResult | null;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: (overrides: ScoreStatusOverride[]) => void;
}

export function ScanReportModal({
  isOpen,
  report,
  isConfirming,
  onClose,
  onConfirm,
}: ScanReportModalProps) {
  const { t, i18n } = useTranslation();
  const [targetsByScoreId, setTargetsByScoreId] = useState<
    Record<string, string>
  >(() => ({}));

  const statusChanges = useMemo(() => {
    return report?.score_status_changes ?? [];
  }, [report]);

  useEffect(() => {
    setTargetsByScoreId({});
  }, [report]);

  if (!isOpen || !report) {
    return null;
  }

  const setTarget = (scoreId: string, target: string) => {
    setTargetsByScoreId((previous) => ({ ...previous, [scoreId]: target }));
  };

  const buildOverrides = (): ScoreStatusOverride[] => {
    return statusChanges.flatMap((change) => {
      const target = targetsByScoreId[change.score_id] ?? change.detected_status;
      return target === change.detected_status
        ? []
        : [{ score_id: change.score_id, target_status: target }];
    });
  };

  const reportItems = report.report_items ?? [
    ...report.added_files.map((item) => t("scanReportModal.scoreAddedLegacy", { item })),
    ...report.changed_files.map((item) => t("scanReportModal.scoreChangedLegacy", { item })),
    ...report.deleted_files.map((item) => t("scanReportModal.scoreDeletedLegacy", { item })),
    ...report.recovered_files.map((item) => t("scanReportModal.scoreRecoveredLegacy", { item })),
    ...report.failed_files.map(
      ([path, error]) => t("scanReportModal.scoreFailedLegacy", { path, error }),
    ),
  ];
  const sections = buildReviewSections(
    reportItems,
    t,
    i18n,
    statusChanges,
    targetsByScoreId,
    setTarget,
  );
  const hasAnyChanges = sections.some((section) => section.groups.length > 0);
  const duplicateWarnings = report.duplicate_score_warnings ?? [];

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
            onClick={() => onConfirm(buildOverrides())}
            disabled={isConfirming}
            className="rounded-lg bg-[#4f84d7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? t("scanReportModal.applying") : t("scanReportModal.continue")}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {duplicateWarnings.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <span className="text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              {t("scanReportModal.duplicateScoresTitle")}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-amber-800">
              {duplicateWarnings.map((warning) => (
                <li
                  key={`${warning.song_name}-${warning.score_name}`}
                  className="break-all whitespace-normal"
                >
                  <Trans
                    i18nKey="scanReportModal.duplicateScoreWarning"
                    values={{ score: warning.score_name, song: warning.song_name }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

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
  statusChanges: ScoreStatusChange[],
  targetsByScoreId: Record<string, string>,
  onTargetChange: (scoreId: string, target: string) => void,
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
      }, t, i18n, statusChanges, targetsByScoreId, onTargetChange),
    },
    {
      title: t("scanReportModal.modified"),
      action: "modified",
      groups: buildActionGroups(parsedItems, "modified", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }, t, i18n, statusChanges, targetsByScoreId, onTargetChange),
    },
    {
      title: t("scanReportModal.deleted"),
      action: "deleted",
      groups: buildActionGroups(parsedItems, "deleted", {
        createdSongNames,
        modifiedSongNames,
        deletedSongNames,
      }, t, i18n, statusChanges, targetsByScoreId, onTargetChange),
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
  statusChanges: ScoreStatusChange[],
  targetsByScoreId: Record<string, string>,
  onTargetChange: (scoreId: string, target: string) => void,
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
        renderPersonItem("composer", resolvedAction, item.value, songName, t),
      );
      continue;
    }

    if (item.entity === "arranger") {
      const songName = item.songName ?? item.raw;
      const resolvedAction = resolveEntityAction(action, songName, songSets);
      arrangerItems.push(
        renderPersonItem("arranger", resolvedAction, item.value, songName, t),
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
          const isCombined = item.customText.includes("was changed and");

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

      if (action === "modified" && statusChanges.length > 0) {
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

  if (action === "modified") {
    for (const change of statusChanges) {
      scoreItems.push({
        songName: change.song_name,
        content: renderScoreStatusSelectorItem(
          change,
          targetsByScoreId,
          onTargetChange,
          t,
        ),
      });
    }
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
  role: "composer" | "arranger",
  action: ReviewAction,
  value: string | undefined,
  songName: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): ReactNode {
  const keyPrefix = role === "composer" ? "composer" : "arranger";
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
  const match = text.match(/^The song\s+(.+?)\s+had its name changed\.$/);
  if (!match) {
    const statusChangeMatch = text.match(
      /^The song\s+(.+?)\s+went from\s+(.+?)\s+and\s+(?:returned to main|went to\s+(.+?))\.$/,
    );

    if (!statusChangeMatch) {
      return text;
    }

    const songName = statusChangeMatch[1];
    const previousStatus = statusChangeMatch[2];
    const nextStatus = statusChangeMatch[3];
    const returnsToMain = text.includes("returned to main");

    const formatStatusLabelT = (value: string) => {
      const v = value.toLowerCase();
      if (v === "ignored") return t("scoreStatus.ignored");
      if (v === "draft") return t("scoreStatus.draft");
      if (v === "not_found") return t("scoreStatus.not_found");
      if (v === "main") return t("scoreStatus.main");
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
      parts.push(index === values.length - 1 ? " and " : ", ");
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
  if (v === "ignored") return t("scoreStatus.ignored");
  if (v === "draft") return t("scoreStatus.draft");
  if (v === "not_found") return t("scoreStatus.not_found");
  if (v === "main") return t("scoreStatus.main");
  return value;
}

function renderCustomScoreText(
  text: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  _i18n: { language: string },
): ReactNode {
  const extensionOnlyMatch = text.match(
    /^The score\s+(.+?)\s+had its extension changed in the song\s+(.+)\.$/,
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

  const deleteMatch = text.match(/^The score\s+(.+?)\s+was deleted\.$/);
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
    /^The score\s+(.+?)\s+had its name changed\.$/,
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
    /^The score\s+(.+?)\s+had its name changed in the song\s+(.+)\.$/,
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

function renderScoreStatusSelectorItem(
  change: ScoreStatusChange,
  targetsByScoreId: Record<string, string>,
  onTargetChange: (scoreId: string, target: string) => void,
  t: (key: string, options?: Record<string, unknown>) => string,
): ReactNode {
  const current = targetsByScoreId[change.score_id] ?? change.detected_status;
  const draftLabel = t("scoreStatus.draft");

  return (
    <div>
      <div className="text-sm text-[#4a6278]">
        <strong className="text-[#2f4259]">{change.score_name}</strong>{" "}
        <Trans
          i18nKey="scanReportModal.statusSelectorPrompt"
          values={{ status: draftLabel }}
        />
      </div>
      <div className="mt-2 flex gap-2">
        {OVERRIDE_TARGETS.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => onTargetChange(change.score_id, target)}
            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
              current === target
                ? "border-[#4f84d7] bg-[#4f84d7] text-white"
                : "border-[#c5cfdb] bg-white text-[#344b61] hover:bg-[#f2f5fa]"
            }`}
          >
            {t(`scoreStatus.${target}`)}
          </button>
        ))}
      </div>
    </div>
  );
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
