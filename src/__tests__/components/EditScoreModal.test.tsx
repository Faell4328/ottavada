import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditScoreModal } from "../../components/EditScoreModal";
import type { ScoreListItem, SongListItem } from "../../types";
import * as api from "../../api/commands";

const sampleSong: SongListItem = {
  id: "song-1",
  name: "HINO NACIONAL",
  composer: null,
  arranger: null,
  path: "/music/hino-nacional",
  updated_at: "2024-01-01 12:00:00",
  is_favorite: false,
  status: "main",
  category_ids: [],
  scores: [
    {
      id: "score-1",
      name: "Flauta",
      file_path: "/music/HINO NACIONAL - Flauta.musx",
      file_extension: "musx",
      updated_at: "2024-01-01 12:00:00",
      status: "main",
    },
    {
      id: "score-2",
      name: "Violino",
      file_path: "/music/HINO NACIONAL - Violino.musx",
      file_extension: "musx",
      updated_at: "2024-01-01 12:00:00",
      status: "main",
    },
  ],
};

const sampleInstrument: ScoreListItem = {
  id: "score-1",
  name: "Flauta",
  file_path: "/music/HINO NACIONAL - Flauta.musx",
  file_extension: "musx",
  updated_at: "2024-01-01 12:00:00",
  status: "main",
};

describe("EditScoreModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should warn when renaming to an existing score name and disable save", () => {
    render(
      <EditScoreModal
        isOpen={true}
        score={sampleSong}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Flauta"), {
      target: { value: "Violino" },
    });

    expect(screen.getByText("Há uma pendência nesta partitura.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("should save when the instrument name stays unique", async () => {
    render(
      <EditScoreModal
        isOpen={true}
        score={sampleSong}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Flauta"), {
      target: { value: "Flauta 2" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        songId: "song-1",
        scoreFileId: "score-1",
        instrumentName: "Flauta 2",
      });
    });
  });

  it("should open the stored file path directly when present", async () => {
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    render(
      <EditScoreModal
        isOpen={true}
        score={sampleSong}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle("Abrir partitura"));

    await waitFor(() => {
      expect(openFilePathSpy).toHaveBeenCalledWith(sampleInstrument.file_path);
    });

    fireEvent.click(screen.getByTitle("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(sampleInstrument.file_path);
    });
  });

  it("should fall back to the score id when no file path is stored", async () => {
    const openFileSpy = vi.spyOn(api, "openFile").mockResolvedValue(undefined);
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    const noPathInstrument: ScoreListItem = {
      ...sampleInstrument,
      file_path: "",
    };

    render(
      <EditScoreModal
        isOpen={true}
        score={sampleSong}
        instrument={noPathInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle("Abrir partitura"));

    await waitFor(() => {
      expect(openFileSpy).toHaveBeenCalledWith(noPathInstrument.id);
    });
    expect(openFilePathSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(noPathInstrument.id);
    });
  });
});
