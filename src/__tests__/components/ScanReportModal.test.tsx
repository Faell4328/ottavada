import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScanReportModal } from "../../components/ScanReportModal";

const report = {
  changed_files: ["/music/Canon - Flauta.musx"],
  added_files: ["/music/Canon - Oboe.musx"],
  not_found_files: ["/music/Canon - Trompete.musx"],
};

describe("ScanReportModal", () => {
  it("shows the scan report sections and file paths", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={report}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByText("Relatório da verificação")).toBeInTheDocument();
    expect(screen.getByText("Arquivos adicionados")).toBeInTheDocument();
    expect(screen.getByText("Arquivos removidos")).toBeInTheDocument();
    expect(screen.getByText("Arquivos alterados")).toBeInTheDocument();
    expect(screen.getByText("/music/Canon - Oboe.musx")).toBeInTheDocument();
    expect(screen.getByText("/music/Canon - Trompete.musx")).toBeInTheDocument();
    expect(screen.getByText("/music/Canon - Flauta.musx")).toBeInTheDocument();
    expect(screen.queryByText("Arquivos recuperados")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivos com erro")).not.toBeInTheDocument();
  });
});
