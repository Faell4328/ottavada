import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RcloneLicenseModal } from "../../components/RcloneLicenseModal";

describe("RcloneLicenseModal", () => {
  it("shows the full license text when open", () => {
    render(<RcloneLicenseModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Licença do rclone")).toBeInTheDocument();
    expect(screen.getByText(/Permission is hereby granted, free of charge/)).toBeInTheDocument();
    expect(screen.getByText(/THE SOFTWARE IS PROVIDED \"AS IS\"/)).toBeInTheDocument();
  });

  it("closes the modal from the footer button", () => {
    const onClose = vi.fn();

    render(<RcloneLicenseModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText("Fechar"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});