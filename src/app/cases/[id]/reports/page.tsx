import { getDb } from "@/lib/db";
import { listReports, findCaseById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { GenerateReportForm } from "@/components/workspace/generate-report-form";
import { FileText, FileDown, Clock3 } from "lucide-react";
import { formatDate, timeAgo } from "@/lib/utils/format";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";
import Link from "next/link";

export const metadata = { title: "Reports" };

export default async function ReportsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const found = findCaseById(db, id, user.id);
  if (!found) notFound();
  const reports = listReports(db, found.program.id, user.id) ?? [];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">Reports</h2>

      {/* The form is the tab's primary action, always visible. It used to sit behind a
          query-parameter link, which produced a second button with the same label that
          only re-navigated to the current URL — clicking it did nothing at all. */}
      <GenerateReportForm programId={found.program.id} caseId={id} />

      {reports.length === 0 ? (
        <Card>
          <EmptyState icon={<FileText className="size-6" />} title="No reports generated yet" />
        </Card>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/report/${r.id}`}
                className="card group flex flex-wrap items-center gap-4 p-4 transition-shadow hover:shadow-pop"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-ink-900 group-hover:text-brand-700">
                      {r.title}
                    </span>
                    <Badge tone={r.status === "final" ? "green" : "amber"} dot>
                      {REPORT_STATUS_LABELS[r.status as ReportStatus] ?? r.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[13px] text-ink-700/60">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" /> generated {timeAgo(r.createdAt)}
                    </span>
                    {r.finalizedAt && (
                      <span className="inline-flex items-center gap-1">
                        <FileDown className="size-3.5" /> finalized {formatDate(r.finalizedAt)}
                      </span>
                    )}
                    {r.summary && <span className="truncate">{r.summary}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardBody className="text-[13px] leading-relaxed text-ink-700/70">
          Reports are <strong>drafts</strong> until finalized. Drafts can be regenerated as the program
          evolves; finalizing locks the current version for review.
        </CardBody>
      </Card>
    </div>
  );
}
