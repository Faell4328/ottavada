import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TopBar from "../../components/TopBar";

const loadSongs = vi.fn();
const loadCategories = vi.fn();
const scanFilesForChanges = vi.fn();

const useAppStateMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({
  useAppState: () => useAppStateMock(),
}));

vi.mock("../../components/AddFilesModal", () => ({
  AddFilesModal: () => null,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  scanDirectory: vi.fn(),
  getAllSongs: vi.fn(),
}));

describe("TopBar", () => {
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
      />
    );

    screen
      .getAllByTitle("Espere a sincronização terminar para continuar.")
      .forEach((button) => expect(button).toBeDisabled());
  });
});
