import Link from "next/link";
import { getDb } from "@/lib/db";
import { listActivities, findPatientById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FlaskConical, Plus, ArrowRight } from "lucide-react";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_LABELS,
  type ActivityType,
  type ActivityStatus,
} from "@/lib/constants";
import { timeAgo, formatDate } from "@/lib/utils/format";

export const metadata = { title: "Activities" };

const statusTones: Record<ActivityStatus, "brand" | "blue" | "green" | "slate"> = {
  planned: "brand",
  in_progress: "blue",
  completed: "green",
  closed: "slate",
};

export default async function ActivitiesTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const found = findPatientById(db, id, user.id);
  if (!found) notFound();
  const activities = listActivities(db, found.program.id, user.id) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Research activities</h2>
        <ButtonLink href={`/patients/${id}/activities/new`} icon={<Plus className="size-4" />}>
          New analysis
        </ButtonLink>
      </div>

      {activities.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FlaskConical className="size-6" />}
            title="No research activities"
            description="A variant review, literature scan, imaging review, cohort comparison, or statistical analysis."
            action={
              <ButtonLink href={`/patients/${id}/activities/new`} size="sm">
                <Plus className="size-4" /> Create the first analysis
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id}>
              <Link
                href={`/patients/${id}/activities/${a.id}`}
                className="card group flex flex-wrap items-center gap-3 p-4 transition-shadow hover:shadow-pop"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <FlaskConical className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-ink-900 group-hover:text-brand-700">
                      {a.title}
                    </span>
                    <Badge tone={statusTones[a.status as ActivityStatus] ?? "slate"} dot>
                      {ACTIVITY_STATUS_LABELS[a.status as ActivityStatus] ?? a.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-700/60">
                    {ACTIVITY_TYPE_LABELS[a.activityType as ActivityType] ?? a.activityType} ·{" "}
                    {a.completedAt
                      ? `completed ${formatDate(a.completedAt)}`
                      : a.startedAt
                        ? `started ${timeAgo(a.startedAt)}`
                        : `created ${timeAgo(a.createdAt)}`}
                  </div>
                </div>
                <ArrowRight className="size-4 text-ink-700/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
