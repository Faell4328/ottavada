import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TopBar from "../../components/TopBar";
import { open } from "@tauri-apps/plugin-dialog";
import {
  findSongByDirectory,
  scanDirectory,
  getAllSongs,
} from "../../api/commands";
import type { IndexedFile } from "../../types";

const loadSongs = vi.fn().mockResolvedValue(undefined);
const loadCategories = vi.fn().mockResolvedValue(undefined);
const scanFilesForChanges = vi.fn();

const useAppStateMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({
  useAppState: () => useAppStateMock(),
}));

vi.mock("../../components/AddFilesModal", () => ({
  AddFilesModal: ({
    isOpen,
    onCancel,
    onClose,
    onSuccess,
    progress,
  }: {
    isOpen: boolean;
    onCancel?: () => void;
    onClose: () => void;
    onSuccess: (addedCount: number) => Promise<void>;
    progress?: { current: number; total: number };
  }) => {
    if (!isOpen) return null;
    return (
      <div
        data-testid="add-files-modal"
        data-progress={
          progress ? `${progress.current}/${progress.total}` : undefined
        }
      >
        <button onClick={() => void onSuccess(1)}>__confirm__</button>
        <button onClick={onCancel}>__cancel__</button>
        <button onClick={onClose}>__close__</button>
      </div>
    );
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  scanDirectory: vi.fn(),
  getAllSongs: vi.fn(),
  findSongByDirectory: vi.fn(),
}));

const makeFiles = (directory: string): IndexedFile[] => [
  {
    path: `${directory}/score.musx`,
    name: "Score",
    instrument: "Flauta",
    extension: "musx",
  },
];

function renderTopBar() {
  useAppStateMock.mockReturnValue({
    loadSongs,
    loadCategories,
    state: {
      settings: { computer_type: "Manage" },
      sidebarView: "all",
      isScanningFiles: false,
      rcloneProgress: {
        active: false,
        direction: null,
        bytes: 0,
        totalBytes: null,
        percentage: null,
        speedBytesPerSec: 0,
        etaSeconds: null,
      },
      operationStatus: {
        stepCurrent: null,
        stepTotal: null,
      },
    },
    scanFilesForChanges,
  });

  return render(
    <TopBar
      onUpdateClick={vi.fn()}
      isUpdateBusy={false}
      hasAvailableUpdate={false}
      isUpdateActionLocked={false}
    />,
  );
}

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSongs.mockResolvedValue(undefined);
    loadCategories.mockResolvedValue(undefined);
    vi.mocked(findSongByDirectory).mockResolvedValue(null);
    vi.mocked(scanDirectory).mockImplementation(async (directory: string) =>
      makeFiles(directory),
    );
    vi.mocked(getAllSongs).mockResolvedValue([]);
  });

  it("keeps the consult changes button disabled while rclone is active", () => {
    useAppStateMock.mockReturnValue({
      loadSongs,
      loadCategories,
      state: {
        settings: { computer_type: "Client" },
        sidebarView: "all",
        isScanningFiles: false,
        rcloneProgress: {
          active: true,
          direction: null,
          bytes: 0,
          totalBytes: null,
          percentage: null,
          speedBytesPerSec: 0,
          etaSeconds: null,
        },
        operationStatus: {
          stepCurrent: null,
          stepTotal: null,
        },
      },
      scanFilesForChanges,
    });

    render(
      <TopBar
        onUpdateClick={vi.fn()}
        isUpdateBusy={false}
        hasAvailableUpdate={false}
        isUpdateActionLocked={false}
      />,
    );

    screen
      .getAllByTitle("Espere a sincronização terminar para continuar.")
      .forEach((button) => expect(button).toBeDisabled());
  });

  it("opens the confirmation modal for the first selected folder", async () => {
    vi.mocked(open).mockResolvedValue(["/music/a", "/music/b"]);
    renderTopBar();

    fireEvent.click(screen.getByTitle("Indexar pasta"));

    await waitFor(() => {
      expect(scanDirectory).toHaveBeenCalledWith("/music/a");
    });

    expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
      "data-progress",
      "1/2",
    );
  });

  it("confirms and advances to the next folder, then closes after the last", async () => {
    vi.mocked(open).mockResolvedValue(["/music/a", "/music/b"]);
    renderTopBar();

    fireEvent.click(screen.getByTitle("Indexar pasta"));

    await waitFor(() => {
      expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
        "data-progress",
        "1/2",
      );
    });

    fireEvent.click(screen.getByText("__confirm__"));

    await waitFor(() => {
      expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
        "data-progress",
        "2/2",
      );
    });
    expect(scanDirectory).toHaveBeenCalledWith("/music/b");

    fireEvent.click(screen.getByText("__confirm__"));

    await waitFor(() => {
      expect(screen.queryByTestId("add-files-modal")).not.toBeInTheDocument();
    });
  });

  it("cancels the current folder and advances to the next one", async () => {
    vi.mocked(open).mockResolvedValue(["/music/a", "/music/b"]);
    renderTopBar();

    fireEvent.click(screen.getByTitle("Indexar pasta"));

    await waitFor(() => {
      expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
        "data-progress",
        "1/2",
      );
    });

    fireEvent.click(screen.getByText("__cancel__"));

    await waitFor(() => {
      expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
        "data-progress",
        "2/2",
      );
    });
    expect(scanDirectory).toHaveBeenCalledWith("/music/b");
  });

  it("closing with X cancels the current folder and all remaining ones", async () => {
    vi.mocked(open).mockResolvedValue(["/music/a", "/music/b", "/music/c"]);
    renderTopBar();

    fireEvent.click(screen.getByTitle("Indexar pasta"));

    await waitFor(() => {
      expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
        "data-progress",
        "1/3",
      );
    });

    fireEvent.click(screen.getByText("__close__"));

    await waitFor(() => {
      expect(screen.queryByTestId("add-files-modal")).not.toBeInTheDocument();
    });

    expect(scanDirectory).toHaveBeenCalledTimes(1);
    expect(scanDirectory).not.toHaveBeenCalledWith("/music/b");
    expect(scanDirectory).not.toHaveBeenCalledWith("/music/c");
  });

  it("skips an already indexed folder and moves to the next one", async () => {
    vi.mocked(open).mockResolvedValue(["/music/a", "/music/b"]);
    vi.mocked(findSongByDirectory)
      .mockResolvedValueOnce({ name: "Already Indexed" })
      .mockResolvedValue(null);
    renderTopBar();

    fireEvent.click(screen.getByTitle("Indexar pasta"));

    await waitFor(() => {
      expect(screen.getByTestId("add-files-modal")).toHaveAttribute(
        "data-progress",
        "2/2",
      );
    });

    expect(scanDirectory).toHaveBeenCalledTimes(1);
    expect(scanDirectory).toHaveBeenCalledWith("/music/b");
  });
});
