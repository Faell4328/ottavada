import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddScoreToSongModal } from "../../components/AddScoreToSongModal";
import type { IndexedFile } from "../../types";
import * as api from "../../api/commands";
import { normalizeScoreNameForSave } from "../../utils/nameFormat";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const sampleFile: IndexedFile = {
  path: "/music/HINO NACIONAL - Flauta.musx",
  name: "HINO NACIONAL",
  instrument: "Flauta",
  extension: "musx",
};

describe("AddScoreToSongModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    render(
      <AddScoreToSongModal
        isOpen={false}
        songName="HINO NACIONAL"
        file={sampleFile}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.queryByText("Adicionar Partitura")).not.toBeInTheDocument();
  });

  it("should render song name as readonly and allow instrument editing", () => {
    render(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        file={sampleFile}
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

  it("should open score file and file location", async () => {
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    render(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        file={sampleFile}
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
    render(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        file={sampleFile}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const instrumentInput = screen.getByPlaceholderText("Nome do instrumento");
    fireEvent.change(instrumentInput, { target: { value: "FLAUTA 1" } });

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        ...sampleFile,
        name: "HINO NACIONAL",
        instrument: normalizeScoreNameForSave("FLAUTA 1"),
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("should show error when save fails", async () => {
    mockOnSave.mockRejectedValue(new Error("Falha ao adicionar"));

    render(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        file={sampleFile}
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
