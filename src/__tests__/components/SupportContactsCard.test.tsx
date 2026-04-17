import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SupportContactsCard } from "../../components/SupportContactsCard";

describe("SupportContactsCard", () => {
  it("renders configured contact links", () => {
    render(<SupportContactsCard email="contato@exemplo.com" phone="+55 11 99999-9999" />);

    expect(screen.getByText("contato@exemplo.com")).toHaveAttribute(
      "href",
      "mailto:contato@exemplo.com"
    );
    expect(screen.getByText("+55 11 99999-9999")).toHaveAttribute(
      "href",
      "tel:+55 11 99999-9999"
    );
  });

  it("shows fallback text when contacts are not configured", () => {
    render(<SupportContactsCard email={null} phone={null} />);

    expect(screen.getAllByText("Não configurado")).toHaveLength(2);
  });
});