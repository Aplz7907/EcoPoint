'use client';

import { Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';

export function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin" strokeWidth={3} aria-hidden />;
}

/** Errors are the one place Bauhaus red belongs: a solid block you cannot skim past. */
export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-none border-2 border-bau-ink bg-bau-red px-4 py-3 text-sm font-bold leading-relaxed text-white shadow-hard-sm"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={3} aria-hidden />
      {message}
    </p>
  );
}

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
    </label>
  );
}

export const inputClass = 'input';

/** Typing a password one-handed, outdoors, in sunlight, is miserable without this. */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggleVisible,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input pr-16"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        className="absolute right-0 top-0 flex h-full w-14 items-center justify-center border-l-2 border-bau-ink bg-bau-yellow text-bau-ink transition active:bg-bau-yellow/80"
      >
        {visible ? (
          <EyeOff className="h-5 w-5" strokeWidth={2.5} />
        ) : (
          <Eye className="h-5 w-5" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
