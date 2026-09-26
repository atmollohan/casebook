import { getDb } from "@/lib/db";
import { listEvidenceForProgram, listFindings, findPatientById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpenText, ExternalLink, FlaskConical } from "lucide-react";
import { EVIDENCE_SOURCE_LABELS, type EvidenceSourceType } from "@/lib/constants";
import { timeAgo } from "@/lib/utils/format";
import Link from "next/link";

export const metadata = { title: "Evidence & sources" };

export default async function EvidenceTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const found = findPatientById(db, id, user.id);
  if (!found) notFound();
  const evidence = listEvidenceForProgram(db, found.program.id, user.id) ?? [];
  const findings = listFindings(db, found.program.id, user.id) ?? [];
  const findingById = new Map(findings.map((f) => [f.id, f]));

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">Evidence & sources</h2>

      {evidence.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="No evidence catalogued"
            description="Add sources from a finding."
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {evidence.map((e) => {
            const finding = findingById.get(e.findingId);
            return (
              <li key={e.id} className="card flex items-start gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <BookOpenText className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">
                      {EVIDENCE_SOURCE_LABELS[e.sourceType as EvidenceSourceType] ?? e.sourceType}
                    </Badge>
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                      >
                        {e.title} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-ink-900">{e.title}</span>
                    )}
                  </div>
                  <div className="mt-1 text-[13px] text-ink-700/60">
                    {e.doi && <span className="mr-2 font-mono text-xs">doi:{e.doi}</span>}
                    {e.note}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-700/80">
                    <span>Supports</span>
                    {finding ? (
                      <Link
                        href={`/patients/${id}/findings#finding-${finding.id}`}
                        className="inline-flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700"
                      >
                        <FlaskConical className="size-3.5 text-ink-700/40" />
                        {finding.title}
                      </Link>
                    ) : (
                      <span className="text-ink-700/50">a finding</span>
                    )}
                    <span className="text-ink-700/40">· {timeAgo(e.createdAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
