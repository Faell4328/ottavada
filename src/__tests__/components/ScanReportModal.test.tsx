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
    "Música criada: Hino Nacional",
    "A música Eis o Nosso Deus teve o nome alterado.",
    "A música Hino Antigo foi deletada.",
    "Partitura adicionada: /music/Eis o Nosso Deus - Oboe.musx",
    "Partitura adicionada: /music/Eis o Nosso Deus - Tenor Saxophone.musx",
    "Partitura adicionada: /music/Eis o Nosso Deus - Flauta.pdf",
    "A partitura Oboes.musx teve o nome alterado.",
    "A partitura Clarinete.musx foi deletada.",
    "Categoria criada: Coral",
    "A categoria Juventude foi deletada.",
    "A categoria Sem categoria foi adicionada à música 03 VEZES SANTO.",
    "A categoria Sem categoria foi removida da música 03 VEZES SANTO.",
    "A categoria Hinos foi adicionada à música 3 VEZES SANTO.",
    "A categoria Hinos foi removida da música 3 VEZES SANTO.",
    "O compositor Neusom foi adicionado à música Eis o Nosso Deus.",
    "O compositor Neusom foi deletado da música Eis o Nosso Deus.",
    "O arranjador Maria foi adicionado à música Eis o Nosso Deus.",
    "O arranjador Maria foi deletado da música Eis o Nosso Deus.",
    "A partitura Flauta.musx foi deletada.",
    "A partitura Flauta.musx saiu de draft e voltou para main na música Eis o Nosso Deus.",
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
    expect(screen.getByText("Revisão das alterações")).toBeInTheDocument();
    expect(screen.getByText("Adicionando")).toBeInTheDocument();
    expect(screen.getByText("Modificado")).toBeInTheDocument();
    expect(screen.getByText("Deletado")).toBeInTheDocument();
    expect(screen.getAllByText("Categorias").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Compositores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Arranjadores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Músicas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partituras").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A categoria Coral foi adicionada.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A categoria Juventude foi deletada.").length).toBeGreaterThan(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("Sem categoria") ?? false).length).toBe(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A categoria Hinos foi adicionada à música 3 VEZES SANTO.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A categoria Hinos foi removida da música 3 VEZES SANTO.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A música Hino Nacional foi adicionada.").length).toBeGreaterThan(0);
    expect(screen.getByText("Hino Nacional").tagName).toBe("STRONG");
    expect(screen.getAllByText((_, element) => element?.textContent === "A música Eis o Nosso Deus teve o nome alterado.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A música Hino Antigo foi deletada.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O compositor Neusom foi modificado na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O compositor Neusom foi deletado da música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O arranjador Maria foi modificado na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O arranjador Maria foi deletado da música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Oboe.musx foi adicionada na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Tenor Saxophone.musx foi adicionada na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Oboes.musx teve o nome alterado.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Flauta.pdf teve a extensão alterada na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Flauta.musx saiu de draft e voltou para main na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Clarinete.musx foi deletada.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Arquivos recuperados")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivos com erro")).not.toBeInTheDocument();
  });
});
