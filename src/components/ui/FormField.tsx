import { useLayoutEffect, useMemo, useRef, useState } from "react";

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
  readOnly?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  autoFocus,
  onKeyDown,
  onFocus,
  onBlur,
}: TextInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number; value: string } | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const rememberSelection = () => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    selectionRef.current = {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
      value: input.value,
    };
  };

  useLayoutEffect(() => {
    const input = inputRef.current;
    const selection = selectionRef.current;

    if (!input || !selection) {
      return;
    }

    if (document.activeElement !== input) {
      selectionRef.current = null;
      return;
    }

    const previousSelectionLength = Math.max(selection.end - selection.start, 0);
    let nextCaretPosition = selection.start;

    if (lastKeyRef.current === "Backspace" && previousSelectionLength === 0) {
      nextCaretPosition = Math.max(selection.start - 1, 0);
    } else if (lastKeyRef.current === "Delete" && previousSelectionLength === 0) {
      nextCaretPosition = selection.start;
    } else {
      const insertedTextLength = Math.max(
        input.value.length - (selection.value.length - previousSelectionLength),
        0
      );
      nextCaretPosition = selection.start + insertedTextLength;
    }

    input.setSelectionRange(nextCaretPosition, nextCaretPosition);
    selectionRef.current = null;
    lastKeyRef.current = null;
  }, [value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    rememberSelection();
    lastKeyRef.current = event.key;
    onKeyDown?.(event);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      className={`w-full rounded border border-[#c5cfdb] px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30 ${
        readOnly ? "bg-[#f2f5fa] text-[#5d738b]" : "bg-white"
      }`}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      onFocus={onFocus}
      onBlur={onBlur}
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

interface AutocompleteInputProps extends TextInputProps {
  suggestions: string[];
}

export function AutocompleteInput({
  suggestions,
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}: AutocompleteInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredSuggestions = useMemo(
    () =>
      suggestions.filter((suggestion) => {
        const normalizedSuggestion = suggestion.toLowerCase();
        return normalizedSuggestion.includes(normalizedValue) && normalizedSuggestion !== normalizedValue;
      }),
    [normalizedValue, suggestions]
  );

  return (
    <div className="relative">
      <TextInput
        {...props}
        value={value}
        onChange={onChange}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 120);
          onBlur?.();
        }}
      />
      {isFocused && value.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded border border-[#c5cfdb] bg-white shadow-lg">
          {filteredSuggestions.length > 0 ? (
            <div className="max-h-40 overflow-y-auto py-1">
              {filteredSuggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  className="block w-full px-3 py-2 text-left text-sm text-[#344b61] hover:bg-[#edf3fb]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChange(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
