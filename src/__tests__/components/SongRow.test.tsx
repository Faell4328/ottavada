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
  const onToggleSelect = vi.fn();
  const onToggleFavorite = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onDeleteWithFiles = vi.fn();
  const onStatusChange = vi.fn();
  const onReindex = vi.fn();
  const onMenuOpen = vi.fn();
  const onMenuClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the song location from the overflow menu", async () => {
    const openFileLocationSpy = vi
      .spyOn(api, "openFileLocation")
      .mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={song}
            isExpanded={true}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Abrir local"));

    await waitFor(() => {
      expect(openFileLocationSpy).toHaveBeenCalledWith(song.path);
    });
  });

  it("closes the overflow menu when clicking outside", () => {
    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={song}
            isExpanded={true}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    fireEvent.mouseDown(document.body);

    expect(onMenuClose).toHaveBeenCalled();
  });

  it("shows both delete options and deletes the directory when requested", async () => {
    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={song}
            isExpanded={true}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Remover"));

    expect(screen.getByText("Remoção")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mover pasta e arquivos para lixeira"));

    await waitFor(() => {
      expect(onDeleteWithFiles).toHaveBeenCalledWith(song.id);
    });
  });

  it("opens a folder picker and reindexes the selected directory from the overflow menu", async () => {
    const reindexSongDirectorySpy = vi
      .spyOn(api, "reindexSongDirectory")
      .mockResolvedValue(song);
    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValue("C:/music/new-canon");

    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={{ ...song, status: "not_found" }}
            isExpanded={true}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Reindexar pasta"));

    await waitFor(() => {
      expect(reindexSongDirectorySpy).toHaveBeenCalledWith(
        song.id,
        "C:/music/new-canon",
      );
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
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Não permitir envio"));

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
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Envio permitido")).toBeInTheDocument();
    expect(screen.getByText("Envio permitido").closest("tr")).toHaveClass(
      "bg-white",
    );

    rerender(
      <table>
        <tbody>
          <MemoizedSongRow
            song={draftSong}
            isExpanded={true}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Envio não permitido")).toBeInTheDocument();
    expect(screen.getByText("Envio não permitido").closest("tr")).toHaveClass(
      "bg-[#fff7ed]",
    );
  });

  it("renders not_found songs with dedicated styling and actions", () => {
    const missingSong = { ...song, status: "not_found" as const };

    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={missingSong}
            isExpanded={true}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={true}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Sem partitura")).toBeInTheDocument();
    expect(screen.getByText("Sem partitura").closest("tr")).toHaveClass(
      "bg-[#fff1f2]",
    );
    expect(screen.getByText("Reindexar pasta")).toBeInTheDocument();
    expect(screen.getByText("Parar de indexar pasta")).toBeInTheDocument();
  });

  it("renders the resolved category names joined by comma", () => {
    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={{ ...song, category_ids: ["cat-1", "cat-2", "missing"] }}
            isExpanded={false}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={false}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[
              { id: "cat-1", name: "Hinos", updated_at: "", updated_by: "" },
              { id: "cat-2", name: "Avulsos", updated_at: "", updated_by: "" },
            ]}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Hinos, Avulsos")).toBeInTheDocument();
  });

  it("renders a dash when the song has no resolvable categories", () => {
    render(
      <table>
        <tbody>
          <MemoizedSongRow
            song={song}
            isExpanded={false}
            isSelected={false}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteWithFiles={onDeleteWithFiles}
            onStatusChange={onStatusChange}
            onReindex={onReindex}
            menuId="song-1"
            isMenuOpen={false}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            computerType="Server"
            isLocked={false}
            categories={[]}
          />
        </tbody>
      </table>,
    );

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
