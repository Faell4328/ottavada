import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScanReportModal } from "../../components/ScanReportModal";

const report = {
  changed_files: ["/music/Canon - Flauta.musx"],
  added_files: ["/music/Canon - Oboe.musx"],
  deleted_files: ["/music/Canon - Trompete.musx"],
  recovered_files: [],
  failed_files: [],
  report_items: [
    "Música criada: Hino Nacional",
    "A música Eis o Nosso Deus teve o nome alterado.",
    "A música Hino Antigo foi deletada.",
    "A música Eis o Nosso Deus saiu de rascunho e voltou para principal.",
    "Partitura adicionada: /music/Eis o Nosso Deus - Oboe.musx",
    "Partitura adicionada: /music/Eis o Nosso Deus - Tenor Saxophone.musx",
    "Partitura adicionada: /music/Eis o Nosso Deus - Flauta.pdf",
    "Partitura adicionada: Score.pdf na música 03 VEZES SANTO.",
    "Partitura adicionada: Score.MUS na música 03 VEZES SANTO.",
    "Partitura adicionada: VEZES SANTO.MUS na música 03 VEZES SANTO.",
    "Partitura alterada: /music/Eis o Nosso Deus - Oboes.musx",
    "Partitura alterada: /music/Eis o Nosso Deus - Clarinete.musx",
    "A partitura /music/Eis o Nosso Deus - Trompete.musx foi deletada.",
    "A partitura /music/Eis o Nosso Deus - Trombone.musx foi deletada.",
    "Partitura alterada: /music/03 VEZES SANTO/03 VEZES SANTO.musx",
    "A partitura /music/03 VEZES SANTO/03 VEZES SANTO.musx foi deletada.",
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
    "A partitura /music/Eis o Nosso Deus - Flauta.musx saiu de draft e voltou para main na música Eis o Nosso Deus.",
    "A partitura /music/Eis o Nosso Deus - Flute2.musx saiu de ignored e foi para draft na música Eis o Nosso Deus.",
    "Partitura alterada: /music/Eis o Nosso Deus - CANON.musx",
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
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("Partituras") ?? false).length).toBeGreaterThan(0);
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
    expect(screen.getAllByText((_, element) => element?.textContent === "As partituras Flauta.pdf, Oboe.musx e Tenor Saxophone.musx foram adicionadas na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("Partituras · Eis o Nosso Deus") ?? false).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("Partituras · 03 VEZES SANTO") ?? false).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) =>
        Boolean(
          element?.textContent?.includes("Score.pdf") &&
            element?.textContent?.includes("Score.MUS") &&
            element?.textContent?.includes("Sem Instrumento.MUS") &&
            element?.textContent?.includes("03 VEZES SANTO") &&
            element?.textContent?.includes("foram adicionadas")
        )
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "As partituras Clarinete.musx, CANON.musx e Oboes.musx foram alteradas na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "As partituras Trompete.musx e Trombone.musx foram deletadas na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("Sem Instrumento") ?? false).length).toBeGreaterThan(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("03 VEZES SANTO.musx") ?? false).length).toBe(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("VEZES SANTO.MUS foi adicionada") ?? false).length).toBe(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("A partitura /music/Eis o Nosso Deus - Flauta.musx saiu de rascunho e voltou para principal na música Eis o Nosso Deus") ?? false).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("A partitura /music/Eis o Nosso Deus - Flute2.musx saiu de ignorada e foi para rascunho na música Eis o Nosso Deus") ?? false).length).toBeGreaterThan(0);
    expect(screen.queryByText("Arquivos recuperados")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivos com erro")).not.toBeInTheDocument();
  });

  it("uses different colors for the action containers", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={report}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByText("Adicionando").closest("section")).toHaveClass("border-emerald-200", "bg-emerald-50");
    expect(screen.getByText("Modificado").closest("section")).toHaveClass("border-amber-200", "bg-amber-50");
    expect(screen.getByText("Deletado").closest("section")).toHaveClass("border-red-200", "bg-red-50");
  });

  it("hides score additions that are actually score renames", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: [],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          report_items: [
            "A partitura Score teve o nome alterado na música 03 VEZES SANTO.",
            "Partitura adicionada: /music/03 VEZES SANTO/03 VEZES SANTO - Score.MUS",
          ],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Score teve o nome alterado na música 03 VEZES SANTO.").length).toBeGreaterThan(0);
    expect(screen.queryByText((_, element) => element?.textContent?.includes("Score.MUS foi adicionada") ?? false)).not.toBeInTheDocument();
  });

  it("bolds the song name in a status change line", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: [],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          report_items: ["A música Eis o Nosso Deus saiu de rascunho e voltou para principal."],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    const musicSection = screen.getByText("Músicas").closest("section");
    expect(musicSection).toHaveTextContent("A música Eis o Nosso Deus saiu de rascunho e voltou para principal.");
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "Eis o Nosso Deus")).toBe(true);
  });

  it("groups score status changes from the same song into one line", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: [],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          report_items: [
            "A partitura Flauta.musx saiu de principal e foi para draft na música Eis o Nosso Deus.",
            "A partitura Oboe.musx saiu de principal e foi para draft na música Eis o Nosso Deus.",
          ],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(
      screen.getAllByText((_, element) =>
        element?.textContent ===
        "As partituras Flauta.musx e Oboe.musx saíram de principal e foram para rascunho na música Eis o Nosso Deus."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryAllByText((_, element) =>
        element?.textContent === "A partitura Flauta.musx saiu de principal e foi para rascunho na música Eis o Nosso Deus."
      ).length
    ).toBe(0);
    expect(
      screen.queryAllByText((_, element) =>
        element?.textContent === "A partitura Oboe.musx saiu de principal e foi para rascunho na música Eis o Nosso Deus."
      ).length
    ).toBe(0);
  });
});
