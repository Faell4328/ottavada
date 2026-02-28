import type { StatusItem } from "../types";

interface StatusBarProps {
  items: StatusItem[];
}

export default function StatusBar({ items }: StatusBarProps) {
  return (
    <footer className="flex h-10 items-center justify-between border-t border-[#c0cad7] bg-gradient-to-b from-[#e9edf3] to-[#dde3eb] px-3">
      <div className="flex items-center gap-4">
        {items.map((item) => (
          <StatusIndicator key={item.label} item={item} />
        ))}
      </div>
      <SettingsButton />
    </footer>
  );
}

function StatusIndicator({ item }: { item: StatusItem }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#354c63]">
      <span
        className={`text-sm ${
          item.highlight ? "text-green-600" : "text-[#6b849e]"
        }`}
      >
        {item.icon}
      </span>
      {item.label}
      {item.highlight && (
        <strong className="text-green-600">Ativado</strong>
      )}
    </span>
  );
}

function SettingsButton() {
  return (
    <button
      type="button"
      className="flex h-7 items-center gap-1.5 rounded-md border border-[#b5c1cf] bg-[#f7f9fc] px-3 text-xs font-semibold text-[#374f67] hover:bg-[#eef2f7] transition-colors cursor-pointer"
    >
      <span>⚙</span>
      <span>Configurações</span>
      <span className="text-[10px] text-[#8b9db2]">▾</span>
    </button>
  );
}
