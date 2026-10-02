"use client";

import { useMemo, useState } from "react";
import type { ProgramSummary } from "@/lib/db/repo";
import { Input } from "@/components/ui/form";
import { Search, FileQuestion } from "lucide-react";
import { PROGRAM_STATUS_LABELS, type ProgramStatus } from "@/lib/constants";
import { ProgramRow } from "@/components/dashboard/program-row";
import { ButtonLink } from "@/components/ui/button";

const FILTERS: Array<{ id: ProgramStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  ...(Object.entries(PROGRAM_STATUS_LABELS) as Array<[ProgramStatus, string]>).map(([id, label]) => ({
    id,
    label,
  })),
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function ProgramsClient({ programs }: { programs: ProgramSummary[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProgramStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = normalize(query);
    return programs.filter((p) => {
      if (status !== "all" && p.program.status !== status) return false;
      if (!q) return true;
      const haystack = normalize(
        [p.case.title, p.case.subtitle ?? "", p.case.code, p.program.title, p.case.summary ?? ""].join(" "),
      );
      return haystack.includes(q);
    });
  }, [programs, query, status]);

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-700/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, programs, summaries…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                status === f.id
                  ? "bg-brand-600 text-white"
                  : "text-ink-700/70 hover:bg-ink-100 hover:text-ink-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="card mt-4">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <FileQuestion className="size-6" />
            </div>
            <h3 className="text-[15px] font-semibold text-ink-900">No research programs yet</h3>
            <p className="mt-1 max-w-md text-sm text-ink-700/70">
              Open a case and start a research program to populate this workspace.
            </p>
            <div className="mt-5">
              <ButtonLink href="/cases/new">New case</ButtonLink>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card mt-4">
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <h3 className="text-[15px] font-semibold text-ink-900">No programs match your filters</h3>
            <p className="mt-1 text-sm text-ink-700/70">Try a broader search or clear the status filter.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 text-[13px] text-ink-700/60">
            {filtered.length} of {programs.length} research program{programs.length === 1 ? "" : "s"}
          </div>
          <div className="mt-2 space-y-3">
            {filtered.map((p) => (
              <ProgramRow key={p.program.id} program={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
