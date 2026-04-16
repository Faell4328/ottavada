import { useEffect } from "react";
import { fireEvent, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import SongsList from "../../components/SongsList";
import { useAppState } from "../../context/AppContext";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";
import type { ScoreListItem, SongListItem } from "../../types";

let resolveScores: ((scores: ScoreListItem[]) => void) | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    switch (command) {
      case "get_all_song_summaries":
        return [sampleSong];
      case "get_scores_for_song":
        return new Promise<ScoreListItem[]>((resolve) => {
          resolveScores = resolve;
        });
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
  updated_at: "2026-04-16T00:00:00.000Z",
  is_favorite: false,
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
  const { loadSongs } = useAppState();

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  return <SongsList />;
}

describe("SongsList", () => {
  const scrollIntoViewSpy = vi.fn();
  const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resolveScores = null;
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
});