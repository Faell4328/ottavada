import { useEffect } from "react";
import { fireEvent, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import SongsList from "../../components/SongsList";
import { useAppState } from "../../context/AppContext";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";
import type { ScoreListItem, SongListItem } from "../../types";

let resolveScores: ((scores: ScoreListItem[]) => void) | null = null;
let nextSongSummaries: SongListItem[][] = [];
let triggerUpdateScore: ((scoreId: string, instrumentName: string | null, filePath: string) => Promise<void>) | null = null;
let triggerUpdateSongStatus: ((songId: string, status: "main" | "draft") => Promise<void>) | null = null;
let nextSelectedSong: SongListItem | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    switch (command) {
      case "get_all_song_summaries":
        return nextSongSummaries.shift() ?? [sampleSong, sampleSong2];
      case "get_scores_for_song":
        return new Promise<ScoreListItem[]>((resolve) => {
          resolveScores = resolve;
        });
      case "get_song_list_item_by_id":
        return nextSelectedSong ?? updatedSampleSong;
      case "update_score":
        return undefined;
      case "update_song_status":
        return updatedDraftSong;
      default:
        return null;
    }
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleSong: SongListItem = {
  id: "song-1",
  name: "CANON",
  composer: null,
  arranger: null,
  path: "/music/canon",
  updated_at: "2026-04-16T00:00:00.000Z",
  is_favorite: false,
  status: "main",
  category_ids: [],
  scores: [],
};

const updatedSampleSong: SongListItem = {
  ...sampleSong,
  scores: [
    {
      id: "score-1",
      name: "Violino",
      file_path: "/music/Canon - Violino.musx",
      file_extension: "musx",
      updated_at: "2026-04-16T00:10:00.000Z",
      status: "main",
    },
  ],
};

const updatedDraftSong: SongListItem = {
  ...updatedSampleSong,
  status: "draft",
};

const sampleSong2: SongListItem = {
  id: "song-2",
  name: "AMAZING GRACE",
  composer: null,
  arranger: null,
  path: "/music/amazing-grace",
  updated_at: "2026-04-16T00:00:00.000Z",
  is_favorite: false,
  status: "main",
  category_ids: [],
  scores: [],
};

const sampleScores: ScoreListItem[] = [
  {
    id: "score-1",
    name: "Flauta",
    file_path: "/music/Canon - Flauta.musx",
    file_extension: "musx",
    updated_at: "2026-04-16T00:00:00.000Z",
    status: "main",
  },
];

function SongsListHarness() {
  const { loadSongs, updateScore, updateSongStatus } = useAppState();

  useEffect(() => {
    void loadSongs();
    triggerUpdateScore = updateScore;
    return () => {
      triggerUpdateScore = null;
    };
  }, [loadSongs, updateScore]);

  useEffect(() => {
    triggerUpdateSongStatus = updateSongStatus;
    return () => {
      triggerUpdateSongStatus = null;
    };
  }, [updateSongStatus]);

  return <SongsList />;
}

describe("SongsList", () => {
  const scrollIntoViewSpy = vi.fn();
  const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resolveScores = null;
    nextSongSummaries = [[sampleSong, sampleSong2], [updatedSampleSong, sampleSong2]];
    nextSelectedSong = updatedSampleSong;
    triggerUpdateScore = null;
    requestAnimationFrameCallbacks.length = 0;

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewSpy,
    });
    requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      requestAnimationFrameCallbacks.push(callback);
      return requestAnimationFrameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows scores after loading and scrolls only after they are ready", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByText("CANON"));

    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();

    resolveScores?.(sampleScores);

    expect(await screen.findByText("Flauta")).toBeInTheDocument();

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      while (requestAnimationFrameCallbacks.length > 0) {
        const callback = requestAnimationFrameCallbacks.shift();
        callback?.(performance.now());
      }
    });

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  });

  it("keeps the old scores visible until the edited score refreshes", async () => {
    const summaryWithoutScores: SongListItem = {
      ...sampleSong,
      scores: [],
    };

    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByText("CANON"));

    resolveScores?.(sampleScores);

    expect(await screen.findByText("Flauta")).toBeInTheDocument();

    nextSongSummaries = [[sampleSong, sampleSong2], [summaryWithoutScores, sampleSong2]];
    nextSelectedSong = {
      ...updatedSampleSong,
      scores: [
        {
          ...updatedSampleSong.scores[0],
          name: "Violino",
        },
      ],
    };

    await act(async () => {
      await triggerUpdateScore?.("score-1", "Violino", "/music/Canon - Violino.musx");
    });

    expect(await screen.findByText("Violino")).toBeInTheDocument();
    expect(screen.queryByText("Flauta")).not.toBeInTheDocument();
  });

  it("does not expand scores when only the song status changes", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();
    nextSelectedSong = null;

    await act(async () => {
      await triggerUpdateSongStatus?.("song-1", "draft");
    });

    expect(await screen.findByText("Rascunho")).toBeInTheDocument();
    expect(screen.queryByText("Flauta")).not.toBeInTheDocument();
  });

  it("filters the list while typing", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar músicas"), {
      target: { value: "amazing" },
    });

    expect(await screen.findByText("AMAZING GRACE")).toBeInTheDocument();
    expect(screen.queryByText("CANON")).not.toBeInTheDocument();
  });
});