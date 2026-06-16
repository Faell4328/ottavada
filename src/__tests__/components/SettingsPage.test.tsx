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

    expect(screen.getByPlaceholderText("Ex: Orquestra, Igreja, Ministério...")).toBeInTheDocument();
    expect(screen.getByText("Opcional no computador de ensaio, mas útil para identificar a organização.")).toBeInTheDocument();
  });
});