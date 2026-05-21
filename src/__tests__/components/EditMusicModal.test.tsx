import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { EditMusicModal } from "../../components/EditMusicModal";
import type { SongListItem } from "../../types";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    switch (cmd) {
      case "is_first_run":
        return false;
      case "get_all_songs":
        return [];
      case "get_all_song_summaries":
        return [
          {
            id: "s-global-1",
            name: "Global Song",
            composer: "Pachelbel",
            arranger: "Global Arranger",
            updated_at: "2024-01-01 12:00:00",
            is_favorite: false,
            category_ids: [],
            scores: [],
          },
        ];
      case "get_categories":
        return [
          { id: "c1", name: "Harpa Cristã" },
          { id: "c2", name: "Clássicas" },
        ];
      case "get_settings":
        return {
          computer_id: "test-id",
          computer_name: "Test",
          google_drive_mode: "Local",
          first_run_completed: true,
          google_service_account: null,
        };
      case "scan_files_for_changes":
        return { changed_files: [], failed_files: [] };
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
  id: "s1",
  name: "Canon in D",
  composer: "Pachelbel",
  arranger: "Modern Arranged",
  updated_at: "2024-01-01 12:00:00",
  is_favorite: false,
  category_ids: ["c1"],
  scores: [],
};

describe("EditMusicModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={false} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );
    expect(screen.queryByText("Editar Música")).not.toBeInTheDocument();
  });

  it("should not render when score is null", () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={null} onClose={mockOnClose} onSave={mockOnSave} />
    );
    expect(screen.queryByText("Editar Música")).not.toBeInTheDocument();
  });

  it("should render with song data pre-filled", () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );

    expect(screen.getByText("Editar Música")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Canon in D")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Pachelbel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Modern Arranged")).toBeInTheDocument();
  });

  it("should show error when title is empty", async () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const titleInput = screen.getByDisplayValue("Canon in D");
    fireEvent.change(titleInput, { target: { value: "" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("O título é obrigatório")).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("should call onSave with updated data", async () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const titleInput = screen.getByDisplayValue("Canon in D");
    fireEvent.change(titleInput, { target: { value: "Canon in D Major" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        songId: "s1",
        title: "CANON IN D MAJOR",
        composer: "Pachelbel",
        arranger: "Modern Arranged",
        categoryIds: ["c1"],
      });
    });
  });

  it("should call onClose when cancel is clicked", () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should show error when onSave rejects", async () => {
    mockOnSave.mockRejectedValueOnce(new Error("Falha na atualização"));

    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("Falha na atualização")).toBeInTheDocument();
    });
  });

  it("should send null for empty composer", async () => {
    const songNoComposer = { ...sampleSong, composer: null, arranger: null };

    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={songNoComposer} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          composer: null,
          arranger: null,
        })
      );
    });
  });

  it("should suggest authors from the full song list", async () => {
    renderWithAppProvider(
      <EditMusicModal isOpen={true} score={sampleSong} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const composerInput = screen.getByDisplayValue("Pachelbel");
    fireEvent.change(composerInput, { target: { value: "Pa" } });
    fireEvent.focus(composerInput);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pachelbel" })).toBeInTheDocument();
    });
  });
});
