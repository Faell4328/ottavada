import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditCategoryModal } from "../../components/EditCategoryModal";

describe("EditCategoryModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it("blocks empty names", () => {
    render(
      <EditCategoryModal
        isOpen={true}
        category={{ id: "c1", name: "Hinos" }}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Hinos"), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("saves the edited category name", async () => {
    render(
      <EditCategoryModal
        isOpen={true}
        category={{ id: "c1", name: "Hinos" }}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Hinos"), {
      target: { value: "Coral" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("c1", "Coral");
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});