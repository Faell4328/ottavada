import { useEffect } from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import StatusBar from "../../components/StatusBar";
import { useAppState } from "../../context/AppContext";
import { renderWithAppProvider } from "../utils/renderWithAppProvider";

function StatusBarHarness({
  itemCurrent,
  itemTotal,
  title = "",
  stepCurrent = 2,
  stepTotal = 4,
}: {
  itemCurrent?: number;
  itemTotal?: number;
  title?: string;
  stepCurrent?: number;
  stepTotal?: number;
}) {
  const { setOperationStatus } = useAppState();

  useEffect(() => {
    setOperationStatus({
      title,
      stepCurrent,
      stepTotal,
      itemCurrent: itemCurrent ?? null,
      itemTotal: itemTotal ?? null,
    });
  }, [itemCurrent, itemTotal, setOperationStatus, stepCurrent, stepTotal, title]);

  return <StatusBar />;
}

describe("StatusBar", () => {
  it("shows operation progress even without scan mode active", async () => {
    renderWithAppProvider(<StatusBarHarness />);

    expect(await screen.findByText("Etapa 2 de 4")).toBeInTheDocument();
  });

  it("shows per-archive progress for song generation", async () => {
    renderWithAppProvider(
      <StatusBarHarness
        itemCurrent={3}
        itemTotal={10}
      />
    );

    expect(await screen.findByText("Etapa 2 de 4")).toBeInTheDocument();
    expect(screen.getByText("3 de 10")).toBeInTheDocument();
  });

  it("shows the client stage from the title when the internal step counter is 1 of 1", async () => {
    renderWithAppProvider(
      <StatusBarHarness
        title="Etapa 2 - Aplicando alterações"
        stepCurrent={1}
        stepTotal={1}
      />
    );

    expect(await screen.findByText("Etapa 2")).toBeInTheDocument();
    expect(screen.getByText("Etapa 2 - Aplicando alterações")).toBeInTheDocument();
  });
});
