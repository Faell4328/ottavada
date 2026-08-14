import React, { useEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ContextMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function ContextMenu({
  isOpen,
  onToggle,
  onClose,
  children,
  disabled = false,
}: ContextMenuProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="p-1 rounded transition-colors hover:bg-white/20"
        title={t("contextMenu.title")}
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
  const borderClass = isLast ? "" : "border-b border-[#e8ecf0]";
  const stateClass = disabled
    ? "opacity-50 cursor-not-allowed"
    : "hover:bg-[#f2f5fa] cursor-pointer";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-2 text-left text-sm text-[#344b61] transition-colors ${borderClass} ${stateClass}`}
    >
      {label}
    </button>
  );
}
