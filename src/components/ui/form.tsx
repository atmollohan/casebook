"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Label({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1 text-sm font-medium text-ink-900">
      <span>
        {children}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {hint && <span className="text-xs font-normal text-ink-700/60">{hint}</span>}
    </label>
  );
}

const fieldClasses =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-700/40 focus-ring disabled:bg-ink-50 disabled:text-ink-700/60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea rows={rows} className={cn(fieldClasses, "resize-y leading-relaxed", className)} {...props} />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClasses, "appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="field-error">{error}</div>;
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <Label htmlFor={htmlFor} required={required} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      <FieldError error={error} />
    </div>
  );
}
