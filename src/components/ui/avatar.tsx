import { initials } from "@/lib/utils/format";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "size-7 text-[11px]",
    md: "size-9 text-sm",
    lg: "size-11 text-base",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold tracking-tight text-brand-800 ring-1 ring-inset ring-brand-200 ${sizes[size]}`}
    >
      {initials(name)}
    </span>
  );
}
