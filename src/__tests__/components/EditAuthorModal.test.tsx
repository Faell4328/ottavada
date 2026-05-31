import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditAuthorModal } from "../../components/EditAuthorModal";

describe("EditAuthorModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("blocks empty names", () => {
    render(
      <EditAuthorModal
        isOpen={true}
        author={{ kind: "composer", name: "Bach" }}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Bach"), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("saves the edited author name", async () => {
    render(
      <EditAuthorModal
        isOpen={true}
        author={{ kind: "arranger", name: "Ana" }}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Ana"), {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("arranger", "Ana", "Bruno");
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});