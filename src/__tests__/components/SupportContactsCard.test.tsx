import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SupportContactsCard } from "../../components/SupportContactsCard";

describe("SupportContactsCard", () => {
  it("renders configured contact values without making them clickable", () => {
    render(<SupportContactsCard email="contato@exemplo.com" />);

    expect(
      screen.queryByRole("link", { name: "contato@exemplo.com" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("contato@exemplo.com")).toBeInTheDocument();
  });

  it("shows fallback text when contacts are not configured", () => {
    render(<SupportContactsCard email={null} />);

    expect(screen.getAllByText("Não configurado")).toHaveLength(1);
  });
});
