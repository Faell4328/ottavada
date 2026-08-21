import { useEffect } from "react";
import { fireEvent, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import SongsList from "../../components/SongsList";
import { useAppState } from "../../context/AppContext";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";
import type { Category, ScoreListItem, SongListItem } from "../../types";
import * as api from "../../api/commands";

let resolveScores: ((scores: ScoreListItem[]) => void) | null = null;
let nextSongSummaries: SongListItem[][] = [];
let nextCategories: Category[][] = [];
let triggerUpdateScore:
  | ((
      scoreId: string,
      instrumentName: string | null,
      filePath: string,
    ) => Promise<void>)
  | null = null;
let triggerUpdateSongStatus:
  ((songId: string, status: "main" | "draft") => Promise<void>) | null = null;
let nextSelectedSong: SongListItem | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    switch (command) {
      case "get_all_song_summaries":
        return nextSongSummaries.shift() ?? [sampleSong, sampleSong2];
      case "get_categories":
        return nextCategories.shift() ?? sampleCategories;
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
      case "delete_songs":
        return undefined;
      case "delete_songs_with_files":
        return undefined;
      case "update_songs_status":
        return undefined;
      case "toggle_favorites":
        return undefined;
      case "update_songs_categories":
        return undefined;
      case "set_songs_composer":
        return undefined;
      case "set_songs_arranger":
        return undefined;
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
  category_ids: ["cat-1"],
  scores: [],
};

const sampleCategories: Category[] = [
  { id: "cat-1", name: "Hinos", updated_at: "", updated_by: "" },
  { id: "cat-2", name: "Avulsos", updated_at: "", updated_by: "" },
];

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
  const { loadSongs, loadCategories, updateScore, updateSongStatus } = useAppState();

  triggerUpdateScore = updateScore;
  triggerUpdateSongStatus = updateSongStatus;

  useEffect(() => {
    void loadSongs();
    void loadCategories();
  }, [loadSongs, loadCategories]);

  return <SongsList />;
}

describe("SongsList", () => {
  const scrollIntoViewSpy = vi.fn();
  const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resolveScores = null;
    nextSongSummaries = [
      [sampleSong, sampleSong2],
      [updatedSampleSong, sampleSong2],
    ];
    nextCategories = [sampleCategories, sampleCategories];
    nextSelectedSong = updatedSampleSong;
    triggerUpdateScore = null;
    requestAnimationFrameCallbacks.length = 0;

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewSpy,
    });
    requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        requestAnimationFrameCallbacks.push(callback);
        return requestAnimationFrameCallbacks.length;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
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

    nextSongSummaries = [
      [sampleSong, sampleSong2],
      [summaryWithoutScores, sampleSong2],
    ];
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
      await triggerUpdateScore?.(
        "score-1",
        "Violino",
        "/music/Canon - Violino.musx",
      );
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

    expect(await screen.findByText("Envio não permitido")).toBeInTheDocument();
    expect(screen.queryByText("Flauta")).not.toBeInTheDocument();
  });

  it("filters the list while typing", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar músicas..."), {
      target: { value: "amazing" },
    });

    expect(await screen.findByText("AMAZING GRACE")).toBeInTheDocument();
    expect(screen.queryByText("CANON")).not.toBeInTheDocument();
  });

  it("renders the resolved category name for each song row", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();
    expect(await screen.findByText("Hinos")).toBeInTheDocument();
    expect(screen.getByText("Hinos").closest("tr")).toContainElement(
      screen.getByText("CANON"),
    );
  });

  it("shows the bulk action bar when a song is selected and hides it on clear", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();
    expect(screen.queryByText(/selecionada/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("select CANON"));

    expect(screen.getByText("1 selecionada")).toBeInTheDocument();
    expect(screen.getByText("Parar de indexar pasta")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Limpar seleção"));

    expect(screen.queryByText(/selecionada/)).not.toBeInTheDocument();
    expect(screen.queryByText("Parar de indexar pasta")).not.toBeInTheDocument();
  });

  it("selects all visible songs with the header checkbox", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Selecionar tudo"));

    expect(screen.getByText("2 selecionadas")).toBeInTheDocument();
  });

  it("asks for confirmation before bulk moving songs to trash", async () => {
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("select CANON"));

    fireEvent.click(screen.getByText("Mover pasta e arquivos para lixeira"));

    expect(screen.getByText("Remover músicas")).toBeInTheDocument();
    expect(
      screen.getByText("Mover 1 música selecionada e seus arquivos para a lixeira?"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByText("Remover músicas")).not.toBeInTheDocument();
  });

  it("shows the reindex option when all selected songs have no scores", async () => {
    nextSongSummaries = [
      [
        { ...sampleSong, status: "not_found" },
        { ...sampleSong2, status: "not_found" },
      ],
      [
        { ...sampleSong, status: "not_found" },
        { ...sampleSong2, status: "not_found" },
      ],
    ];
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("select CANON"));

    expect(screen.getByText("Reindexar pasta")).toBeInTheDocument();
    expect(screen.getByText("Parar de indexar pasta")).toBeInTheDocument();
    expect(screen.queryByText("Mover pasta e arquivos para lixeira")).not.toBeInTheDocument();
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
  });

  it("opens a modal naming the song before reindexing it", async () => {
    nextSongSummaries = [
      [{ ...sampleSong, status: "not_found" }],
      [{ ...sampleSong, status: "not_found" }],
    ];
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("select CANON"));
    fireEvent.click(screen.getByText("Reindexar pasta"));

    expect(screen.getByText('Reindexar "CANON"')).toBeInTheDocument();
    expect(screen.getByText("Abrir no explorador")).toBeInTheDocument();
  });

  it("opens the song folder in the file explorer from the reindex modal", async () => {
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    nextSongSummaries = [
      [{ ...sampleSong, status: "not_found" }],
      [{ ...sampleSong, status: "not_found" }],
    ];
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("select CANON"));
    fireEvent.click(screen.getByText("Reindexar pasta"));
    fireEvent.click(screen.getByText("Abrir no explorador"));

    expect(openFileLocationSpy).toHaveBeenCalledWith("/music/canon");
    openFileLocationSpy.mockRestore();
  });

  it("shows only clear selection when mixing songs with and without scores", async () => {
    nextSongSummaries = [
      [
        { ...sampleSong, status: "main" },
        { ...sampleSong2, status: "not_found" },
      ],
      [
        { ...sampleSong, status: "main" },
        { ...sampleSong2, status: "not_found" },
      ],
    ];
    renderWithAppProvider(<SongsListHarness />);

    expect(await screen.findByText("CANON")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("select CANON"));
    fireEvent.click(screen.getByLabelText("select AMAZING GRACE"));

    expect(screen.getByText("2 selecionadas")).toBeInTheDocument();
    expect(screen.queryByText("Reindexar pasta")).not.toBeInTheDocument();
    expect(screen.queryByText("Parar de indexar pasta")).not.toBeInTheDocument();
    expect(screen.queryByText("Mover pasta e arquivos para lixeira")).not.toBeInTheDocument();
    expect(screen.getByText("Limpar seleção")).toBeInTheDocument();
  });
});
