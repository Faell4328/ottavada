import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddFilesModal } from "../../components/AddFilesModal";
import { AppProvider } from "../../context/AppContext";
import type { IndexedFile } from "../../types";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    switch (cmd) {
      case "is_first_run":
        return false;
      case "get_all_songs":
        return [];
      case "get_categories":
        return [{ id: "c1", name: "Harpa Cristã" }];
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

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleFiles: IndexedFile[] = [
  { path: "/music/Canon - Flauta.musx", name: "Canon", instrument: "Flauta", extension: "musx" },
  { path: "/music/Canon - Violino.musx", name: "Canon", instrument: "Violino", extension: "musx" },
];

function renderWithProvider(ui: React.ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>);
}

describe("AddFilesModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSuccess.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    renderWithProvider(
      <AddFilesModal isOpen={false} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.queryByText("Adicionar Partitura(s)")).not.toBeInTheDocument();
  });

  it("should not render when files are empty", () => {
    renderWithProvider(
      <AddFilesModal isOpen={true} files={[]} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.queryByText("Adicionar Partitura(s)")).not.toBeInTheDocument();
  });

  it("should render with file data pre-filled", () => {
    renderWithProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText("Adicionar Partitura(s)")).toBeInTheDocument();
    // Title should be pre-filled from first file
    expect(screen.getByDisplayValue("CANON")).toBeInTheDocument();
    // Should show instrument count
    expect(screen.getByText("Instrumentos a adicionar (2)")).toBeInTheDocument();
  });

  it("should show error when title is empty", async () => {
    renderWithProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Clear the pre-filled title
    fireEvent.change(screen.getByDisplayValue("CANON"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("O título da música é obrigatório")).toBeInTheDocument();
    });
  });

  it("should call onClose when cancel is clicked", () => {
    renderWithProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should allow removing files", () => {
    renderWithProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Initially shows 2 instruments
    expect(screen.getByText("Instrumentos a adicionar (2)")).toBeInTheDocument();

    // Click the first remove button
    const removeButtons = screen.getAllByTitle("Remover arquivo");
    fireEvent.click(removeButtons[0]);

    // Should now show 1 instrument
    expect(screen.getByText("Instrumentos a adicionar (1)")).toBeInTheDocument();
  });

  it("should allow editing instrument names", () => {
    renderWithProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const instrumentInputs = screen.getAllByPlaceholderText("Nome do instrumento");
    expect(instrumentInputs).toHaveLength(2);

    fireEvent.change(instrumentInputs[0], { target: { value: "Flauta 2 Transversal" } });
    expect(instrumentInputs[0]).toHaveValue("Flauta 2 Transversal");
  });
});
