import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getReportAccessible } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { Badge } from "@/components/ui/badge";
import { FinalizeReportForm } from "@/components/workspace/finalize-report-form";
import { PrintButton } from "@/components/workspace/print-button";
import { FileText, ArrowLeft, ShieldCheck } from "lucide-react";
import type { ReportContent, ReportBlock } from "@/lib/report/generate";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Research report" };

export default async function ReportViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: reportId } = await params;
  const user = await requireUser();
  const db = getDb();
  const found = getReportAccessible(db, reportId, user.id);
  if (!found) notFound();

  const { report, programId, caseId } = found;
  let content: ReportContent = [];
  try {
    content = JSON.parse(report.contentJson ?? "[]") as ReportContent;
  } catch {
    content = [];
  }

  const isFinal = report.status === "final";

  return (
    <div className="page-container print-container py-8">
      <div className="print-hide mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/cases/${caseId}/reports`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700/70 hover:text-brand-700"
        >
          <ArrowLeft className="size-4" /> Back to program reports
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          {!isFinal && <FinalizeReportForm reportId={reportId} programId={programId} caseId={caseId} />}
        </div>
      </div>

      <div
        className={`print-hide mb-4 rounded-lg border px-4 py-2.5 text-sm ${
          isFinal ? "border-ink-200 bg-ink-50 text-ink-700" : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {isFinal
          ? "Finalized research report. This is a record of research work, not a clinical document."
          : "Draft — not yet finalized. This is a record of research work, not a clinical document."}
      </div>

      <article className="card print-card mx-auto max-w-3xl px-8 py-10 sm:px-12">
        <header className="border-b border-ink-100 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <FileText className="size-5" />
            </div>
            <Badge tone={isFinal ? "green" : "amber"} dot>
              {REPORT_STATUS_LABELS[report.status as ReportStatus] ?? report.status}
            </Badge>
          </div>
          <h1 className="mt-5 text-[28px] font-medium leading-tight tracking-tight text-ink-900">
            {report.title}
          </h1>
          {report.summary && <p className="mt-2 text-sm leading-relaxed text-ink-700/80">{report.summary}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-700/60">
            <span>Generated {formatDateTime(report.createdAt)}</span>
            {report.finalizedAt && <span>Finalized {formatDateTime(report.finalizedAt)}</span>}
          </div>
        </header>

        <div className="mt-8 space-y-8">
          {content.length === 0 ? (
            <p className="text-sm text-ink-700/70">This report has no content blocks.</p>
          ) : (
            content.map((section, i) => (
              <section key={i} className="avoid-break">
                {section.title && (
                  <h2 className="mb-3 border-b border-ink-100 pb-1.5 text-[19px] font-medium tracking-tight text-ink-900">
                    {section.title}
                  </h2>
                )}
                <div className="space-y-3">
                  {section.blocks.map((block, j) => (
                    <ReportBlockView key={j} block={block} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <footer className="mt-10 flex items-center gap-2 border-t border-ink-100 pt-4 text-[13px] text-ink-700/60">
          <ShieldCheck className="size-4" />
          Research report output · reviewed by {user.name}
        </footer>
      </article>
    </div>
  );
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-[15px] leading-relaxed text-ink-900/90">
          {(block.text ?? "").split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 ? (
                <>
                  <br />
                  {line}
                </>
              ) : (
                line
              )}
            </span>
          ))}
        </p>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink-900/90">
          {(block.items ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "kv":
      return (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {(block.kv ?? []).map((entry, i) => (
            <div key={i} className="rounded-lg bg-ink-50/70 px-3.5 py-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-700/50">{entry.label}</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{entry.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className="overflow-auto rounded-lg border border-ink-100">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-700/60">
                {(block.columns ?? []).map((col, i) => (
                  <th key={i} className="border-b border-ink-100 px-3 py-2 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows ?? []).map((row, i) => (
                <tr key={i} className="border-b border-ink-100 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top text-ink-900/90">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-[13px] leading-relaxed text-brand-900">
          {block.text}
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-brand-400 pl-4 text-[13px] italic leading-relaxed text-ink-700/80">
          {block.text}
        </blockquote>
      );
    case "hr":
      return <hr className="border-ink-100" />;
    default:
      return null;
  }
}
