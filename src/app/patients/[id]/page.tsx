import { getDb } from "@/lib/db";
import {
  listDataRecords,
  listActivities,
  listFindings,
  listEvidenceForProgram,
  listReports,
  listHistory,
} from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { Card, CardHeader, CardBody, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgramStatusControl } from "@/components/workspace/program-status-control";
import {
  Database,
  Lightbulb,
  BookOpenText,
  FileText,
  History,
  Upload,
  Plus,
  ArrowRight,
  Sparkles,
  Activity as ActivityIcon,
} from "lucide-react";
import { SIGNIFICANCE_LABELS, type SignificanceLevel, type ProgramStatus } from "@/lib/constants";
import { timeAgo, formatDate } from "@/lib/utils/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPatientById } from "@/lib/db/repo";

export default async function PatientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const found = findPatientById(db, id, user.id);
  if (!found) notFound();

  const data = listDataRecords(db, found.program.id, user.id) ?? [];
  const activities = listActivities(db, found.program.id, user.id) ?? [];
  const findings = listFindings(db, found.program.id, user.id) ?? [];
  const evidence = listEvidenceForProgram(db, found.program.id, user.id) ?? [];
  const reports = listReports(db, found.program.id, user.id) ?? [];
  const history = listHistory(db, found.program.id, user.id) ?? [];

  const recentHistory = history.slice(0, 6);
  const openActivities = activities.filter((a) => a.status === "planned" || a.status === "in_progress");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Program overview</h2>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href={`/patients/${id}/data?upload=1`}
            variant="secondary"
            size="sm"
            icon={<Upload className="size-4" />}
          >
            Upload data
          </ButtonLink>
          <ButtonLink href={`/patients/${id}/activities/new`} size="sm" icon={<Plus className="size-4" />}>
            New analysis
          </ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<Database className="size-5" />} label="Data assets" value={data.length} />
        <Stat icon={<ActivityIcon className="size-5" />} label="Activities" value={activities.length} />
        <Stat icon={<Lightbulb className="size-5" />} label="Findings" value={findings.length} />
        <Stat icon={<BookOpenText className="size-5" />} label="Evidence sources" value={evidence.length} />
        <Stat icon={<FileText className="size-5" />} label="Reports" value={reports.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Research program"
              aside={
                <ProgramStatusControl
                  programId={found.program.id}
                  patientId={found.patient.id}
                  current={found.program.status as ProgramStatus}
                />
              }
            />
            <CardBody>
              <div className="space-y-4">
                <div>
                  <div className="text-[13px] font-medium text-ink-700/60">Hypothesis</div>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-900">
                    {found.program.hypothesis ?? "No hypothesis recorded yet."}
                  </p>
                </div>
                {found.program.description && (
                  <div>
                    <div className="text-[13px] font-medium text-ink-700/60">Program description</div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-700/90">
                      {found.program.description}
                    </p>
                  </div>
                )}
                {openActivities.length > 0 && (
                  <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-2.5 text-[13px] text-brand-900">
                    <span className="font-medium">{openActivities.length} active analysis</span>
                    {openActivities.length === 1 ? " in progress" : "s in progress"} ·{" "}
                    <Link
                      href={`/patients/${id}/activities`}
                      className="font-medium underline underline-offset-2"
                    >
                      review
                    </Link>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent findings"
              aside={
                <ButtonLink href={`/patients/${id}/findings`} variant="ghost" size="sm">
                  View all <ArrowRight className="size-3.5" />
                </ButtonLink>
              }
            />
            <CardBody className="p-0">
              {findings.length === 0 ? (
                <EmptyState
                  icon={<Lightbulb className="size-6" />}
                  title="No findings recorded"
                  action={
                    <ButtonLink href={`/patients/${id}/findings?new=1`} size="sm">
                      Record a finding
                    </ButtonLink>
                  }
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {findings.slice(0, 4).map((f) => (
                    <li key={f.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink-900">{f.title}</span>
                        <Badge
                          tone={
                            f.significance === "high"
                              ? "red"
                              : f.significance === "medium"
                                ? "amber"
                                : "slate"
                          }
                        >
                          {SIGNIFICANCE_LABELS[f.significance as SignificanceLevel] ?? f.significance}
                        </Badge>
                        {f.activity && (
                          <Link
                            href={`/patients/${id}/activities/${f.activity.id}`}
                            className="text-[13px] text-brand-700 hover:underline"
                          >
                            {f.activity.title}
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-700/80">
                        {f.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent activity" aside={<History className="size-4 text-ink-700/40" />} />
            <CardBody className="p-0">
              {recentHistory.length === 0 ? (
                <div className="px-5 py-8 text-sm text-ink-700/70">
                  Nothing has happened in this program yet.
                </div>
              ) : (
                <ul className="relative ml-4 border-l border-ink-200 py-3 pl-4 pr-5">
                  {recentHistory.map((h) => (
                    <li key={h.id} className="relative pb-3.5 last:pb-0">
                      <span className="absolute -left-[21.5px] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                      <div className="text-[13px] leading-snug text-ink-900">{h.summary}</div>
                      <div className="mt-0.5 text-xs text-ink-700/50">{timeAgo(h.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
            {history.length > 6 && (
              <Link
                href={`/patients/${id}/history`}
                className="block border-t border-ink-100 px-5 py-2.5 text-center text-[13px] font-medium text-brand-700 hover:bg-brand-50/50"
              >
                View full history
              </Link>
            )}
          </Card>

          <Card className="bg-gradient-to-b from-brand-50/70 to-white">
            <CardBody>
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
                <Sparkles className="size-4.5 text-brand-600" />
                Next step
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700/80">
                {data.length === 0
                  ? "Upload the first research data asset for this patient."
                  : findings.length === 0
                    ? "Run a research activity and record findings from it."
                    : reports.length === 0
                      ? "Everything is in place. Generate the structured research report."
                      : "The program is in good shape. Review the latest report or start a new analysis."}
              </p>
              <div className="mt-3">
                {data.length === 0 ? (
                  <ButtonLink href={`/patients/${id}/data?upload=1`} size="sm">
                    Upload data
                  </ButtonLink>
                ) : findings.length === 0 ? (
                  <ButtonLink href={`/patients/${id}/activities/new`} size="sm">
                    Start an analysis
                  </ButtonLink>
                ) : reports.length === 0 ? (
                  <ButtonLink href={`/patients/${id}/reports`} size="sm">
                    Generate report
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/report/${reports[0].id}`} variant="secondary" size="sm">
                    Review latest report
                  </ButtonLink>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="text-[13px] text-ink-700/60">
            Last updated {formatDate(found.program.updatedAt)} · Created {formatDate(found.program.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
