import { useState } from "react";
import { ArrowLeft, Hash, Cloud, HardDrive } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { AppSettings } from "../types";

interface SettingsPageProps {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const { state, saveSettings } = useAppState();
  const [settings, setSettings] = useState<AppSettings>(
    state.settings ?? {
      organization_name: null,
      logo_path: null,
      google_drive_mode: "Local",
      hash_enabled: false,
      first_run_completed: true,
    }
  );

  function update(partial: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    await saveSettings(settings);
    onBack();
  }

  return (
    <div className="flex flex-1 flex-col bg-[#edf1f6] overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#c8d1dc] bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded border border-[#c5cfdb] bg-transparent hover:bg-[#f0f4f8] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#4d6075]" />
        </button>
        <h1 className="text-lg font-bold text-[#2f4259]">Configurações</h1>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {/* Organização */}
        <Section title="Organização">
          <Field label="Nome da organização">
            <input
              value={settings.organization_name ?? ""}
              onChange={(e) =>
                update({
                  organization_name: e.target.value || null,
                })
              }
              className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
              placeholder="Ex: Igreja, Banda, Orquestra..."
            />
          </Field>
        </Section>

        {/* Google Drive */}
        <Section title="Backup Google Drive">
          <div className="flex gap-3">
            <DriveOption
              icon={<HardDrive className="h-5 w-5" />}
              label="Local"
              description="Usa a pasta do Google Drive instalada no computador (recomendado)"
              selected={settings.google_drive_mode === "Local"}
              onClick={() => update({ google_drive_mode: "Local" })}
            />
            <DriveOption
              icon={<Cloud className="h-5 w-5" />}
              label="Via API"
              description="Usa rclone para sincronizar diretamente com o Google Drive"
              selected={settings.google_drive_mode === "Api"}
              onClick={() => update({ google_drive_mode: "Api" })}
            />
          </div>
        </Section>

        {/* Hash */}
        <Section title="Verificação de integridade">
          <div className="flex items-start gap-3 rounded-lg border border-[#c5cfdb] bg-white p-4">
            <div className="mt-0.5">
              <Hash className="h-5 w-5 text-[#6b849e]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#2f4259]">
                  Hashing BLAKE3
                </span>
                <Toggle
                  checked={settings.hash_enabled}
                  onChange={(v) => update({ hash_enabled: v })}
                />
              </div>
              <p className="text-xs text-[#6b849e] mt-1">
                Quando ativado, calcula o hash BLAKE3 dos arquivos para detectar
                alterações reais no conteúdo. Desativado por padrão — a detecção
                usa apenas tamanho + data de modificação.
              </p>
            </div>
          </div>
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
        <div className="mt-12 text-center text-xs text-[#8b9db2]">
          Made by Rhafaell with lots of coffee ☕
        </div>
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

function DriveOption({
  icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all cursor-pointer ${
        selected
          ? "border-[#4f84d7] bg-[#f0f5ff]"
          : "border-[#c5cfdb] bg-white hover:border-[#a0b3c7]"
      }`}
    >
      <span className={selected ? "text-[#4f84d7]" : "text-[#6b849e]"}>
        {icon}
      </span>
      <div>
        <div className="text-sm font-bold text-[#2f4259]">{label}</div>
        <div className="text-xs text-[#6b849e] mt-0.5">{description}</div>
      </div>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer border-0 ${
        checked ? "bg-[#4f84d7]" : "bg-[#c5cfdb]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
