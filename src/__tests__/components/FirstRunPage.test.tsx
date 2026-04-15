import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FirstRunPage from "../../components/FirstRunPage";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";

vi.mock("../../api/commands", () => ({
  generateComputerId: vi.fn(async () => "computer-id-1"),
  generateRcloneConfig: vi.fn(async () => undefined),
  deleteRcloneTestFile: vi.fn(async () => undefined),
  completeFirstRun: vi.fn(async () => undefined),
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
  it("shows computer type before the name and organization for server", async () => {
    renderWithAppProvider(<FirstRunPage />);

    expect(screen.getByText("Qual é o tipo de computador?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ex: Estúdio, Home, Sala Ensaio...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Servidor"));
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: Estúdio, Home, Sala Ensaio...")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ex: Orquestra, Igreja, Ministério...")).toBeInTheDocument();
  });

  it("hides organization for client", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Cliente"));
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: Estúdio, Home, Sala Ensaio...")).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText("Ex: Orquestra, Igreja, Ministério...")).not.toBeInTheDocument();
  });
});