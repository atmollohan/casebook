import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { findCaseById, getActivity, listFindings } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityStatusControl } from "@/components/workspace/activity-status-control";
import { RecordFindingForm } from "@/components/workspace/record-finding-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeft, FlaskConical, Lightbulb } from "lucide-react";
import {
  ACTIVITY_TYPE_LABELS,
  SIGNIFICANCE_LABELS,
  type ActivityType,
  type ActivityStatus,
  type SignificanceLevel,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Analysis" };

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; activityId: string }>;
  searchParams: Promise<{ created?: string; finding?: string }>;
}) {
  const { id, activityId } = await params;
  const { created, finding: justRecorded } = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const found = findCaseById(db, id, user.id);
  if (!found) notFound();
  const activity = getActivity(db, activityId, found.program.id, user.id);
  if (!activity) notFound();

  const findings = (listFindings(db, found.program.id, user.id) ?? []).filter(
    (f) => f.activityId === activityId,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/cases/${id}/activities`}
            className="focus-ring inline-flex items-center gap-1 rounded-lg text-sm font-medium text-ink-700/70 hover:text-brand-700"
          >
            <ChevronLeft className="size-4" /> Activities
          </Link>
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FlaskConical className="size-5" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">{activity.title}</h2>
        </div>
        <ActivityStatusControl
          activityId={activity.id}
          programId={found.program.id}
          current={activity.status as ActivityStatus}
        />
      </div>

      {created === "1" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Analysis created. Start it to track progress, then record findings as they emerge.
        </div>
      )}
      {justRecorded === "1" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Finding recorded. Add supporting evidence on the findings tab.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Details"
            aside={
              <Badge tone="slate">
                {ACTIVITY_TYPE_LABELS[activity.activityType as ActivityType] ?? activity.activityType}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            {activity.hypothesis && (
              <div>
                <div className="text-[13px] font-medium text-ink-700/60">Hypothesis</div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-900">{activity.hypothesis}</p>
              </div>
            )}
            {activity.description && (
              <div>
                <div className="text-[13px] font-medium text-ink-700/60">Scope & approach</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-700/90">{activity.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 text-[13px] text-ink-700/60">
              <div>
                <div className="font-medium text-ink-700/60">Created</div>
                <div>{formatDateTime(activity.createdAt)}</div>
              </div>
              <div>
                <div className="font-medium text-ink-700/60">Started / completed</div>
                <div>
                  {activity.startedAt ? formatDateTime(activity.startedAt) : "Not started"}
                  {activity.completedAt ? ` · completed ${formatDateTime(activity.completedAt)}` : ""}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Record a finding from this analysis"
            aside={<Lightbulb className="size-5 text-amber-500" />}
          />
          <CardBody>
            <RecordFindingForm programId={found.program.id} caseId={id} activityId={activity.id} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Findings from this analysis (${findings.length})`}
          aside={
            <ButtonLink href={`/cases/${id}/findings`} variant="ghost" size="sm">
              All findings
            </ButtonLink>
          }
        />
        <CardBody className="p-0">
          {findings.length === 0 ? (
            <EmptyState icon={<Lightbulb className="size-6" />} title="No findings linked yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {findings.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/cases/${id}/findings#finding-${f.id}`}
                    className="block px-5 py-3.5 hover:bg-ink-50/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{f.title}</span>
                      <Badge
                        tone={
                          f.significance === "high" ? "red" : f.significance === "medium" ? "amber" : "slate"
                        }
                      >
                        {SIGNIFICANCE_LABELS[f.significance as SignificanceLevel] ?? f.significance}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-700/80">
                      {f.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
