import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { AppSettings } from "../types";

export default function SettingsPage() {
  const { state, saveSettings } = useAppState();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(
    state.settings ?? {
      computer_id: "",
      computer_name: null,
      google_drive_mode: "Local",
      first_run_completed: true,
      google_service_account: null,
    }
  );

  function update(partial: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    await saveSettings(settings);
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white via-slate-50 to-slate-100 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#e6eef9] bg-white/6 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex h-8 w-8 items-center justify-center rounded border border-white/25 bg-white/8 hover:bg-white/15 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">Configurações</h1>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {/* Computador */}
        <Section title="Computador">
          <Field label="Nome do computador">
            <input
              value={settings.computer_name ?? ""}
              onChange={(e) =>
                update({
                  computer_name: e.target.value || null,
                })
              }
              className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
              placeholder="Ex: Estúdio, Home, Sala Ensaio..."
            />
          </Field>
        </Section>

        {/* Save */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="h-9 rounded bg-[#4f84d7] px-6 text-sm font-semibold text-white hover:bg-[#3d6fb8] transition-colors cursor-pointer border-0"
          >
            Salvar
          </button>
        </div>

        {/* Footer */}
        {
          (Math.round(Math.random()*10) == 1) ? (
            <div className="mt-12 text-center text-xs text-[#8b9db2]">
              In total, 200 cups of coffee were consumed and it is increasing ☕📈
            </div>
          ):(
            <div className="mt-12 text-center text-xs text-[#8b9db2]">
              Made by Rhafaell (@Faell4328) with lots of coffee ☕
            </div>
          )
        }
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-[#34485d] mb-3 border-b border-[#d8e0ea] pb-1">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-[#5c7089] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
