import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FirstRunPage from "../../components/FirstRunPage";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";

vi.mock("../../api/commands", () => ({
  generateComputerId: vi.fn(async () => "computer-id-1"),
  generateRcloneConfig: vi.fn(async () => undefined),
  deleteRcloneTestFile: vi.fn(async () => undefined),
  completeFirstRun: vi.fn(async () => undefined),
  openTutorialSite: vi.fn(async () => undefined),
  testRcloneUpload: vi.fn(async () => undefined),
}));

vi.mock("../../hooks/useRcloneTest", () => ({
  useRcloneTest: () => ({
    testRclone: vi.fn(async () => true),
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

describe("FirstRunPage", () => {
  it("starts with the language selection screen, opens tutorial and advances to computer type", async () => {
    const { openTutorialSite } = await import("../../api/commands");
    renderWithAppProvider(<FirstRunPage />);

    expect(screen.getByText("Choose your language")).toBeInTheDocument();
    expect(screen.getByText("Open tutorial in browser")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Open tutorial in browser"));
    expect(openTutorialSite).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("What type of computer are you setting up?")).toBeInTheDocument();
    });
  });

  it("shows the name and organization fields for server without exposing the computer id", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Conductor's Computer"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Set up this computer")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ex: Conductor's desk, rehearsal room, church...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Orchestra, church, ministry...")).toBeInTheDocument();
    expect(screen.queryByText("Computer ID")).not.toBeInTheDocument();
  });

  it("shows the client copy and organization field", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Rehearsal Computer"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: Conductor's desk, rehearsal room, church...")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ex: Orchestra, church, ministry...")).toBeInTheDocument();
  });
});
