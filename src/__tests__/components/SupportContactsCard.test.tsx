import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SupportContactsCard } from "../../components/SupportContactsCard";

describe("SupportContactsCard", () => {
  it("renders configured contact values without making them clickable", () => {
    render(<SupportContactsCard email="contato@exemplo.com" phone="+55 11 99999-9999" />);

    expect(screen.queryByRole("link", { name: "contato@exemplo.com" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "+55 11 99999-9999" })).not.toBeInTheDocument();
    expect(screen.getByText("contato@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("+55 11 99999-9999")).toBeInTheDocument();
  });

  it("shows fallback text when contacts are not configured", () => {
    render(<SupportContactsCard email={null} phone={null} />);

    expect(screen.getAllByText("Não configurado")).toHaveLength(2);
  });
});