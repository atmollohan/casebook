import { getDb } from "@/lib/db";
import { listFindings, findCaseById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordFindingForm } from "@/components/workspace/record-finding-form";
import { AddEvidenceToggle } from "@/components/workspace/add-evidence-toggle";
import { RemoveEvidenceButton } from "@/components/workspace/remove-evidence-button";
import { Lightbulb, Plus, BookOpenText, ExternalLink, FlaskConical } from "lucide-react";
import {
  FINDING_CATEGORY_LABELS,
  SIGNIFICANCE_LABELS,
  EVIDENCE_SOURCE_LABELS,
  type FindingCategory,
  type SignificanceLevel,
  type EvidenceSourceType,
} from "@/lib/constants";
import { timeAgo } from "@/lib/utils/format";
import Link from "next/link";

export const metadata = { title: "Findings" };

const significanceTone = (s: string) => (s === "high" ? "red" : s === "medium" ? "amber" : "slate");

export default async function FindingsTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: showNew } = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const found = findCaseById(db, id, user.id);
  if (!found) notFound();
  const findings = listFindings(db, found.program.id, user.id) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Findings</h2>
        <ButtonLink href={`/cases/${id}/findings?new=1`} icon={<Plus className="size-4" />}>
          Record finding
        </ButtonLink>
      </div>

      {showNew === "1" && (
        <Card>
          <CardHeader
            title="Record a finding"
            description="Recorded against a research activity."
            aside={<Lightbulb className="size-5 text-amber-500" />}
          />
          <CardBody>
            <RecordFindingForm programId={found.program.id} caseId={id} />
          </CardBody>
        </Card>
      )}

      {findings.length === 0 && showNew !== "1" ? (
        <Card>
          <EmptyState
            icon={<Lightbulb className="size-6" />}
            title="No findings yet"
            action={
              <ButtonLink href={`/cases/${id}/findings?new=1`} size="sm">
                <Plus className="size-4" /> Record the first finding
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {findings.map((f) => (
            <li key={f.id} id={`finding-${f.id}`} className="scroll-mt-24">
              <Card>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {f.title}
                      <Badge tone={significanceTone(f.significance)}>
                        {SIGNIFICANCE_LABELS[f.significance as SignificanceLevel] ?? f.significance}{" "}
                        significance
                      </Badge>
                      <Badge tone="slate" className="normal-case">
                        {FINDING_CATEGORY_LABELS[f.category as FindingCategory] ?? f.category}
                      </Badge>
                    </span>
                  }
                  aside={
                    <span className="text-[13px] text-ink-700/50">
                      by {f.reporter.name} · {timeAgo(f.createdAt)}
                    </span>
                  }
                />
                <CardBody>
                  <p className="text-sm leading-relaxed text-ink-900/90">{f.description}</p>
                  {f.activity && (
                    <Link
                      href={`/cases/${id}/activities/${f.activity.id}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline"
                    >
                      <FlaskConical className="size-3.5" /> From analysis: {f.activity.title}
                    </Link>
                  )}

                  <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                        <BookOpenText className="size-4 text-ink-700/50" />
                        Evidence & sources ({f.evidence.length})
                      </div>
                      <AddEvidenceToggle findingId={f.id} programId={found.program.id} caseId={id} />
                    </div>
                    {f.evidence.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {f.evidence.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 bg-white px-3.5 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-900">
                                <Badge tone="slate">
                                  {EVIDENCE_SOURCE_LABELS[e.sourceType as EvidenceSourceType] ?? e.sourceType}
                                </Badge>
                                {e.url ? (
                                  <a
                                    href={e.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                                  >
                                    {e.title} <ExternalLink className="size-3" />
                                  </a>
                                ) : e.doi ? (
                                  <span>
                                    {e.title} <span className="text-ink-700/50">doi:{e.doi}</span>
                                  </span>
                                ) : (
                                  <span>{e.title}</span>
                                )}
                              </div>
                              {e.note && <p className="mt-0.5 text-[13px] text-ink-700/70">{e.note}</p>}
                            </div>
                            <RemoveEvidenceButton
                              evidenceId={e.id}
                              findingId={f.id}
                              programId={found.program.id}
                              caseId={id}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[13px] text-ink-700/50">
                        {f.evidence.length === 0 ? "No sources attached yet." : ""}
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
