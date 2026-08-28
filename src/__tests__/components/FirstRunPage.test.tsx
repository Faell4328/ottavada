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
  it("starts with the language selection screen, opens documentation and advances to computer type", async () => {
    const { openTutorialSite } = await import("../../api/commands");
    renderWithAppProvider(<FirstRunPage />);

    expect(screen.getByText("Escolha seu idioma")).toBeInTheDocument();
    expect(screen.getByText("Abrir documentação no navegador")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Abrir documentação no navegador"));
    expect(openTutorialSite).toHaveBeenCalledTimes(1);
    expect(openTutorialSite).toHaveBeenCalledWith(
      "http://ottavada.com/pt-BR/documentacao",
    );

    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByText("Qual modo de uso você está configurando?")).toBeInTheDocument();
    });
  });

  it("shows the name and organization fields for server without exposing the computer id", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Próximo"));
    fireEvent.click(screen.getByText("Modo Gerir"));
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByText("Configure este computador")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ex: Mesa do maestro, sala de ensaio, igreja...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Orquestra, igreja, ministério...")).toBeInTheDocument();
    expect(screen.queryByText("Computer ID")).not.toBeInTheDocument();
  });

  it("shows the client copy and organization field", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Próximo"));
    fireEvent.click(screen.getByText("Modo Consultar"));
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: Mesa do maestro, sala de ensaio, igreja...")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ex: Orquestra, igreja, ministério...")).toBeInTheDocument();
  });

  it("shows cloud provider tabs and switches between standard and advanced providers", async () => {
    renderWithAppProvider(<FirstRunPage />);

    fireEvent.click(screen.getByText("Próximo"));
    fireEvent.click(screen.getByText("Modo Gerir"));
    fireEvent.click(screen.getByText("Próximo"));
    fireEvent.change(
      screen.getByPlaceholderText("Ex: Mesa do maestro, sala de ensaio, igreja..."),
      { target: { value: "Maestro" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Ex: Orquestra, igreja, ministério..."),
      { target: { value: "Orquestra" } },
    );
    fireEvent.click(screen.getByText("Próximo"));

    await waitFor(() => {
      expect(screen.getByText("Escolha e conecte ao Provedor de Nuvem")).toBeInTheDocument();
    });

    expect(screen.getByText("Provedores de Nuvem")).toBeInTheDocument();
    expect(screen.getByText("Opções avançadas")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Koofr" })).toBeInTheDocument();
    expect(screen.queryByText("WebDAV")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Opções avançadas"));

    expect(screen.getByText("WebDAV")).toBeInTheDocument();
    expect(screen.getByText("SFTP")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Koofr" })).not.toBeInTheDocument();
  });
});
