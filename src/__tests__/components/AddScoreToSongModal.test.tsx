import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddScoreToSongModal } from "../../components/AddScoreToSongModal";
import { AppProvider } from "../../context/AppContext";
import type { IndexedFile, ScoreListItem } from "../../types";
import * as api from "../../api/commands";
import { normalizeScoreNameForSave } from "../../utils/nameFormat";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    switch (cmd) {
      case "is_first_run":
        return false;
      case "get_all_songs":
        return [];
      case "get_categories":
        return [];
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

const sampleFile: IndexedFile = {
  path: "/music/HINO NACIONAL - Flauta.musx",
  name: "HINO NACIONAL",
  instrument: "Flauta",
  extension: "musx",
};

const existingScores: ScoreListItem[] = [
  {
    id: "score-1",
    name: "Flauta",
    file_path: "/library/HINO NACIONAL - Flauta.musx",
    file_extension: "musx",
    updated_at: "2026-04-08T00:00:00.000Z",
    status: "main",
  },
];

describe("AddScoreToSongModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  function renderWithProvider(ui: React.ReactElement) {
    return render(<AppProvider>{ui}</AppProvider>);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    renderWithProvider(
      <AddScoreToSongModal
        isOpen={false}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.queryByText("Adicionar Partitura")).not.toBeInTheDocument();
  });

  it("should render song name as readonly and allow instrument editing", () => {
    renderWithProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const songNameInput = screen.getByDisplayValue("HINO NACIONAL");
    expect(songNameInput).toHaveAttribute("readonly");

    const instrumentInput = screen.getByPlaceholderText("Nome do instrumento");
    fireEvent.change(instrumentInput, { target: { value: "Flauta 2" } });

    expect(instrumentInput).toHaveValue("Flauta 2");
  });

  it("should show duplicate score warning above the score name and disable save", () => {
    renderWithProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        existingScores={existingScores}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const warning = screen.getByText("Essa partitura já foi adicionada");

    expect(warning).toBeInTheDocument();
    expect(screen.getByText("HINO NACIONAL - Flauta.musx")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome do instrumento")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("should open score file and file location", async () => {
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    renderWithProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle("Abrir partitura"));

    await waitFor(() => {
      expect(openFilePathSpy).toHaveBeenCalledWith(sampleFile.path);
    });

    fireEvent.click(screen.getByTitle("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(sampleFile.path);
    });
  });

  it("should save with edited instrument and close modal", async () => {
    renderWithProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const instrumentInput = screen.getByPlaceholderText("Nome do instrumento");
    fireEvent.change(instrumentInput, { target: { value: "FLAUTA 1" } });

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith([
        {
          ...sampleFile,
          name: "HINO NACIONAL",
          instrument: normalizeScoreNameForSave("FLAUTA 1"),
        },
      ]);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("should show error when save fails", async () => {
    mockOnSave.mockRejectedValue(new Error("Falha ao adicionar"));

    renderWithProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("Falha ao adicionar")).toBeInTheDocument();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
