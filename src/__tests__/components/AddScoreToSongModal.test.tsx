import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { AddScoreToSongModal } from "../../components/AddScoreToSongModal";
import type { IndexedFile, ScoreListItem, SongListItem } from "../../types";
import * as api from "../../api/commands";
import { normalizeScoreNameForSave } from "../../utils/nameFormat";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";

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

const externalConflictFile: IndexedFile = {
  path: "/music/OUTRA MUSICA - Trompete.musx",
  name: "HINO NACIONAL",
  instrument: "Trompete",
  extension: "musx",
};

const duplicateBatchFiles: IndexedFile[] = [
  {
    path: "/music/HINO NACIONAL - Flauta 1.musx",
    name: "HINO NACIONAL",
    instrument: "Flauta",
    extension: "musx",
  },
  {
    path: "/music/HINO NACIONAL - Flauta 2.musx",
    name: "HINO NACIONAL",
    instrument: "Flauta",
    extension: "musx",
  },
];

const unsortedFiles: IndexedFile[] = [
  {
    path: "/music/HINO NACIONAL - Violino.musx",
    name: "HINO NACIONAL",
    instrument: "Violino",
    extension: "musx",
  },
  {
    path: "/music/HINO NACIONAL - Oboe.musx",
    name: "HINO NACIONAL",
    instrument: "Oboe",
    extension: "musx",
  },
  {
    path: "/music/HINO NACIONAL - Flauta.musx",
    name: "HINO NACIONAL",
    instrument: "Flauta",
    extension: "musx",
  },
];

const reorderFiles: IndexedFile[] = [
  {
    path: "/music/HINO NACIONAL - Violino.musx",
    name: "HINO NACIONAL",
    instrument: "Violino",
    extension: "musx",
  },
  {
    path: "/music/HINO NACIONAL - Oboe.musx",
    name: "HINO NACIONAL",
    instrument: "Oboe",
    extension: "musx",
  },
  {
    path: "/music/HINO NACIONAL - Flauta.musx",
    name: "HINO NACIONAL",
    instrument: "Flauta",
    extension: "musx",
  },
];

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

const existingSongs: SongListItem[] = [
  {
    id: "song-1",
    name: "HINO NACIONAL",
    composer: null,
    arranger: null,
    updated_at: "2026-04-08T00:00:00.000Z",
    is_favorite: false,
    category_ids: [],
    scores: existingScores,
  },
  {
    id: "song-2",
    name: "OUTRA MÚSICA",
    composer: null,
    arranger: null,
    updated_at: "2026-04-08T00:00:00.000Z",
    is_favorite: false,
    category_ids: [],
    scores: [
      {
        id: "score-2",
        name: "Trompete",
        file_path: externalConflictFile.path,
        file_extension: "musx",
        updated_at: "2026-04-08T00:00:00.000Z",
        status: "main",
      },
    ],
  },
];

describe("AddScoreToSongModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("should not render when isOpen is false", () => {
    renderWithAppProvider(
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
    renderWithAppProvider(
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
    renderWithAppProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[sampleFile]}
        existingScores={existingScores}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("Revise as pendências abaixo antes de salvar.")).toBeInTheDocument();
    expect(screen.queryByText(/já foram adicionadas/)).not.toBeInTheDocument();
    expect(screen.getByText("1 partitura está sendo usada na música HINO NACIONAL.")).toBeInTheDocument();
    expect(screen.getByText("Essa partitura já está sendo usada na música HINO NACIONAL e por isso não será salva.")).toBeInTheDocument();
    expect(screen.getByText("HINO NACIONAL - Flauta.musx")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome do instrumento")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("should warn when the same instrument is selected twice and keep the inputs editable", () => {
    renderWithAppProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={duplicateBatchFiles}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("Revise as pendências abaixo antes de salvar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    const instrumentInputs = screen.getAllByPlaceholderText("Nome do instrumento");
    expect(instrumentInputs[0]).not.toHaveAttribute("readonly");
    expect(instrumentInputs[1]).not.toHaveAttribute("readonly");
  });

  it("should keep focus while editing a repeated instrument until blur", async () => {
    renderWithAppProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={duplicateBatchFiles}
        onClose={mockOnClose}
        onSave={mockOnSave}
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

  it("should render files in the same review order as directory indexing", () => {
    renderWithAppProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={unsortedFiles}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const renderedFileNames = screen
      .getAllByText(/HINO NACIONAL - .*\.musx/)
      .map((element) => element.textContent);

    expect(renderedFileNames).toEqual([
      "HINO NACIONAL - Flauta.musx",
      "HINO NACIONAL - Oboe.musx",
      "HINO NACIONAL - Violino.musx",
    ]);
  });

  it("should only reorder review items after the instrument input is blurred", async () => {
    renderWithAppProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={reorderFiles}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const initialOrder = screen
      .getAllByText(/HINO NACIONAL - .*\.musx/)
      .map((element) => element.textContent);

    expect(initialOrder).toEqual([
      "HINO NACIONAL - Flauta.musx",
      "HINO NACIONAL - Oboe.musx",
      "HINO NACIONAL - Violino.musx",
    ]);

    const instrumentInput = screen.getAllByPlaceholderText("Nome do instrumento")[0] as HTMLInputElement;
    fireEvent.focus(instrumentInput);
    fireEvent.change(instrumentInput, { target: { value: "Zarpe" } });

    expect(
      screen.getAllByText(/HINO NACIONAL - .*\.musx/).map((element) => element.textContent)
    ).toEqual(initialOrder);

    fireEvent.blur(instrumentInput);

    await waitFor(() => {
      expect(
        screen.getAllByText(/HINO NACIONAL - .*\.musx/).map((element) => element.textContent)
      ).toEqual([
        "HINO NACIONAL - Oboe.musx",
        "HINO NACIONAL - Violino.musx",
        "HINO NACIONAL - Flauta.musx",
      ]);
    });
  });

  it("should show feedback before save when the selected file is already used by another song", () => {
    renderWithAppProvider(
      <AddScoreToSongModal
        isOpen={true}
        songName="HINO NACIONAL"
        files={[externalConflictFile]}
        existingScores={existingScores}
        existingSongs={existingSongs}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );
    expect(screen.getByText("Revise as pendências abaixo antes de salvar.")).toBeInTheDocument();
    expect(screen.getByText("1 partitura está sendo usada na música OUTRA MÚSICA.")).toBeInTheDocument();
    expect(screen.getByText("Essa partitura já está sendo utilizada na música OUTRA MÚSICA e por isso não será salva.")).toBeInTheDocument();
    expect(screen.getByText("OUTRA MUSICA - Trompete.musx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("should open score file and file location", async () => {
    const openFilePathSpy = vi.spyOn(api, "openFilePath").mockResolvedValue(undefined);
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    renderWithAppProvider(
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
    renderWithAppProvider(
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

    renderWithAppProvider(
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
