import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoizedSongRow } from "../../components/SongRow";
import type { SongListItem } from "../../types";
import * as api from "../../api/commands";

vi.mock("../../api/commands", () => ({
  openFileLocation: vi.fn(),
}));

const song: SongListItem = {
  id: "song-1",
  name: "HINO NACIONAL",
  composer: "JOEL",
  arranger: null,
  path: "/music/HINO NACIONAL",
  updated_at: "2024-01-01 12:00:00",
  is_favorite: false,
  category_ids: [],
  scores: [],
};

describe("SongRow menu", () => {
  const onToggle = vi.fn();
  const onToggleFavorite = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onMenuOpen = vi.fn();
  const onMenuClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the song location from the overflow menu", async () => {
    const openFileLocationSpy = vi.spyOn(api, "openFileLocation").mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={song}
            isExpanded={true}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByText("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(song.path);
    });
  });
});
