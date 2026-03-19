import { Cloud, Usb, Settings, Loader } from "lucide-react";
import { useNavigate } from "react-router";
import { useAppState } from "../context/AppContext";

export default function StatusBar() {
  const navigate = useNavigate();
  const { state } = useAppState();

  const progressPercentage =
    state.scanProgress.total > 0
      ? Math.round((state.scanProgress.completed / state.scanProgress.total) * 100)
      : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full flex h-10 items-center justify-between border-t border-[#c0cad7] bg-gradient-to-b from-[#e9edf3] to-[#dde3eb] px-3 z-50">
      <div className="flex items-center gap-4">
        {state.isScanningFiles ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-[#354c63]">
            <Loader className="h-3.5 w-3.5 animate-spin text-blue-600" />
            {state.scanProgress.total > 0 ? (
              <>
                <div className="h-1.5 w-24 rounded-full bg-[#dde3eb] overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-blue-600">{progressPercentage}%</span>
                {state.scanProgress.changedFiles > 0 && (
                  <span className="text-green-600 font-semibold">
                    {state.scanProgress.changedFiles} alterado(s)
                  </span>
                )}
              </>
            ) : (
              <span className="text-blue-600">Verificando alterações...</span>
            )}
          </div>
        ) : (
          <>
            <StatusIndicator
              icon={<Cloud className="h-4 w-4" />}
              label="Google Drive"
              status="Sincronizado"
              highlight
            />
            <StatusIndicator
              icon={<Usb className="h-4 w-4" />}
              label="Backup USB"
              actionLabel="Fazer backup"
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="flex h-7 items-center gap-1.5 rounded-md border border-[#b5c1cf] bg-[#f7f9fc] px-3 text-xs font-semibold text-[#374f67] hover:bg-[#eef2f7] transition-colors cursor-pointer"
      >
        <Settings className="h-3.5 w-3.5" />
        <span>Configurações</span>
      </button>
    </footer>
  );
}

function StatusIndicator({
  icon,
  label,
  status,
  highlight,
  actionLabel,
}: {
  icon: React.ReactNode;
  label: string;
  status?: string;
  highlight?: boolean;
  actionLabel?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#354c63]">
      <span
        className={`${highlight ? "text-green-600" : "text-[#6b849e]"}`}
      >
        {icon}
      </span>
      {label}
      {status && (
        <strong className="text-green-600">{status}</strong>
      )}
      {actionLabel && (
        <button
          type="button"
          className="ml-1 text-[11px] text-[#4f84d7] hover:underline bg-transparent border-0 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </span>
  );
}
