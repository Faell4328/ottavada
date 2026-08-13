import {
  normalizeScoreNameForSave,
  normalizeSongNameForSave,
} from "./nameFormat";
import { getInstrumentRank } from "./instrumentOrder";

export type ReviewAction = "adding" | "modified" | "deleted";
export type ReviewEntity =
  | "category"
  | "composer"
  | "arranger"
  | "song"
  | "score"
  | "other";

export type ReviewItem = {
  action: ReviewAction;
  entity: ReviewEntity;
  songName?: string;
  scoreName?: string;
  value?: string;
  customText?: string;
  raw: string;
};

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function stripFileExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "");
}

export function formatStatusLabel(value: string): string {
  if (value === "ignored" || value === "ignorada") {
    return "ignored";
  }

  if (value === "draft" || value === "rascunho") {
    return "draft";
  }

  if (value === "not_found" || value === "sem partitura") {
    return "not_found";
  }

  if (value === "main" || value === "principal") {
    return "main";
  }

  return value;
}

export function formatScoreDisplayName(value: string, songName?: string): string {
  const trimmedValue = value.trim();
  const extensionMatch = trimmedValue.match(/(\.[^.]+)$/);
  const fileExtension = extensionMatch?.[1] ?? "";
  const rawScoreStem = fileExtension
    ? trimmedValue.slice(0, -fileExtension.length).trim()
    : trimmedValue;
  const normalized = normalizeScoreNameForSave(rawScoreStem) ?? rawScoreStem;
  const normalizedSongName = songName
    ? (normalizeScoreNameForSave(songName) ?? songName.trim())
    : null;

  if (
    normalizedSongName &&
    normalizeKey(normalized) === normalizeKey(normalizedSongName)
  ) {
    return `No Instrument${fileExtension}`;
  }

  if (normalizeKey(normalized) === normalizeKey("Score")) {
    return `Score${fileExtension}`;
  }

  return `${normalized}${fileExtension}`;
}

export function parseScoreReference(rawPath: string): {
  songName: string;
  scoreName: string;
} {
  const explicitSongMatch = rawPath.match(/^(.+?)\s+in the song\s+(.+)$/);
  if (explicitSongMatch) {
    return {
      scoreName: explicitSongMatch[1].trim(),
      songName: explicitSongMatch[2].trim().replace(/\.$/, ""),
    };
  }

  const legacyParts = rawPath.split("||");
  if (legacyParts.length === 2) {
    return {
      songName: legacyParts[0].trim(),
      scoreName: legacyParts[1].trim(),
    };
  }

  const normalizedPath = rawPath.split("\\").join("/");
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  const parentDirectoryName =
    pathSegments.length >= 2
      ? pathSegments[pathSegments.length - 2].trim()
      : "";
  const lastDashIndex = fileName.lastIndexOf(" - ");

  if (lastDashIndex !== -1) {
    const songName = fileName.slice(0, lastDashIndex).trim();
    const rawScoreName = fileName.slice(lastDashIndex + 3).trim();
    const extensionMatch = rawScoreName.match(/(\.[^.]+)$/);
    const scoreStem = extensionMatch
      ? rawScoreName.slice(0, -extensionMatch[1].length)
      : rawScoreName;

    if (getInstrumentRank(scoreStem) !== Number.MAX_SAFE_INTEGER) {
      return {
        songName: songName || fileName,
        scoreName: rawScoreName || fileName,
      };
    }
  }

  return {
    songName:
      parentDirectoryName ||
      (normalizeSongNameForSave(stripFileExtension(fileName)) ??
        stripFileExtension(fileName)),
    scoreName: fileName,
  };
}

export function parseScoreAdditionReference(rawText: string): {
  songName: string;
  scoreName: string;
} {
  const additionWithSongMatch = rawText.match(/^(.+?)\s+in the song\s+(.+)\.$/);
  if (additionWithSongMatch) {
    return {
      scoreName: additionWithSongMatch[1].trim(),
      songName: additionWithSongMatch[2].trim(),
    };
  }

  return parseScoreReference(rawText);
}

export function parseReviewItem(raw: string): ReviewItem | null {
  const songCreatedMatch = raw.match(/^Song created:\s*(.+)$/);
  if (songCreatedMatch) {
    return {
      action: "adding",
      entity: "song",
      songName: songCreatedMatch[1].trim(),
      raw,
    };
  }

  const songRenamedMatch = raw.match(
    /^The song\s+(.+?)\s+had its name changed\.$/,
  );
  if (songRenamedMatch) {
    return {
      action: "modified",
      entity: "song",
      songName: songRenamedMatch[1].trim(),
      customText: raw,
      raw,
    };
  }

  const songUpdatedMatch = raw.match(/^Song changed:\s*(.+)$/);
  if (songUpdatedMatch) {
    return {
      action: "modified",
      entity: "song",
      songName: songUpdatedMatch[1].trim(),
      raw,
    };
  }

  const songStatusChangeMatch = raw.match(
    /^The song\s+(.+?)\s+went from\s+(.+?)\s+and\s+(?:returned to main|went to\s+(.+?))\.$/,
  );
  if (songStatusChangeMatch) {
    return {
      action: "modified",
      entity: "song",
      songName: songStatusChangeMatch[1].trim(),
      customText: raw,
      raw,
    };
  }

  const songRemovedMatch = raw.match(/^The song\s+(.+?)\s+was deleted\.$/);
  if (songRemovedMatch) {
    return {
      action: "deleted",
      entity: "song",
      songName: songRemovedMatch[1].trim(),
      raw,
    };
  }

  const categoryCreatedMatch = raw.match(/^Category created:\s*(.+)$/);
  if (categoryCreatedMatch) {
    return {
      action: "adding",
      entity: "category",
      value: categoryCreatedMatch[1].trim(),
      raw,
    };
  }

  const categoryAddedToSongMatch = raw.match(
    /^The category\s+(.+?)\s+was added to the song\s+(.+)\.$/,
  );
  if (categoryAddedToSongMatch) {
    if (categoryAddedToSongMatch[1].trim().toLowerCase() === "uncategorized") {
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

  const categoryRemovedMatch = raw.match(
    /^The category\s+(.+?)\s+was deleted\.$/,
  );
  if (categoryRemovedMatch) {
    return {
      action: "deleted",
      entity: "category",
      value: categoryRemovedMatch[1].trim(),
      raw,
    };
  }

  const categoryRemovedFromSongMatch = raw.match(
    /^The category\s+(.+?)\s+was removed from the song\s+(.+)\.$/,
  );
  if (categoryRemovedFromSongMatch) {
    if (
      categoryRemovedFromSongMatch[1].trim().toLowerCase() === "uncategorized"
    ) {
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

  const composerAddedMatch = raw.match(
    /^The composer\s+(.+?)\s+was added to the song\s+(.+)\.$/,
  );
  if (composerAddedMatch) {
    return {
      action: "adding",
      entity: "composer",
      songName: composerAddedMatch[2].trim(),
      value: composerAddedMatch[1].trim(),
      raw,
    };
  }

  const composerModifiedMatch = raw.match(
    /^The composer\s+(.+?)\s+was changed in the song\s+(.+)\.$/,
  );
  if (composerModifiedMatch) {
    return {
      action: "modified",
      entity: "composer",
      songName: composerModifiedMatch[2].trim(),
      value: composerModifiedMatch[1].trim(),
      raw,
    };
  }

  const composerRemovedMatch = raw.match(
    /^The composer\s+(.+?)\s+was (?:deleted|removed) from the song\s+(.+)\.$/,
  );
  if (composerRemovedMatch) {
    return {
      action: "deleted",
      entity: "composer",
      songName: composerRemovedMatch[2].trim(),
      value: composerRemovedMatch[1].trim(),
      raw,
    };
  }

  const arrangerAddedMatch = raw.match(
    /^The arranger\s+(.+?)\s+was added to the song\s+(.+)\.$/,
  );
  if (arrangerAddedMatch) {
    return {
      action: "adding",
      entity: "arranger",
      songName: arrangerAddedMatch[2].trim(),
      value: arrangerAddedMatch[1].trim(),
      raw,
    };
  }

  const arrangerModifiedMatch = raw.match(
    /^The arranger\s+(.+?)\s+was changed in the song\s+(.+)\.$/,
  );
  if (arrangerModifiedMatch) {
    return {
      action: "modified",
      entity: "arranger",
      songName: arrangerModifiedMatch[2].trim(),
      value: arrangerModifiedMatch[1].trim(),
      raw,
    };
  }

  const arrangerRemovedMatch = raw.match(
    /^The arranger\s+(.+?)\s+was (?:deleted|removed) from the song\s+(.+)\.$/,
  );
  if (arrangerRemovedMatch) {
    return {
      action: "deleted",
      entity: "arranger",
      songName: arrangerRemovedMatch[2].trim(),
      value: arrangerRemovedMatch[1].trim(),
      raw,
    };
  }

  const scoreAddedMatch = raw.match(/^Score added:\s*(.+)$/);
  if (scoreAddedMatch) {
    const parsed = parseScoreAdditionReference(scoreAddedMatch[1].trim());
    return {
      action: "adding",
      entity: "score",
      songName: parsed.songName,
      scoreName: parsed.scoreName,
      raw,
    };
  }

  const scoreChangedMatch = raw.match(/^Score changed:\s*(.+)$/);
  if (scoreChangedMatch) {
    const parsed = parseScoreReference(scoreChangedMatch[1].trim());
    return {
      action: "modified",
      entity: "score",
      songName: parsed.songName,
      scoreName: parsed.scoreName,
      raw,
    };
  }

  const scoreRenamedMatch = raw.match(
    /^The score\s+(.+?)\s+had its name changed\.$/,
  );
  if (scoreRenamedMatch) {
    return {
      action: "modified",
      entity: "score",
      scoreName: scoreRenamedMatch[1].trim(),
      customText: raw,
      raw,
    };
  }

  const scoreRenamedWithSongMatch = raw.match(
    /^The score\s+(.+?)\s+had its name changed in the song\s+(.+)\.$/,
  );
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

  const scoreRemovedMatch = raw.match(/^The score\s+(.+?)\s+was deleted\.$/);
  if (scoreRemovedMatch) {
    const parsed = parseScoreReference(scoreRemovedMatch[1].trim());
    return {
      action: "deleted",
      entity: "score",
      songName: parsed.songName,
      scoreName: parsed.scoreName,
      raw,
    };
  }

  const scoreExtensionOnlyMatch = raw.match(
    /^The score\s+(.+?)\s+had its extension changed in the song\s+(.+)\.$/,
  );
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

  const recoveredMatch = raw.match(/^Score recovered:\s*(.+)$/);
  if (recoveredMatch) {
    const parsed = parseScoreReference(recoveredMatch[1].trim());
    const isStandaloneScoreName = parsed.songName === parsed.scoreName;
    return {
      action: "modified",
      entity: "score",
      songName: parsed.songName,
      scoreName: parsed.scoreName,
      customText: isStandaloneScoreName
        ? `The score ${parsed.scoreName} went from draft and returned to main.`
        : `The score ${parsed.scoreName} went from draft and returned to main in the song ${parsed.songName}.`,
      raw,
    };
  }

  const statusChangeMatch = raw.match(
    /^The score\s+(.+?)\s+went from\s+(.+?)\s+and\s+(?:returned to main|went to\s+(.+?))\s+in the song\s+(.+)\.$/,
  );
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

export function dedupeReviewItems(items: ReviewItem[]): ReviewItem[] {
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

export function coalesceExtensionOnlyScoreChanges(items: ReviewItem[]): ReviewItem[] {
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

    if (
      item.entity !== "score" ||
      !item.scoreName ||
      item.action === "modified"
    ) {
      result.push(item);
      continue;
    }

    const partnerBucket =
      item.action === "adding" ? deletionsByKey : additionsByKey;
    const partner = findMatchingScorePartner(
      partnerBucket,
      item.songName,
      item.scoreName,
    );

    if (partner) {
      consumed.add(partner);
      result.push({
        action: "modified",
        entity: "score",
        songName: item.songName ?? partner.songName,
        scoreName: item.scoreName,
        customText: buildExtensionOnlyScoreChangeText(
          item.songName ?? partner.songName ?? "",
          item.scoreName,
        ),
        raw: `${partner.raw} || ${item.raw}`,
      });
      continue;
    }

    result.push(item);
  }

  return result;
}

export function coalesceScoreRenameAdditions(items: ReviewItem[]): ReviewItem[] {
  const renameKeys = new Set<string>();

  for (const item of items) {
    if (
      item.entity !== "score" ||
      item.action !== "modified" ||
      !item.scoreName ||
      !item.songName
    ) {
      continue;
    }

    if (!item.customText?.includes("had its name changed")) {
      continue;
    }

    renameKeys.add(
      `${normalizeKey(item.songName)}|${normalizeKey(stripFileExtension(item.scoreName))}`,
    );
  }

  return items.filter((item) => {
    if (
      item.entity !== "score" ||
      item.action !== "adding" ||
      !item.scoreName ||
      !item.songName
    ) {
      return true;
    }

    const key = `${normalizeKey(item.songName)}|${normalizeKey(stripFileExtension(item.scoreName))}`;
    return !renameKeys.has(key);
  });
}

export function buildScoreChangeKeys(
  songName: string | undefined,
  scoreName: string,
): string[] {
  const normalizedScoreName = normalizeKey(stripFileExtension(scoreName));
  const normalizedSongName = normalizeKey(songName ?? "");

  if (!normalizedSongName) {
    return [normalizedScoreName];
  }

  return [`${normalizedSongName}|${normalizedScoreName}`, normalizedScoreName];
}

export function findMatchingScorePartner(
  bucket: Map<string, ReviewItem[]>,
  songName: string | undefined,
  scoreName: string,
): ReviewItem | undefined {
  for (const key of buildScoreChangeKeys(songName, scoreName)) {
    const partner = bucket.get(key)?.shift();
    if (partner) {
      return partner;
    }
  }

  return undefined;
}

export function buildExtensionOnlyScoreChangeText(
  songName: string,
  scoreName: string,
): string {
  return `The score ${scoreName} had its extension changed in the song ${songName}.`;
}

export function coalesceScoreFileAndStatusChanges(items: ReviewItem[]): ReviewItem[] {
  const statusChanges = new Map<string, ReviewItem>();

  for (const item of items) {
    if (
      item.entity === "score" &&
      item.action === "modified" &&
      item.customText &&
      parseCustomScoreStatusChange(item.customText)
    ) {
      const key = `${normalizeKey(item.songName ?? "")}|${normalizeKey(item.scoreName ?? "")}`;
      statusChanges.set(key, item);
    }
  }

  return items.filter((item) => {
    if (
      item.entity === "score" &&
      item.action === "modified" &&
      !item.customText &&
      item.scoreName
    ) {
      const key = `${normalizeKey(item.songName ?? "")}|${normalizeKey(item.scoreName ?? "")}`;
      const statusChange = statusChanges.get(key);

      if (statusChange && statusChange.songName) {
        statusChange.customText = buildCombinedScoreFileAndStatusText(
          statusChange.customText!,
          statusChange.scoreName!,
          statusChange.songName,
        );
        return false;
      }
    }

    return true;
  });
}

function buildCombinedScoreFileAndStatusText(
  statusText: string,
  scoreName: string,
  songName: string,
): string {
  const statusChange = parseCustomScoreStatusChange(statusText);
  if (!statusChange) return statusText;

  const { previousStatus, nextStatus } = statusChange;
  const prevLabel = formatStatusLabel(previousStatus);

  if (nextStatus === "main") {
    return `The score ${scoreName} was changed and went from ${prevLabel} and returned to ${formatStatusLabel("main")} in the song ${songName}.`;
  }

  const nextLabel = formatStatusLabel(nextStatus);
  return `The score ${scoreName} was changed and went from ${prevLabel} and went to ${nextLabel} in the song ${songName}.`;
}

export function parseCustomScoreStatusChange(text: string): {
  songName: string;
  scoreName: string;
  previousStatus: string;
  nextStatus: string;
} | null {
  const statusChangeMatch = text.match(
    /^The score\s+(.+?)\s+(?:was changed and )?went from\s+(.+?)\s+and\s+(?:returned to main|went to\s+(.+?))\s+in the song\s+(.+)\.$/,
  );
  if (!statusChangeMatch) {
    return null;
  }

  return {
    scoreName: statusChangeMatch[1].trim(),
    previousStatus: statusChangeMatch[2].trim(),
    nextStatus: (statusChangeMatch[3] ?? "main").trim(),
    songName: statusChangeMatch[4].trim(),
  };
}

export function resolveEntityAction(
  fallbackAction: ReviewAction,
  songName: string,
  songSets: {
    createdSongNames: Set<string>;
    modifiedSongNames: Set<string>;
    deletedSongNames: Set<string>;
  },
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

export function getScoreReviewSongNameFromText(text: string): string | null {
  const directMatch = text.match(/\bin the song\s+(.+)\.$/);
  if (directMatch) {
    return directMatch[1].trim();
  }

  const statusChangeMatch = text.match(/\bin the song\s+(.+)\.$/);
  if (statusChangeMatch) {
    return statusChangeMatch[1].trim();
  }

  return null;
}
