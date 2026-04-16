import { MemoryRouter } from "react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsPage from "../../components/SettingsPage";

vi.mock("../../api/commands", () => ({
  getSettings: vi.fn(async () => ({
    computer_id: "computer-id-1",
    computer_name: "Casa",
    organization_name: null,
    computer_type: "Client",
    google_drive_mode: "Local",
    first_run_completed: true,
    google_service_account: null,
    rclone_config: { provider: "koofr" },
    library_summary: null,
  })),
}));

vi.mock("../../context/AppContext", () => ({
  useAppState: () => ({
    state: {
      settings: {
        computer_id: "computer-id-1",
        computer_name: "Casa",
        organization_name: null,
        computer_type: "Client",
        google_drive_mode: "Local",
        first_run_completed: true,
        google_service_account: null,
        rclone_config: { provider: "koofr" },
        library_summary: null,
      },
      isScanningFiles: false,
      rcloneProgress: { direction: null, completed: 0, total: 0 },
      operationStatus: { title: null, detail: null, stepCurrent: null, stepTotal: null },
    },
    saveSettings: vi.fn(),
    loadSettings: vi.fn(),
    loadSongs: vi.fn(),
    loadCategories: vi.fn(),
    scanFilesForChanges: vi.fn(),
    setOperationStatus: vi.fn(),
    resetOperationStatus: vi.fn(),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");

  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("SettingsPage", () => {
  it("shows organization field for client settings", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: Orquestra, Igreja, Ministério...")).toBeInTheDocument();
    });
  });
});