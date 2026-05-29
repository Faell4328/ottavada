import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoizedScoreRow } from "../../components/ScoreRow";
import type { ScoreListItem } from "../../types";

const mocks = vi.hoisted(() => ({
  openFileMock: vi.fn(),
  openSongLocationMock: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  openFile: mocks.openFileMock,
  openSongLocation: mocks.openSongLocationMock,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

const score: ScoreListItem = {
  id: "score-1",
  name: "Flauta",
  file_path: "C:/music/Amazing Grace/flauta.musx",
  file_extension: "musx",
  updated_at: "2026-04-08T10:00:00Z",
  status: "draft",
};

function renderScoreRow() {
  return render(
    <table>
      <tbody>
        <MemoizedScoreRow
          score={score}
          displayIndex={0}
          onSelectScore={vi.fn()}
          menuId="score-1"
          isMenuOpen={true}
          onMenuOpen={vi.fn()}
          onMenuClose={vi.fn()}
          onEdit={vi.fn()}
          onStatusChange={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onUseAsBase={vi.fn()}
          computerType="Server"
          isLocked={false}
        />
      </tbody>
    </table>
  );
}

beforeEach(() => {
  mocks.openFileMock.mockReset();
  mocks.openSongLocationMock.mockReset();
});

describe("ScoreRow", () => {
  it("keeps the status actions below the base action and exposes open local", () => {
    renderScoreRow();

    const menuButtons = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    expect(menuButtons).toEqual([
      "Abrir",
      "Abrir local",
      "Editar",
      "Usar Como Base",
      "Definir como principal",
      "Definir como ignorar",
      "Deletar",
    ]);
  });

  it("opens the song folder from the overflow menu", async () => {
    renderScoreRow();

    await act(async () => {
      fireEvent.click(screen.getByText("Abrir local"));
    });

    expect(mocks.openSongLocationMock).toHaveBeenCalledWith(score.file_path);
  });
});