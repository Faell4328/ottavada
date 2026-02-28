import type { Version, VersionTone } from "../types";

interface VersionPanelProps {
  scoreName: string;
  versions: Version[];
}

export default function VersionPanel({
  scoreName,
  versions,
}: VersionPanelProps) {
  return (
    <aside className="flex w-[300px] flex-col bg-[#eff3f8] p-3">
      <VersionHeader scoreName={scoreName} />
      <VersionList versions={versions} />
      <VersionActions />
    </aside>
  );
}

function VersionHeader({ scoreName }: { scoreName: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 text-[#2f455e]">
      <div className="flex-1">
        <div className="text-xs font-semibold">Histórico de Versões:</div>
        <div className="text-base font-bold">{scoreName}</div>
      </div>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent text-lg text-[#4a6078] hover:bg-black/5 transition-colors cursor-pointer"
      >
        ⚙
      </button>
    </div>
  );
}

function VersionList({ versions }: { versions: Version[] }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      {versions.map((version) => (
        <VersionCard key={version.name} version={version} />
      ))}
    </div>
  );
}

const toneStyles: Record<VersionTone, string> = {
  active:
    "bg-gradient-to-b from-[#4f84d7] to-[#2d62b8] text-white border-transparent",
  draft: "bg-white border-[#cad4df] text-[#34485d]",
  ok: "bg-[#f7fafe] border-[#cad4df] text-[#34485d]",
  info: "bg-[#f5f8fc] border-[#cad4df] text-[#34485d]",
};

const toneIcons: Record<VersionTone, { icon: string; color: string }> = {
  active: { icon: "✓", color: "text-white" },
  draft: { icon: "●", color: "text-red-500" },
  ok: { icon: "●", color: "text-green-500" },
  info: { icon: "●", color: "text-blue-500" },
};

function VersionCard({ version }: { version: Version }) {
  const style = toneStyles[version.tone];
  const iconInfo = toneIcons[version.tone];

  return (
    <button
      type="button"
      className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-all hover:shadow-sm cursor-pointer ${style}`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-xs ${iconInfo.color}`}>{iconInfo.icon}</span>
        <div>
          <div className="text-[13px] font-bold leading-tight">
            {version.name}
          </div>
          <div
            className={`text-[11px] ${
              version.tone === "active" ? "text-white/80" : "text-[#6b849e]"
            }`}
          >
            {version.detail}
          </div>
        </div>
      </div>
      <span
        className={`text-sm ${
          version.tone === "active" ? "text-white/70" : "text-[#8b9db2]"
        }`}
      >
        ›
      </span>
    </button>
  );
}

function VersionActions() {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <ActionButton label="Definir Nova Versão" suffix="▾" />
      <ActionButton label="Restaurar Versão" suffix="▸" />
      <ActionButton label="Comparar" suffix="›" />
    </div>
  );
}

function ActionButton({ label, suffix }: { label: string; suffix: string }) {
  return (
    <button
      type="button"
      className="flex h-9 items-center justify-between rounded border border-[#c7d1dd] bg-[#fcfdff] px-3 text-[13px] font-semibold text-[#3c536d] hover:bg-[#f0f4f9] transition-colors cursor-pointer"
    >
      <span>{label}</span>
      <span className="text-[#8b9db2]">{suffix}</span>
    </button>
  );
}
