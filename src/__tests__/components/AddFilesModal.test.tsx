import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { AddFilesModal } from "../../components/AddFilesModal";
import type { IndexedFile, SongListItem } from "../../types";
import * as api from "../../api/commands";
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
          return { changed_files: [], added_files: [], failed_files: [] };
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

const sampleFiles: IndexedFile[] = [
  { path: "/music/Canon - Flauta.musx", name: "Canon", instrument: "Flauta", extension: "musx" },
  { path: "/music/Canon - Violino.musx", name: "Canon", instrument: "Violino", extension: "musx" },
];

const duplicateBatchFiles: IndexedFile[] = [
  { path: "/music/Canon - Flauta 1.musx", name: "Canon", instrument: "Flauta", extension: "musx" },
  { path: "/music/Canon - Flauta 2.musx", name: "Canon", instrument: "Flauta", extension: "musx" },
];

const reorderFiles: IndexedFile[] = [
  { path: "/music/Canon - Violino.musx", name: "Canon", instrument: "Violino", extension: "musx" },
  { path: "/music/Canon - Oboe.musx", name: "Canon", instrument: "Oboe", extension: "musx" },
  { path: "/music/Canon - Flauta.musx", name: "Canon", instrument: "Flauta", extension: "musx" },
];

const duplicateSongs: SongListItem[] = [
  {
    id: "song-1",
    name: "CANON",
    composer: null,
    arranger: null,
    updated_at: "2026-04-08T00:00:00.000Z",
    is_favorite: false,
    category_ids: [],
    scores: [
      {
        id: "score-1",
        name: "Flauta",
        file_path: "/library/Canon - Flauta.musx",
        file_extension: "musx",
        updated_at: "2026-04-08T00:00:00.000Z",
        status: "main",
      },
    ],
  },
];

const otherSongConflictFiles: IndexedFile[] = [
  {
    path: "/library/Canon - Flauta.musx",
    name: "BAVARIAN MARCH",
    instrument: "Flauta",
    extension: "musx",
  },
];

describe("AddFilesModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSuccess.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    renderWithAppProvider(
      <AddFilesModal isOpen={false} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.queryByText("Adicionar Partitura(s)")).not.toBeInTheDocument();
  });

  it("should not render when files are empty", () => {
    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={[]} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.queryByText("Adicionar Partitura(s)")).not.toBeInTheDocument();
  });

  it("should render with file data pre-filled", () => {
    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText("Adicionar Partitura(s)")).toBeInTheDocument();
    // Title should be pre-filled from first file
    expect(screen.getByDisplayValue("CANON")).toBeInTheDocument();
    // Should show instrument count
    expect(screen.getByText("Instrumentos a adicionar (2)")).toBeInTheDocument();
  });

  it("should show error when title is empty", async () => {
    renderWithAppProvider(
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
    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should allow removing files", () => {
    renderWithAppProvider(
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
    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const instrumentInputs = screen.getAllByPlaceholderText("Nome do instrumento");
    expect(instrumentInputs).toHaveLength(2);

    fireEvent.change(instrumentInputs[0], { target: { value: "Flauta 2 Transversal" } });
    expect(instrumentInputs[0]).toHaveValue("Flauta 2 Transversal");
  });

  it("should only reorder review items after the instrument input is blurred", async () => {
    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={reorderFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const initialOrder = screen
      .getAllByText(/Canon - .*\.musx/)
      .map((element) => element.textContent);

    expect(initialOrder).toEqual([
      "Canon - Flauta.musx",
      "Canon - Oboe.musx",
      "Canon - Violino.musx",
    ]);

    const instrumentInput = screen.getAllByPlaceholderText("Nome do instrumento")[0] as HTMLInputElement;
    fireEvent.focus(instrumentInput);
    fireEvent.change(instrumentInput, { target: { value: "Zarpe" } });

    expect(screen.getAllByText(/Canon - .*\.musx/).map((element) => element.textContent)).toEqual(initialOrder);

    fireEvent.blur(instrumentInput);

    await waitFor(() => {
      expect(screen.getAllByText(/Canon - .*\.musx/).map((element) => element.textContent)).toEqual([
        "Canon - Oboe.musx",
        "Canon - Violino.musx",
        "Canon - Flauta.musx",
      ]);
    });
  });

  it("should show duplicate score feedback above the score file name and keep the input readonly", () => {
    renderWithAppProvider(
      <AddFilesModal
        isOpen={true}
        files={sampleFiles}
        existingSongs={duplicateSongs}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const instrumentInput = screen.getAllByPlaceholderText("Nome do instrumento")[0];

    expect(screen.getByText("A música CANON já existe. Altere o nome da música para continuar.")).toBeInTheDocument();
    expect(screen.getByText("1 partitura está sendo usada na música CANON.")).toBeInTheDocument();
    expect(screen.getByText("Essa partitura já está sendo usada na música CANON e por isso não será salva.")).toBeInTheDocument();
    expect(screen.getByText("Canon - Flauta.musx")).toBeInTheDocument();
    expect(instrumentInput).toHaveAttribute("readonly");
  });

  it("should warn when two files have the same instrument name and keep them editable", () => {
    renderWithAppProvider(
      <AddFilesModal
        isOpen={true}
        files={duplicateBatchFiles}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const messages = screen.getAllByRole("listitem").map((element) => element.textContent?.replace(/\s+/g, " ").trim());
    expect(messages).toContain("2 partituras usam o mesmo instrumento (Flauta). Renomeie ou delete uma delas para continuar.");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    const instrumentInputs = screen.getAllByPlaceholderText("Nome do instrumento");
    expect(instrumentInputs[0]).not.toHaveAttribute("readonly");
    expect(instrumentInputs[1]).not.toHaveAttribute("readonly");
  });

  it("should keep focus while editing a repeated instrument until blur", async () => {
    renderWithAppProvider(
      <AddFilesModal
        isOpen={true}
        files={duplicateBatchFiles}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const instrumentInput = screen.getAllByPlaceholderText("Nome do instrumento")[0] as HTMLInputElement;
    instrumentInput.focus();

    fireEvent.change(instrumentInput, { target: { value: "Clarinete" } });

    expect(document.activeElement).toBe(instrumentInput);
    expect(
      screen.getByText(
        "2 partituras usam o mesmo instrumento (Flauta). Renomeie ou delete uma delas para continuar."
      )
    ).toBeInTheDocument();

    fireEvent.blur(instrumentInput);

    await waitFor(() => {
      expect(
        screen.queryByText(
          "2 partituras usam o mesmo instrumento (Flauta). Renomeie ou delete uma delas para continuar."
        )
      ).not.toBeInTheDocument();
    });
  });

  it("should show when a score is already used in another song and disable save", () => {
    renderWithAppProvider(
      <AddFilesModal
        isOpen={true}
        files={otherSongConflictFiles}
        existingSongs={duplicateSongs}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText("1 partitura está sendo usada na música CANON.")).toBeInTheDocument();
    expect(screen.getByText("Essa partitura já está sendo utilizada na música CANON e por isso não será salva.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("should open selected file with default app", async () => {
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);

    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const openButtons = screen.getAllByTitle("Abrir partitura");
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(openFilePathSpy).toHaveBeenCalledWith(sampleFiles[0].path);
    });
  });

  it("should open selected file location in file explorer", async () => {
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    renderWithAppProvider(
      <AddFilesModal isOpen={true} files={sampleFiles} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const openLocalButtons = screen.getAllByTitle("Abrir local");
    fireEvent.click(openLocalButtons[0]);

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(sampleFiles[0].path);
    });
  });

  it("should not save when selection mixes duplicates and new files", async () => {
    const importSpy = vi.spyOn(api, "importIndexedFilesWithMetadata").mockResolvedValue({
      songs: [],
      added_count: 1,
    });

    renderWithAppProvider(
      <AddFilesModal
        isOpen={true}
        files={sampleFiles}
        existingSongs={duplicateSongs}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(importSpy).not.toHaveBeenCalled();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
