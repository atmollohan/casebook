import Link from "next/link";
import type { ProgramSummary } from "@/lib/db/repo";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils/format";
import { PROGRAM_STATUS_LABELS, type ProgramStatus } from "@/lib/constants";
import { Database, FlaskConical, Lightbulb, FileText, ChevronRight } from "lucide-react";

const statusTones: Record<ProgramStatus, "brand" | "green" | "amber" | "blue" | "slate"> = {
  active: "green",
  planned: "brand",
  paused: "amber",
  closing: "blue",
  closed: "slate",
};

export function ProgramRow({ program }: { program: ProgramSummary }) {
  const { patient, program: p } = program;
  const name = `${patient.lastName}, ${patient.firstName}`;
  return (
    <Link
      href={`/patients/${patient.id}`}
      className="card group flex flex-col gap-4 p-5 transition-shadow hover:shadow-pop sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3.5 sm:w-72 sm:shrink-0">
        <Avatar name={name} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink-900 group-hover:text-brand-800">
            {name}
          </div>
          <div className="mt-0.5 text-xs text-ink-700/60">
            {patient.pid} · {patient.birthYear ? `b. ${patient.birthYear}` : "birth year n/a"}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-900">{p.title}</span>
          <Badge tone={statusTones[p.status as ProgramStatus] ?? "slate"} dot>
            {PROGRAM_STATUS_LABELS[p.status as ProgramStatus] ?? p.status}
          </Badge>
          {patient.conditionSummary && (
            <span className="hidden truncate text-[13px] text-ink-700/60 lg:inline">
              {patient.conditionSummary}
            </span>
          )}
        </div>
        <div className="mt-1.5 hidden text-[13px] text-ink-700/60 sm:block">
          Updated {formatDate(p.updatedAt)}
          {p.hypothesis ? ` · ${p.hypothesis}` : ""}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[13px] text-ink-700/80">
        <Metric icon={<Database className="size-4" />} value={program.dataCount} label="assets" />
        <Metric icon={<FlaskConical className="size-4" />} value={program.activityCount} label="activities" />
        <Metric icon={<Lightbulb className="size-4" />} value={program.findingCount} label="findings" />
        <Metric icon={<FileText className="size-4" />} value={program.reportCount} label="reports" />
        <ChevronRight className="size-4 text-ink-700/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
    </Link>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5" title={`${value} ${label}`}>
      <span className="text-ink-700/50">{icon}</span>
      <span className="font-medium tabular-nums text-ink-900">{value}</span>
      <span className="hidden text-ink-700/60 md:inline">{label}</span>
    </span>
  );
}
