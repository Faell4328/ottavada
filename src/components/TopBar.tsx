interface TopBarProps {
  title?: string;
}

export default function TopBar({ title = "Score Maestro" }: TopBarProps) {
  return (
    <header className="flex h-[52px] items-center justify-between bg-gradient-to-b from-[#33465d] to-[#23364b] px-4 text-white border-b border-white/15" data-tauri-drag-region>
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">𝄞</span>
        <span className="text-xl font-bold tracking-tight">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        <ActionButton icon="💾" />
        <ActionButton icon="🖉" />
        <ActionButton icon="☰" />
        <ActionButton icon="🔔" />
      </div>
    </header>
  );
}

function ActionButton({ icon }: { icon: string }) {
  return (
    <button
      type="button"
      className="flex h-8 w-9 items-center justify-center rounded border border-white/25 bg-white/8 text-sm text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
    >
      {icon}
    </button>
  );
}
