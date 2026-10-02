import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { findCaseById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { parseAttributes } from "@/lib/attributes";
import { PROGRAM_STATUS_LABELS, CASE_KIND_LABELS, type ProgramStatus, type CaseKind } from "@/lib/constants";
import { ChevronRight, FlaskConical } from "lucide-react";

export default async function CaseWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const found = findCaseById(getDb(), id, user.id);
  if (!found) notFound();

  const { case: record, program } = found;
  const attributes = parseAttributes(record.attributes);
  const kindLabel = CASE_KIND_LABELS[record.kind as CaseKind] ?? record.kind;
  const statusTone =
    program.status === "active"
      ? "green"
      : program.status === "paused"
        ? "amber"
        : program.status === "planned"
          ? "brand"
          : program.status === "closing"
            ? "blue"
            : "slate";

  return (
    <div className="page-container">
      <nav className="print-hide mb-4 flex items-center gap-1.5 text-[13px] text-ink-700/60">
        <Link href="/" className="focus-ring rounded hover:text-brand-700">
          Research programs
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-ink-900">{record.title}</span>
      </nav>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 bg-white px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={record.title} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-medium tracking-tight text-ink-900">{record.title}</h1>
                  <Badge tone={statusTone} dot>
                    {PROGRAM_STATUS_LABELS[program.status as ProgramStatus] ?? program.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-700/70">
                  {record.code}
                  {record.subtitle ? ` · ${record.subtitle}` : ""}
                  {` · ${kindLabel}`}
                </p>
              </div>
            </div>
            <div className="flex max-w-sm flex-col items-start gap-1 text-right">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900">
                <FlaskConical className="size-4 text-brand-600" />
                {program.title}
              </span>
              <span className="text-[13px] text-ink-700/60">{program.focusArea ?? "Research program"}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <span className="max-w-xl truncate text-[13px] text-ink-700/70">
              {record.summary ?? "No reason recorded for this case yet."}
            </span>
            {Object.keys(attributes).length > 0 && (
              <span className="text-[13px] text-ink-700/60">
                {Object.keys(attributes).length} detail
                {Object.keys(attributes).length === 1 ? "" : "s"} recorded
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0 sm:flex-row">
          <div className="sm:w-56 sm:shrink-0 sm:border-r sm:border-ink-100 sm:bg-ink-50/50">
            <WorkspaceNav />
          </div>
          <div className="min-w-0 flex-1 bg-white p-5 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
