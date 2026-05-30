import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UseAsBaseScoreModal } from "../../components/UseAsBaseScoreModal";
import type { ScoreListItem, SongListItem } from "../../types";

const sampleSong: SongListItem = {
  id: "song-1",
  name: "HINO NACIONAL",
  composer: null,
  arranger: null,
  updated_at: "2024-01-01 12:00:00",
  is_favorite: false,
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

const sampleScore: ScoreListItem = {
  id: "score-1",
  name: "Flauta",
  file_path: "/music/HINO NACIONAL - Flauta.musx",
  file_extension: "musx",
  updated_at: "2024-01-01 12:00:00",
  status: "main",
};

describe("UseAsBaseScoreModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should render modal with score name as default", () => {
    render(
      <UseAsBaseScoreModal
        isOpen={true}
        song={sampleSong}
        score={sampleScore}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("Usar como base")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Flauta")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <UseAsBaseScoreModal
        isOpen={true}
        song={sampleSong}
        score={sampleScore}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should not render modal content when isOpen is false", () => {
    const { container } = render(
      <UseAsBaseScoreModal
        isOpen={false}
        song={sampleSong}
        score={sampleScore}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(container.querySelector("[class*='bg-black']")).not.toBeInTheDocument();
  });

  it("should return null when score is null", () => {
    const { container } = render(
      <UseAsBaseScoreModal
        isOpen={true}
        song={sampleSong}
        score={null}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should call onSave with the typed name when saving", async () => {
    render(
      <UseAsBaseScoreModal
        isOpen={true}
        song={sampleSong}
        score={sampleScore}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Flauta"), {
      target: { value: " Flauta Base " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("score-1", "Flauta Base");
    });
  });
});
