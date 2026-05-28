import { Minus, PencilLine, Plus } from "lucide-react";
import type { ReactNode } from "react";

import type { ScanResult } from "../api/commands";
import { Modal } from "./ui";

interface ScanReportModalProps {
  isOpen: boolean;
  report: ScanResult | null;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ScanReportModal({
  isOpen,
  report,
  isConfirming,
  onClose,
  onConfirm,
}: ScanReportModalProps) {
  if (!isOpen || !report) {
    return null;
  }

  const hasAdded = report.added_files.length > 0;
  const hasRemoved = report.not_found_files.length > 0;
  const hasChanged = report.changed_files.length > 0;
  const hasAnyChanges = hasAdded || hasRemoved || hasChanged;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Relatório da verificação"
      maxWidth="max-w-3xl"
      footer={(
        <div className="flex w-full justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg border border-[#c5cfdb] px-4 py-2 text-sm font-semibold text-[#344b61] transition-colors hover:bg-[#f2f5fa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-[#4f84d7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3d6fb8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? "Aplicando..." : "Continuar"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {hasAnyChanges ? (
          <div className="space-y-4">
            <PlainGroup
              title="Arquivos adicionados"
              icon={<Plus className="h-4 w-4" />}
              items={report.added_files}
              emptyLabel="Nenhum arquivo adicionado."
            />
            <PlainGroup
              title="Arquivos removidos"
              icon={<Minus className="h-4 w-4" />}
              items={report.not_found_files}
              emptyLabel="Nenhum arquivo removido."
            />
            <PlainGroup
              title="Arquivos alterados"
              icon={<PencilLine className="h-4 w-4" />}
              items={report.changed_files}
              emptyLabel="Nenhum arquivo alterado."
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d3deea] bg-white px-4 py-8 text-center text-sm text-[#60748d]">
            Nenhuma alteração encontrada.
          </div>
        )}
      </div>
    </Modal>
  );
}

function PlainGroup({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <section className="rounded-xl border border-[#dbe5f0] bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#2f4259]">
        <span className="text-[#4f84d7]">{icon}</span>
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 text-sm text-[#4a6278]">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-[#e5edf6] bg-[#f9fbfe] px-3 py-2 break-all whitespace-normal"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[#7a8fa8]">{emptyLabel}</p>
      )}
    </section>
  );
}

