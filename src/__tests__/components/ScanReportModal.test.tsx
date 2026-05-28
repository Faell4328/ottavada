import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScanReportModal } from "../../components/ScanReportModal";

const report = {
  changed_files: ["/music/Canon - Flauta.musx"],
  added_files: ["/music/Canon - Oboe.musx"],
  not_found_files: ["/music/Canon - Trompete.musx"],
  recovered_files: [],
  failed_files: [],
  report_items: [
    "Música criada: Canon",
    "Música alterada: Canon",
    "Música removida: Hino Antigo",
    "Partitura adicionada: /music/Canon - Oboe.musx",
    "Partitura adicionada: /music/Canon - Trompete.musx",
    "Partitura alterada: /music/Canon - Flauta.musx",
    "Partitura removida: /music/Canon - Clarinete.musx",
    "Categoria criada: Coral",
    "Categoria removida: Juventude",
    "Compositor da música CANON: J. S. Bach",
    "Arranjador removido da música CANON",
  ],
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
    expect(screen.getByText("Resumo das alterações")).toBeInTheDocument();
    expect(screen.getByText("Músicas criadas")).toBeInTheDocument();
    expect(screen.getByText("Músicas alteradas")).toBeInTheDocument();
    expect(screen.getByText("Músicas removidas")).toBeInTheDocument();
    expect(screen.getByText("Partituras adicionadas")).toBeInTheDocument();
    expect(screen.getByText("Partituras alteradas")).toBeInTheDocument();
    expect(screen.getByText("Partituras removidas")).toBeInTheDocument();
    expect(screen.getByText("Categorias criadas")).toBeInTheDocument();
    expect(screen.getByText("Categorias removidas")).toBeInTheDocument();
    expect(screen.getByText("Compositores alterados")).toBeInTheDocument();
    expect(screen.getByText("Arranjadores removidos")).toBeInTheDocument();
    expect(screen.getByText("Hino Antigo")).toBeInTheDocument();
    expect(screen.getByText("Canon: Oboe, Trompete")).toBeInTheDocument();
    expect(screen.getByText("Canon: Flauta")).toBeInTheDocument();
    expect(screen.getByText("Canon: Clarinete")).toBeInTheDocument();
    expect(screen.getByText("Coral")).toBeInTheDocument();
    expect(screen.getByText("Juventude")).toBeInTheDocument();
    expect(screen.getByText("CANON: J. S. Bach")).toBeInTheDocument();
    expect(screen.getAllByText("CANON").length).toBeGreaterThan(0);
    expect(screen.queryByText("Arquivos recuperados")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivos com erro")).not.toBeInTheDocument();
  });
});
