import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("i18next", () => ({
  default: { t: (key: string) => key, language: "pt" },
}));

vi.mock("../../utils/toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../api/commands", () => ({
  validateCloudBackup: vi.fn(),
  restoreDatabaseFromCloudBackup: vi.fn(),
  restoreSongsFromCloudArchives: vi.fn(),
  restoreDraftIgnoredFromCloud: vi.fn(),
}));

import toast from "../../utils/toast";
import * as api from "../../api/commands";
import { runBackupImportFlow } from "../../context/backupImportFlow";

function makeDeps() {
  const dispatch = vi.fn();
  const runSyncWithProgress = vi.fn().mockResolvedValue({ direction: "download" });
  const loadSongs = vi.fn().mockResolvedValue(undefined);
  const loadCategories = vi.fn().mockResolvedValue(undefined);
  const loadSettings = vi.fn().mockResolvedValue(undefined);
  return { dispatch, runSyncWithProgress, loadSongs, loadCategories, loadSettings };
}

function makeValidation() {
  return {
    found: true,
    generated_at: 1710684000,
    songs_count: 5,
    scores_count: 8,
    categories_count: 2,
    composers_count: 1,
    arrangers_count: 1,
  };
}

function makeDbSummary() {
  return {
    input_path: "backup.msgpack.zst",
    generated_at: 1710684000,
    songs_count: 5,
    scores_count: 8,
    categories_count: 2,
    songs_restored: 0,
    scores_restored: 0,
    scores_replaced: 0,
  };
}

describe("runBackupImportFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs each granular step once and never calls the all-in-one import", async () => {
    vi.mocked(api.validateCloudBackup).mockResolvedValue(makeValidation());
    vi.mocked(api.restoreDatabaseFromCloudBackup).mockResolvedValue(makeDbSummary());
    vi.mocked(api.restoreSongsFromCloudArchives).mockResolvedValue({
      songs_restored: 3,
      scores_restored: 5,
      scores_replaced: 1,
    });
    vi.mocked(api.restoreDraftIgnoredFromCloud).mockResolvedValue(2);

    const deps = makeDeps();
    await runBackupImportFlow(deps);

    expect(api.restoreDatabaseFromCloudBackup).toHaveBeenCalledTimes(1);
    expect(api.restoreSongsFromCloudArchives).toHaveBeenCalledTimes(1);
    expect(api.restoreDraftIgnoredFromCloud).toHaveBeenCalledTimes(1);

    const syncCalls = deps.runSyncWithProgress.mock.calls;
    expect(syncCalls).toHaveLength(3);
    expect(syncCalls[0][0]).toMatchObject({ direction: "download", relativePath: "backup" });
    expect(syncCalls[1][0]).toMatchObject({ direction: "download", relativePath: "songs" });
    expect(syncCalls[2][0]).toMatchObject({
      direction: "download",
      relativePath: "backup_scores_draft_ignored",
    });

    expect(deps.loadSongs).toHaveBeenCalledTimes(1);
    expect(deps.loadCategories).toHaveBeenCalledTimes(1);
    expect(deps.loadSettings).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("advances through the five steps in order and resets state at the end", async () => {
    vi.mocked(api.validateCloudBackup).mockResolvedValue(makeValidation());
    vi.mocked(api.restoreDatabaseFromCloudBackup).mockResolvedValue(makeDbSummary());
    vi.mocked(api.restoreSongsFromCloudArchives).mockResolvedValue({
      songs_restored: 0,
      scores_restored: 0,
      scores_replaced: 0,
    });
    vi.mocked(api.restoreDraftIgnoredFromCloud).mockResolvedValue(0);

    const deps = makeDeps();
    await runBackupImportFlow(deps);

    const statuses = deps.dispatch.mock.calls
      .map((call) => call[0])
      .filter((action: any) => action && action.type === "SET_OPERATION_STATUS");
    const steps = statuses.map((action: any) => action.payload.stepCurrent);
    expect(steps).toEqual([1, 2, 3, 4, 5, null]);

    const actionTypes = deps.dispatch.mock.calls.map((call) => call[0].type);
    expect(actionTypes).toContain("SET_SCANNING_FILES");
    expect(actionTypes).toContain("RESET_OPERATION_STATUS");
    expect(actionTypes).toContain("RESET_RCLONE_PROGRESS");
  });

  it("aborts when no valid backup is found and does not restore anything", async () => {
    vi.mocked(api.validateCloudBackup).mockResolvedValue({
      ...makeValidation(),
      found: false,
    });

    const deps = makeDeps();
    await runBackupImportFlow(deps);

    expect(api.restoreDatabaseFromCloudBackup).not.toHaveBeenCalled();
    expect(api.restoreSongsFromCloudArchives).not.toHaveBeenCalled();
    expect(api.restoreDraftIgnoredFromCloud).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});