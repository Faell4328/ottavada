import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectBackupModal } from "../../components/SelectBackupModal";
import type { AvailableBackup } from "../../api/commands";

const sampleBackups: AvailableBackup[] = [
  {
    file_name: "backup - 1710684000.msgpack.zst",
    file_path: "/backups/backup - 1710684000.msgpack.zst",
    file_size: 1024 * 1024,
    generated_at: 1710684000,
  },
  {
    file_name: "backup - 1710770400.msgpack.zst",
    file_path: "/backups/backup - 1710770400.msgpack.zst",
    file_size: 2 * 1024 * 1024,
    generated_at: 1710770400,
  },
];

describe("SelectBackupModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SelectBackupModal
        isOpen={false}
        isLoading={false}
        backups={sampleBackups}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the loading state while backups are being fetched", () => {
    render(
      <SelectBackupModal
        isOpen
        isLoading
        backups={[]}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText(/Carregando backups disponíveis/)).toBeInTheDocument();
  });

  it("shows an empty message when no backups are available", () => {
    render(
      <SelectBackupModal
        isOpen
        isLoading={false}
        backups={[]}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText(/Nenhum backup encontrado na nuvem/)).toBeInTheDocument();
  });

  it("lists backups with date, time and size", () => {
    render(
      <SelectBackupModal
        isOpen
        isLoading={false}
        backups={sampleBackups}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    const items = screen.getAllByTestId("select-backup-item");
    expect(items).toHaveLength(2);

    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getAllByText(/2024/).length).toBeGreaterThanOrEqual(2);
  });

  it("invokes onSelect with the chosen backup when continue is pressed", () => {
    const onSelect = vi.fn();
    render(
      <SelectBackupModal
        isOpen
        isLoading={false}
        backups={sampleBackups}
        onClose={() => undefined}
        onSelect={onSelect}
      />,
    );

    const items = screen.getAllByTestId("select-backup-item");
    fireEvent.click(items[0]);
    fireEvent.click(screen.getByText("Continuar"));

    expect(onSelect).toHaveBeenCalledWith(sampleBackups[0]);
  });

  it("invokes onClose when cancel is pressed", () => {
    const onClose = vi.fn();
    render(
      <SelectBackupModal
        isOpen
        isLoading={false}
        backups={sampleBackups}
        onClose={onClose}
        onSelect={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps continue disabled until a backup is selected", () => {
    render(
      <SelectBackupModal
        isOpen
        isLoading={false}
        backups={sampleBackups}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Continuar")).toBeDisabled();
  });
});
