import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeComputerTypeModal } from "../../components/ChangeComputerTypeModal";

describe("ChangeComputerTypeModal", () => {
  it("should render the modal when isOpen is true", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText("Alteração Importante")).toBeInTheDocument();
    expect(
      screen.getByText(/Você está alterando o tipo de computador/)
    ).toBeInTheDocument();
  });

  it("should not render the modal when isOpen is false", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    const { container } = render(
      <ChangeComputerTypeModal
        isOpen={false}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should show cancel button enabled", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByText("Cancelar");
    expect(cancelButton).not.toBeDisabled();
  });

  it("should call onClose when cancel button is clicked", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should display countdown timer on confirm button", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText(/\(5s\)/)).toBeInTheDocument();
  });

  it("should disable confirm button initially", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const confirmButton = screen.getAllByText(/Confirmar/).find(
      (el) => (el as HTMLButtonElement).type === "button"
    ) as HTMLButtonElement;

    expect(confirmButton).toBeDisabled();
  });

  it("should show correct impact for Server to Client change", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Server"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText(/Deixará de indexar diretórios locais/)).toBeInTheDocument();
    expect(screen.getByText(/Passará a consultar partituras no servidor/)).toBeInTheDocument();
    expect(screen.getByText(/Poderá apenas propor alterações/)).toBeInTheDocument();
  });

  it("should show correct impact for Client to Server change", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ChangeComputerTypeModal
        isOpen={true}
        currentType="Client"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText(/Passará a indexar diretórios locais/)).toBeInTheDocument();
    expect(screen.getByText("Servidor")).toBeInTheDocument();
  });
});
