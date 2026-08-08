import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationNameField } from "../../components/OrganizationNameField";

describe("OrganizationNameField", () => {
  it("shows the organization field for client settings", () => {
    render(
      <OrganizationNameField
        computerType="Client"
        value={null}
        disabled={false}
        onChange={() => undefined}
      />
    );

    expect(screen.getByPlaceholderText("Ex: Orquestra, igreja, ministério...")).toBeInTheDocument();
    expect(screen.getByText("Opcional no Ottavada Consulta, mas útil para identificar a organização.")).toBeInTheDocument();
  });
});