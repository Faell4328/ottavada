import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditInstrumentModal } from "../../components/EditInstrumentModal";
import type { ScoreListItem } from "../../types";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const sampleInstrument: ScoreListItem = {
  id: "sc1",
  name: "Flauta",
  file_path: "/music/Canon - Flauta.musx",
  file_extension: "musx",
  updated_at: "2024-01-01 12:00:00",
  status: "main",
};

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
        "/music/Canon - Flauta.musx"
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
        "/music/Canon - Flauta.musx"
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

  it("should show error if saving with empty file path", async () => {
    const noPathInstrument = { ...sampleInstrument, file_path: "" };

    render(
      <EditInstrumentModal
        isOpen={true}
        instrument={noPathInstrument}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(
        screen.getByText("O arquivo está vazio. Selecione um arquivo válido.")
      ).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
