interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, required, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#344b61] mb-1.5">
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  onKeyDown,
}: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-[#c5cfdb] bg-white px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
    />
  );
}

interface ErrorMessageProps {
  error: string;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  if (!error) return null;
  return (
    <div className="rounded bg-red-50 border border-red-200 p-2.5">
      <p className="text-xs text-red-600">{error}</p>
    </div>
  );
}
