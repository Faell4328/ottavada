import React from "react";
import { MoreVertical } from "lucide-react";

interface ContextMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

export function ContextMenu({ isOpen, onToggle, children }: ContextMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="p-1 rounded transition-colors hover:bg-white/20"
        title="Menu de ações"
      >
        <MoreVertical className="h-4 w-4 text-[#8b9db2]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#c5cfdb] rounded shadow-lg z-50 w-48">
          {children}
        </div>
      )}
    </div>
  );
}

interface ContextMenuItemProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  isLast?: boolean;
  disabled?: boolean;
}

export function ContextMenuItem({
  label,
  onClick,
  isLast,
  disabled,
}: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 hover:bg-[#f2f5fa] text-sm text-[#344b61] transition-colors ${
        isLast ? "" : "border-b border-[#e8ecf0]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}
