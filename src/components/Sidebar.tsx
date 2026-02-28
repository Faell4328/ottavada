import type { MenuSection } from "../types";

interface SidebarProps {
  sections: MenuSection[];
}

export default function Sidebar({ sections }: SidebarProps) {
  return (
    <aside className="flex w-[240px] flex-col gap-2.5 border-r border-white/20 bg-gradient-to-b from-[rgba(35,52,72,0.94)] to-[rgba(55,78,106,0.9)] px-3 py-3 text-[#dce7f5]">
      {/* Search input */}
      <input
        className="h-7 rounded border border-white/24 bg-white/14 px-2 text-sm text-white placeholder-white/50 outline-none focus:border-white/40"
        placeholder=""
        aria-label="Pesquisar"
      />

      {/* Filters label */}
      <FilterSection />

      {/* Menu sections */}
      {sections.map((section) => (
        <MenuBlock key={section.title} section={section} />
      ))}
    </aside>
  );
}

function FilterSection() {
  return (
    <>
      <div className="text-xs font-semibold opacity-95 flex items-center gap-1">
        <span className="text-[10px]">▼</span> Filters:
      </div>
      <div className="rounded border border-white/25 bg-[#f2f5f8] px-2 py-1.5 text-center text-lg tracking-[4px] text-[#2f4259]">
        ♬ ♪ ♫ ♩ ♫ ♬ ♫
      </div>
    </>
  );
}

function MenuBlock({ section }: { section: MenuSection }) {
  return (
    <div className="border-t border-white/15 pt-2">
      <div className="flex items-center gap-1.5 text-sm font-bold mb-1.5">
        {section.icon && <span>{section.icon}</span>}
        {section.title}
      </div>
      <nav className="flex flex-col">
        {section.items.map((item) => (
          <SidebarMenuItem
            key={item.label}
            label={item.label}
            icon={item.icon}
            active={item.active}
          />
        ))}
      </nav>
    </div>
  );
}

interface SidebarMenuItemProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
}

function SidebarMenuItem({ label, icon, active }: SidebarMenuItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 border-0 border-b border-white/12 px-1 py-1.5 text-left text-[13px] transition-colors cursor-pointer ${
        active
          ? "text-white font-medium"
          : "text-[#e8f1ff]/80 hover:text-white"
      } bg-transparent`}
    >
      {icon && <span className="text-xs opacity-80">{icon}</span>}
      {label}
    </button>
  );
}
