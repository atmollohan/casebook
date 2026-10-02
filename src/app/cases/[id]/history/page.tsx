import { getDb } from "@/lib/db";
import { listHistory, findCaseById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { History as HistoryIcon } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "History" };

const eventTones: Record<string, "brand" | "green" | "amber" | "red" | "blue" | "violet" | "slate"> = {
  program_created: "brand",
  patient_updated: "brand",
  data_uploaded: "blue",
  data_deleted: "red",
  activity_created: "blue",
  activity_started: "blue",
  activity_completed: "green",
  activity_status: "blue",
  finding_created: "amber",
  evidence_added: "slate",
  report_generated: "violet",
  report_finalized: "green",
};

export default async function HistoryTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const found = findCaseById(db, id, user.id);
  if (!found) notFound();
  const events = listHistory(db, found.program.id, user.id) ?? [];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">Program history</h2>

      {events.length === 0 ? (
        <Card>
          <EmptyState icon={<HistoryIcon className="size-6" />} title="No events yet" />
        </Card>
      ) : (
        <Card>
          <ol className="relative ml-4 list-none border-l border-ink-200 py-4 pl-6 pr-5">
            {events.map((e) => (
              <li key={e.id} className="relative pb-5 last:pb-0">
                <span
                  className="absolute -left-[30px] top-1 size-3 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={eventTones[e.eventType] ?? "slate"} className="normal-case">
                    {e.eventType.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm font-medium text-ink-900">{e.summary}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-700/60">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink-700/80">
                    <Avatar name={e.actorName ?? "System"} size="sm" />
                    {e.actorName ?? "System"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {timeAgo(e.createdAt)} · {formatDateTime(e.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
