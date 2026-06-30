import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoizedScoreRow } from "../../components/ScoreRow";
import type { ScoreListItem } from "../../types";
import * as api from "../../api/commands";

vi.mock("../../api/commands", () => ({
  openFile: vi.fn(),
  openFileLocation: vi.fn(),
}));

const score: ScoreListItem = {
  id: "score-1",
  name: "Flauta",
  file_path: "/music/HINO NACIONAL - Flauta.musx",
  file_extension: "musx",
  updated_at: "2024-01-01 12:00:00",
  status: "main",
};

describe("ScoreRow menu", () => {
  const onSelectScore = vi.fn();
  const onMenuOpen = vi.fn();
  const onMenuClose = vi.fn();
  const onEdit = vi.fn();
  const onStatusChange = vi.fn();
  const onDelete = vi.fn();
  const onUseAsBase = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places status actions after use as base", () => {
    render(
      <table>
        <tbody>
          <MemoizedScoreRow
            score={score}
            displayIndex={0}
            onSelectScore={onSelectScore}
            menuId="score-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onUseAsBase={onUseAsBase}
            computerType="Server"
            isLocked={false}
          />
        </tbody>
      </table>,
    );

    const menuLabels = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter((label): label is string => Boolean(label));

    expect(menuLabels).toEqual([
      "Abrir",
      "Abrir local",
      "Editar",
      "Usar como base",
      "Não permitir envio",
      "Ignorar partitura",
      "Mover para lixeira",
    ]);
  });

  it("opens the score location from the overflow menu", async () => {
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <MemoizedScoreRow
            score={score}
            displayIndex={0}
            onSelectScore={onSelectScore}
            menuId="score-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onUseAsBase={onUseAsBase}
            computerType="Server"
            isLocked={false}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(score.file_path);
    });
  });
});
