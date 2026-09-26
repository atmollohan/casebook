import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  aside,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4",
        className,
      )}
    >
      <div>
        <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-700/80">{description}</p>}
      </div>
      {aside}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
      {icon && (
        <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-tight text-ink-900">{value}</div>
        <div className="truncate text-[13px] text-ink-700/70">{label}</div>
      </div>
    </div>
  );
}
