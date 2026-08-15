import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScanReportModal } from "../../components/ScanReportModal";

const report = {
  changed_files: ["/music/Canon - Flauta.musx"],
  added_files: ["/music/Canon - Oboe.musx"],
  deleted_files: ["/music/Canon - Trompete.musx"],
  recovered_files: [],
  failed_files: [],
  report_items: [
    "Song created: Hino Nacional",
    "The song Eis o Nosso Deus had its name changed.",
    "The song Hino Antigo was deleted.",
    "The song Eis o Nosso Deus went from draft and returned to main.",
    "Score added: /music/Eis o Nosso Deus - Oboe.musx",
    "Score added: /music/Eis o Nosso Deus - Tenor Saxophone.musx",
    "Score added: /music/Eis o Nosso Deus - Flauta.pdf",
    "Score added: Score.pdf in the song 03 VEZES SANTO.",
    "Score added: Score.MUS in the song 03 VEZES SANTO.",
    "Score added: VEZES SANTO.MUS in the song 03 VEZES SANTO.",
    "Score changed: /music/Eis o Nosso Deus - Oboes.musx",
    "Score changed: /music/Eis o Nosso Deus - Clarinete.musx",
    "The score /music/Eis o Nosso Deus - Trompete.musx was deleted.",
    "The score /music/Eis o Nosso Deus - Trombone.musx was deleted.",
    "Score changed: /music/03 VEZES SANTO/03 VEZES SANTO.musx",
    "The score /music/03 VEZES SANTO/03 VEZES SANTO.musx was deleted.",
    "Category created: Coral",
    "The category Juventude was deleted.",
    "The category Uncategorized was added to the song 03 VEZES SANTO.",
    "The category Uncategorized was removed from the song 03 VEZES SANTO.",
    "The category Hinos was added to the song 3 VEZES SANTO.",
    "The category Hinos was removed from the song 3 VEZES SANTO.",
    "The composer Neusom was added to the song Eis o Nosso Deus.",
    "The composer Neusom was changed in the song Eis o Nosso Deus.",
    "The composer Neusom was deleted from the song Eis o Nosso Deus.",
    "The arranger Maria was added to the song Eis o Nosso Deus.",
    "The arranger Maria was changed in the song Eis o Nosso Deus.",
    "The arranger Maria was deleted from the song Eis o Nosso Deus.",
    "The score /music/Eis o Nosso Deus - Flauta.musx went from draft and returned to main in the song Eis o Nosso Deus.",
    "The score /music/Eis o Nosso Deus - Flute2.musx went from ignored and went to draft in the song Eis o Nosso Deus.",
    "Score changed: /music/Eis o Nosso Deus - CANON.musx",
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
    expect(screen.getAllByText((_, element) => element?.textContent === "O compositor da música Eis o Nosso Deus foi alterado para Neusom.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O arranjador da música Eis o Nosso Deus foi alterado para Maria.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O compositor Neusom foi deletado da música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "O arranjador Maria foi deletado da música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "As partituras Flauta.pdf, Oboe.musx and Tenor Saxophone.musx foram adicionadas na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("Partituras · Eis o Nosso Deus") ?? false).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("Partituras · 03 VEZES SANTO") ?? false).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) =>
        Boolean(
            element?.textContent?.includes("Score.pdf") &&
            element?.textContent?.includes("Score.MUS") &&
            element?.textContent?.includes("No Instrument.MUS") &&
            element?.textContent?.includes("03 VEZES SANTO") &&
            element?.textContent?.includes("foram adicionadas")
        )
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) =>
        Boolean(
          element?.textContent?.includes("foram alteradas") &&
          element?.textContent?.includes("Eis o Nosso Deus") &&
          element?.textContent?.includes("Oboes.musx") &&
          element?.textContent?.includes("Clarinete.musx") &&
          element?.textContent?.includes("CANON.musx")
        )
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "As partituras Trompete.musx and Trombone.musx foram deletadas na música Eis o Nosso Deus.").length).toBeGreaterThan(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("No Instrument") ?? false).length).toBeGreaterThan(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("03 VEZES SANTO.musx") ?? false).length).toBe(0);
    expect(screen.queryAllByText((_, element) => element?.textContent?.includes("VEZES SANTO.MUS foi adicionada") ?? false).length).toBe(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("A partitura /music/Eis o Nosso Deus - Flauta.musx saiu de Envio não permitido e voltou para Envio permitido na música Eis o Nosso Deus") ?? false).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("A partitura /music/Eis o Nosso Deus - Flute2.musx saiu de Ignorada e foi para Envio não permitido na música Eis o Nosso Deus") ?? false).length).toBeGreaterThan(0);
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
            "The score Score had its name changed in the song 03 VEZES SANTO.",
            "Score added: /music/03 VEZES SANTO/03 VEZES SANTO - Score.MUS",
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
          report_items: ["The song Eis o Nosso Deus went from draft and returned to main."],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    const musicSection = screen.getByText("Músicas").closest("section");
    expect(musicSection).toHaveTextContent("A música Eis o Nosso Deus saiu de Envio não permitido e voltou para Envio permitido.");
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "Eis o Nosso Deus")).toBe(true);
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "Envio não permitido")).toBe(true);
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "Envio permitido")).toBe(true);
  });

  it("renders not_found to main song status changes as sem partitura to Envio permitido", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: [],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          report_items: ["The song 00 - TESTE went from not_found and returned to main."],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    const musicSection = screen.getByText("Músicas").closest("section");
    expect(musicSection).toHaveTextContent("A música 00 - TESTE saiu de Sem partitura e voltou para Envio permitido.");
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "00 - TESTE")).toBe(true);
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "Sem partitura")).toBe(true);
    expect(Array.from(musicSection?.querySelectorAll("strong") ?? []).some((element) => element.textContent === "Envio permitido")).toBe(true);
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
            "The score Flauta.musx went from main and went to draft in the song Eis o Nosso Deus.",
            "The score Oboe.musx went from main and went to draft in the song Eis o Nosso Deus.",
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
        "As partituras Flauta.musx and Oboe.musx saíram de Envio permitido e foram para Envio não permitido na música Eis o Nosso Deus."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryAllByText((_, element) =>
        element?.textContent === "A partitura Flauta.musx saiu de Envio permitido e foi para Envio não permitido na música Eis o Nosso Deus."
      ).length
    ).toBe(0);
    expect(
      screen.queryAllByText((_, element) =>
        element?.textContent === "A partitura Oboe.musx saiu de Envio permitido e foi para Envio não permitido na música Eis o Nosso Deus."
      ).length
    ).toBe(0);
  });

  it("combines file change and status change into one line for the same score", () => {
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
            "Score changed: /music/TICO-TICO NO FUBA/Flute I.musx",
            "The score Flute I.musx went from main and went to draft in the song TICO-TICO NO FUBA.",
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
        "A partitura Flute I.musx foi alterada e saiu de Envio permitido e foi para Envio não permitido na música TICO-TICO NO FUBA."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryAllByText((_, element) =>
        element?.textContent === "A partitura Flute I.musx foi alterada na música TICO-TICO NO FUBA."
      ).length
    ).toBe(0);
  });

  it("combines file change and status change in grouped items", () => {
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
            "Score changed: /music/Eis o Nosso Deus - Flauta.musx",
            "Score changed: /music/Eis o Nosso Deus - Oboe.musx",
            "The score Flauta.musx went from main and went to draft in the song Eis o Nosso Deus.",
            "The score Oboe.musx went from main and went to draft in the song Eis o Nosso Deus.",
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
        "As partituras Flauta.musx and Oboe.musx foram alteradas e saíram de Envio permitido e foram para Envio não permitido na música Eis o Nosso Deus."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryAllByText((_, element) =>
        element?.textContent === "As partituras Flauta.musx and Oboe.musx foram alteradas na música Eis o Nosso Deus."
      ).length
    ).toBe(0);
  });

  it("renders changed scores using the explicit song name format", () => {
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: [],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          report_items: ["Score changed: Score.mus in the song Bem aventurança do crente"],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getAllByText((_, element) => element?.textContent === "A partitura Score.mus foi alterada na música Bem aventurança do crente.").length).toBeGreaterThan(0);
  });

  it("renders a status selector and confirms with overrides", () => {
    const onConfirm = vi.fn();
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: ["/music/Canon - Flauta.musx"],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          score_status_changes: [
            {
              score_id: "score-1",
              song_name: "CANON",
              score_name: "Flauta.musx",
              previous_status: "main",
              detected_status: "draft",
            },
          ],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />
    );

    expect(
      screen.getAllByText((_, element) =>
        element?.textContent?.includes("Deseja definir como") ?? false
      ).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Envio permitido" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onConfirm).toHaveBeenCalledWith([
      { score_id: "score-1", target_status: "main" },
    ]);
  });

  it("confirms without overrides when the target matches the detected status", () => {
    const onConfirm = vi.fn();
    render(
      <ScanReportModal
        isOpen={true}
        report={{
          changed_files: [],
          added_files: [],
          deleted_files: [],
          recovered_files: [],
          failed_files: [],
          score_status_changes: [
            {
              score_id: "score-1",
              song_name: "CANON",
              score_name: "Flauta.musx",
              previous_status: "main",
              detected_status: "draft",
            },
          ],
        }}
        isConfirming={false}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onConfirm).toHaveBeenCalledWith([]);
  });
});
