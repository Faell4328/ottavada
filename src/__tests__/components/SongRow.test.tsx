import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoizedSongRow } from "../../components/SongRow";
import type { SongListItem } from "../../types";
import * as api from "../../api/commands";

vi.mock("../../api/commands", () => ({
  openFileLocation: vi.fn(),
  deleteSongWithFiles: vi.fn(),
  reindexSongDirectory: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const song: SongListItem = {
  id: "song-1",
  name: "HINO NACIONAL",
  composer: "JOEL",
  arranger: null,
  path: "/music/HINO NACIONAL",
  updated_at: "2024-01-01 12:00:00",
  is_favorite: false,
  status: "main",
  category_ids: [],
  scores: [],
};

describe("SongRow menu", () => {
  const onToggle = vi.fn();
  const onToggleFavorite = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onStatusChange = vi.fn();
  const onReindex = vi.fn();
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
            onStatusChange={onStatusChange}
            onReindex={onReindex}
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

  it("shows both delete options and deletes the directory when requested", async () => {
    const deleteSongWithFilesSpy = vi.spyOn(api, "deleteSongWithFiles").mockResolvedValue(undefined);

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
            onStatusChange={onStatusChange}
            onReindex={onReindex}
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

    fireEvent.click(screen.getByText("Mover para Lixeira"));

    expect(screen.getByText("Parar de indexar diretório")).toBeInTheDocument();
    expect(screen.getByText("Mover diretório e arquivos para lixeira")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mover diretório e arquivos para lixeira"));

    await waitFor(() => {
      expect(deleteSongWithFilesSpy).toHaveBeenCalledWith(song.id);
    });
  });

  it("opens a folder picker and reindexes the selected directory from the overflow menu", async () => {
    const reindexSongDirectorySpy = vi.spyOn(api, "reindexSongDirectory").mockResolvedValue(song);
    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValue("C:/music/new-canon");

    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={{ ...song, status: "not_found" }}
            isExpanded={true}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
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

    fireEvent.click(screen.getByText("Reindexar música"));

    await waitFor(() => {
      expect(reindexSongDirectorySpy).toHaveBeenCalledWith(song.id, "C:/music/new-canon");
      expect(onReindex).toHaveBeenCalled();
    });
  });

  it("toggles the song status from the overflow menu", async () => {
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
            onStatusChange={onStatusChange}
            onReindex={onReindex}
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

    fireEvent.click(screen.getByText("Definir como rascunho"));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith(song.id, "draft");
    });
  });

  it("renders draft songs with highlighted styling and main songs as normal rows", () => {
    const draftSong = { ...song, status: "draft" as const };

    const { rerender } = render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={song}
            isExpanded={true}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
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

    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Principal").closest("tr")).toHaveClass("bg-white");

    rerender(
      <table>
        <tbody>
          <MemoizedSongRow
            song={draftSong}
            isExpanded={true}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
              onReindex={onReindex}
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

    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Rascunho").closest("tr")).toHaveClass("bg-[#fff7ed]");
  });

  it("renders not_found songs with dedicated styling and actions", () => {
    const missingSong = { ...song, status: "not_found" as const };

    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={missingSong}
            isExpanded={true}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
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

    expect(screen.getByText("Sem partitura")).toBeInTheDocument();
    expect(screen.getByText("Sem partitura").closest("tr")).toHaveClass("bg-[#fff1f2]");
    expect(screen.getByText("Reindexar música")).toBeInTheDocument();
    expect(screen.getByText("Mover para Lixeira")).toBeInTheDocument();
  });
});
