import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditInstrumentModal } from "../../components/EditInstrumentModal";
import type { ScoreListItem } from "../../types";
import * as api from "../../api/commands";

const sampleInstrument: ScoreListItem = {
  id: "sc1",
  name: "Flauta",
  file_path: "/music/Canon - Flauta.musx",
  file_extension: "musx",
  updated_at: "2024-01-01 12:00:00",
  status: "main",
};

const folderInstrument: ScoreListItem = {
  ...sampleInstrument,
  file_path: "/music/scores",
};

const existingScores: ScoreListItem[] = [
  sampleInstrument,
  {
    id: "sc2",
    name: "Violino",
    file_path: "/music/Canon - Violino.musx",
    file_extension: "musx",
    updated_at: "2024-01-01 12:00:00",
    status: "main",
  },
];

describe("EditInstrumentModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    render(
      <EditInstrumentModal
        isOpen={false}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );
    expect(screen.queryByText("Editar Partitura")).not.toBeInTheDocument();
  });

  it("should not render when instrument is null", () => {
    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={null}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );
    expect(screen.queryByText("Editar Partitura")).not.toBeInTheDocument();
  });

  it("should render with instrument data pre-filled", () => {
    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("Editar Partitura")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Flauta")).toBeInTheDocument();
    expect(screen.getByText("/music/Canon - Flauta.musx")).toBeInTheDocument();
  });

  it("should call onSave with updated instrument name", async () => {
    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByDisplayValue("Flauta");
    fireEvent.change(nameInput, { target: { value: "Flauta Transversal" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        "sc1",
        "Flauta Transversal",
      );
    });
  });

  it("should send null for empty instrument name", async () => {
    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByDisplayValue("Flauta");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        "sc1",
        null,
      );
    });
  });

  it("should call onClose when cancel is clicked", () => {
    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should show error when onSave rejects", async () => {
    mockOnSave.mockRejectedValueOnce(new Error("Erro ao salvar"));

    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("Erro ao salvar")).toBeInTheDocument();
    });
  });

  it("should show 'no file selected' when instrument has no path", () => {
    const noPathInstrument = { ...sampleInstrument, file_path: "" };

    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={noPathInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("Nenhum arquivo selecionado")).toBeInTheDocument();
  });

  it("should warn when renaming to an existing instrument name and disable save", () => {
    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        existingScores={existingScores}
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

  it("should open selected file with default app", async () => {
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);

    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle("Abrir partitura"));

    await waitFor(() => {
      expect(openFilePathSpy).toHaveBeenCalledWith(sampleInstrument.file_path);
    });
  });

  it("should open selected file location in file explorer", async () => {
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={sampleInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(sampleInstrument.file_path);
    });
  });

  it("should fall back to the score id when the stored path is not a file", async () => {
    const openFileSpy = vi.spyOn(api, "openFile").mockResolvedValue(undefined);
    const openFileLocationSpy = vi.spyOn(api, "openFileLocation").mockResolvedValue(undefined);

    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={folderInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle("Abrir partitura"));

    await waitFor(() => {
      expect(openFileSpy).toHaveBeenCalledWith(folderInstrument.id);
    });

    fireEvent.click(screen.getByTitle("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(folderInstrument.id);
    });
  });
});
