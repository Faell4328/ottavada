import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportBackupModal } from "../../components/ImportBackupModal";

describe("ImportBackupModal", () => {
  it("should render the modal when isOpen is true", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText("Importar backup")).toBeInTheDocument();
    expect(
      screen.getByText(/Você está prestes a importar um backup da nuvem/),
    ).toBeInTheDocument();
  });

  it("should not render the modal when isOpen is false", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    const { container } = render(
      <ImportBackupModal
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should show cancel button enabled", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    const cancelButton = screen.getByText("Cancelar");
    expect(cancelButton).not.toBeDisabled();
  });

  it("should call onClose when cancel button is clicked", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
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
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText(/\(5s\)/)).toBeInTheDocument();
  });

  it("should disable confirm button initially", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    const confirmButton = screen
      .getAllByText(/Importar/)
      .find(
        (el) => (el as HTMLButtonElement).type === "button",
      ) as HTMLButtonElement;

    expect(confirmButton).toBeDisabled();
  });

  it("should show impact items", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ImportBackupModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(
      screen.getByText(/Irá sobrescrever o banco de dados e as configurações atuais/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Substitui os dados locais pelo conteúdo do backup/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Não pode ser desfeito após o fim da contagem/),
    ).toBeInTheDocument();
  });
});
