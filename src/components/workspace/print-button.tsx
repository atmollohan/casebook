"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100/70"
    >
      <Printer className="size-3.5" /> Print / save PDF
    </button>
  );
}
