interface OrganizationNameFieldProps {
  computerType: "Server" | "Client";
  value: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function OrganizationNameField({
  computerType,
  value,
  disabled,
  onChange,
}: OrganizationNameFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#34485d]">
        Nome da organização ou instituição
      </label>
      <input
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full h-9 rounded border border-[#c5cfdb] bg-white px-3 text-sm text-[#4d6075] outline-none focus:border-[#7ba0d4]"
        placeholder="Ex: Orquestra, Igreja, Ministério..."
      />
      <p className="text-xs text-[#8b9db2] mt-1">
        {computerType === "Server"
          ? "Usado para identificar a organização no computador principal."
          : "Opcional no cliente, mas útil para identificar a organização."}
      </p>
    </div>
  );
}