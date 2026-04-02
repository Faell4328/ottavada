import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddMusicModal } from "../../components/AddMusicModal";
import { AppProvider } from "../../context/AppContext";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    switch (cmd) {
      case "is_first_run":
        return false;
      case "get_all_songs":
        return [];
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

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>);
}

describe("AddMusicModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    renderWithProvider(
      <AddMusicModal isOpen={false} onClose={mockOnClose} onSave={mockOnSave} />
    );
    expect(screen.queryByText("Adicionar Música")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );
    expect(screen.getByText("Adicionar Música")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome da música")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome do compositor")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome do arranjador")).toBeInTheDocument();
  });

  it("should show error when saving without title", async () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("Digite o título da música")).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("should call onSave with trimmed data", async () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.change(screen.getByPlaceholderText("Nome da música"), {
      target: { value: "  Canon in D  " },
    });
    fireEvent.change(screen.getByPlaceholderText("Nome do compositor"), {
      target: { value: "  Pachelbel  " },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        title: "CANON IN D",
        composer: "Pachelbel",
        arranger: null,
        categoryIds: [],
      });
    });
  });

  it("should call onClose when cancel is clicked", () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should call onClose when X button is clicked", () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    // The X button is the one with the close icon in the header
    const closeButtons = screen.getAllByRole("button");
    // First button in the modal header is the close button
    fireEvent.click(closeButtons[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should send null for empty composer and arranger", async () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.change(screen.getByPlaceholderText("Nome da música"), {
      target: { value: "Test Song" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        title: "TEST SONG",
        composer: null,
        arranger: null,
        categoryIds: [],
      });
    });
  });

  it("should show error when onSave rejects", async () => {
    mockOnSave.mockRejectedValueOnce(new Error("Música já existe"));

    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.change(screen.getByPlaceholderText("Nome da música"), {
      target: { value: "Duplicate Song" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("Música já existe")).toBeInTheDocument();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should trigger save on Enter key in title field", async () => {
    renderWithProvider(
      <AddMusicModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const titleInput = screen.getByPlaceholderText("Nome da música");
    fireEvent.change(titleInput, { target: { value: "Enter Song" } });
    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: "ENTER SONG" })
      );
    });
  });
});
