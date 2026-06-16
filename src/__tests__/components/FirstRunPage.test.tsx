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
  it("starts with the intro video and moves to computer type", async () => {
    const { openTutorialSite } = await import("../../api/commands");
    const { container } = renderWithAppProvider(<FirstRunPage />);

    expect(screen.getByText("Antes de começar")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Para conseguir utilizar a ferramenta corretamente, assista ao vídeo de introdução/i
      )
    ).toBeInTheDocument();
    expect(container.querySelector("video")).toBeInTheDocument();
    expect(container.querySelector('video source[type="video/webm"]')).toHaveAttribute(
      "src",
      "/intro.webm"
    );
    expect(container.querySelector('video source[type="video/mp4"]')).toHaveAttribute(
      "src",
      "/intro.mp4"
    );
    fireEvent.click(screen.getByText("Abrir tutorial no navegador"));
    expect(openTutorialSite).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Avançar")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Avançar"));

    await waitFor(() => {
      expect(screen.getByText("Qual tipo de computador você está configurando?")).toBeInTheDocument();
    });
  });

  it("shows the name and organization fields for server without exposing the computer id", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Avançar"));
    fireEvent.click(screen.getByText("Computador do Maestro"));
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByText("Configure este computador")).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText("Ex: Estúdio, Home, Sala Ensaio...")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Mesa do maestro, sala de ensaio, igreja...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Orquestra, igreja, ministério...")).toBeInTheDocument();
    expect(screen.queryByText("ID do computador")).not.toBeInTheDocument();
  });

  it("shows the client copy and organization field", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Avançar"));
    fireEvent.click(screen.getByText("Computador de Ensaio"));
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: Mesa do maestro, sala de ensaio, igreja...")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ex: Orquestra, igreja, ministério...")).toBeInTheDocument();
  });
});