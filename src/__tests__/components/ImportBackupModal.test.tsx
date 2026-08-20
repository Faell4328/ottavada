import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportBackupModal } from "../../components/ImportBackupModal";
import type { CloudBackupValidation } from "../../api/commands";

const sampleSummary: CloudBackupValidation = {
  found: true,
  generated_at: 1710684000,
  songs_count: 12,
  scores_count: 34,
  categories_count: 5,
  composers_count: 6,
  arrangers_count: 7,
};

describe("ImportBackupModal", () => {
  it("should render the modal when isOpen is true", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        summary={sampleSummary}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText("Importar backup")).toBeInTheDocument();
    expect(
      screen.getByText(/Você está prestes a importar o backup mais recente da nuvem/),
    ).toBeInTheDocument();
  });

  it("should not render the modal when isOpen is false", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    const { container } = render(
      <ImportBackupModal
        isOpen={false}
        summary={sampleSummary}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should show the backup summary with date and counts", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        summary={sampleSummary}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(
      screen.getByText(/12 músicas/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/34 partituras/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/5 categorias/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/6 compositores/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/7 arranjadores/),
    ).toBeInTheDocument();
  });

  it("should show a loading state while the backup is being validated", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        isLoading={true}
        summary={null}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(
      screen.getByText(/Validando o backup da nuvem/),
    ).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        summary={sampleSummary}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should display countdown timer on confirm button", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        summary={sampleSummary}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText(/\(5s\)/)).toBeInTheDocument();
  });

  it("should show impact items", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        summary={sampleSummary}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(
      screen.getByText(/Substituirá todas as músicas, partituras e configurações atuais/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Substitui os dados locais pelo conteúdo do backup/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Não pode ser desfeito após o fim da contagem regressiva/),
    ).toBeInTheDocument();
  });
});
