import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../context/AppContext", () => ({
  useAppState: () => ({
    state: {
      isScanningFiles: true,
      operationStatus: {
        title: "",
        detail: null,
        stepCurrent: null,
        stepTotal: null,
        itemCurrent: null,
        itemTotal: null,
      },
      rcloneProgress: {
        active: false,
        direction: null,
        bytes: 0,
        totalBytes: null,
        percentage: null,
        speedBytesPerSec: 0,
        etaSeconds: null,
      },
    },
  }),
}));

import StatusBar from "../../components/StatusBar";

describe("StatusBar loading state", () => {
  it("renders the metronome immediately while scanning without a stage label", () => {
    const { container } = render(<StatusBar />);

    expect(screen.getByText("Processando")).toBeInTheDocument();
    expect(container.querySelector('img[src="/metronome1.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/metronome2.png"]')).toBeInTheDocument();
  });
});
