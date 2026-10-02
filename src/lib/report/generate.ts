import type { Db } from "@/lib/db";
import {
  getProgramForResearcher,
  listDataRecords,
  listActivities,
  listFindings,
  listHistory,
} from "@/lib/db/repo";
import {
  PROGRAM_STATUS_LABELS,
  DATA_CATEGORY_LABELS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_LABELS,
  FINDING_CATEGORY_LABELS,
  SIGNIFICANCE_LABELS,
  EVIDENCE_SOURCE_LABELS,
  CASE_KIND_LABELS,
  DEMO_BADGE,
  type CaseKind,
} from "@/lib/constants";
import { parseAttributes } from "@/lib/attributes";
import { formatDate, formatBytes } from "@/lib/utils/format";

export interface ReportKv {
  label: string;
  value: string;
}

export interface ReportBlock {
  type: "p" | "list" | "table" | "kv" | "note" | "hr" | "quote";
  text?: string;
  items?: string[];
  columns?: string[];
  rows?: string[][];
  kv?: ReportKv[];
}

export interface ReportSection {
  title: string;
  blocks: ReportBlock[];
}

export type ReportContent = ReportSection[];

export interface GeneratedReport {
  title: string;
  summary: string;
  content: ReportContent;
}

function caseKindLabel(kind: string): string {
  return CASE_KIND_LABELS[kind as CaseKind] ?? kind;
}

function caseDisplayName(row: { title: string; subtitle: string | null }): string {
  return row.subtitle ? `${row.title} — ${row.subtitle}` : row.title;
}

/**
 * Assemble the report and the facts that describe it in one pass.
 *
 * The summary is computed here, from the same values the sections are built from, rather than
 * scraped back out of the rendered content. The previous implementation searched the finished
 * sections for the titles "Research program" and "Research data" and the label "Program", so
 * renaming a section silently produced an empty summary instead of a failing one.
 */
export function generateReport(db: Db, programId: string, userId: string): GeneratedReport {
  const summary = getProgramForResearcher(db, programId, userId);
  if (!summary) {
    throw new Error("Program not found or not accessible");
  }
  const { case: record, program } = summary;
  const data = listDataRecords(db, programId, userId) ?? [];
  const activities = listActivities(db, programId, userId) ?? [];
  const findings = listFindings(db, programId, userId) ?? [];
  const history = listHistory(db, programId, userId) ?? [];

  const sections: ReportSection[] = [];

  // 1. Case overview. The case is whatever the investigator is studying, so the overview reports
  // what is on the record and says "Not recorded" for nothing — it never asserts a fact the
  // owner did not supply.
  const attributes = parseAttributes(record.attributes);
  sections.push({
    title: "Case overview",
    blocks: [
      {
        type: "kv",
        kv: [
          { label: "Case ID", value: record.code },
          { label: "Case", value: record.title },
          ...(record.subtitle ? [{ label: "Qualifier", value: record.subtitle }] : []),
          { label: "Kind", value: caseKindLabel(record.kind) },
          { label: "Reason for investigation", value: record.summary ?? "Not recorded" },
          ...Object.entries(attributes).map(([label, value]) => ({ label, value })),
        ],
      },
    ],
  });

  // 2. Research program
  sections.push({
    title: "Research program",
    blocks: [
      {
        type: "kv",
        kv: [
          { label: "Program", value: program.title },
          {
            label: "Status",
            value:
              PROGRAM_STATUS_LABELS[program.status as keyof typeof PROGRAM_STATUS_LABELS] ?? program.status,
          },
          { label: "Focus area", value: program.focusArea ?? "Not recorded" },
          {
            label: "Program description",
            value: program.description ?? "Not recorded",
          },
          {
            label: "Hypothesis",
            value: program.hypothesis ?? "Not recorded",
          },
        ],
      },
    ],
  });

  // 3. Research data
  if (data.length > 0) {
    // Only the bundled demo seed is known to be synthetic. Files the researcher uploaded are
    // their own, so the report never asserts a provenance it cannot support.
    const demoAssetCount = data.filter((d) => d.isSynthetic).length;
    sections.push({
      title: "Research data",
      blocks: [
        {
          type: "table",
          columns: ["Asset", "Category", "Uploaded", "Size"],
          rows: data.map((d) => [
            d.title,
            DATA_CATEGORY_LABELS[d.category as keyof typeof DATA_CATEGORY_LABELS] ?? d.category,
            formatDate(d.uploadedAt),
            formatBytes(d.sizeBytes),
          ]),
        },
        {
          type: "note",
          text: `${data.length} asset${data.length === 1 ? "" : "s"} catalogued in this program.${demoAssetCount > 0 ? ` ${demoAssetCount} of them are synthetic demo content rather than your own data.` : ""}`,
        },
      ],
    });
  }

  // 4. Research activities
  if (activities.length > 0) {
    sections.push({
      title: "Research activities",
      blocks: [
        {
          type: "table",
          columns: ["Activity", "Type", "Status", "Created", "Completed"],
          rows: activities.map((a) => [
            a.title,
            ACTIVITY_TYPE_LABELS[a.activityType as keyof typeof ACTIVITY_TYPE_LABELS] ?? a.activityType,
            ACTIVITY_STATUS_LABELS[a.status as keyof typeof ACTIVITY_STATUS_LABELS] ?? a.status,
            formatDate(a.createdAt),
            a.completedAt ? formatDate(a.completedAt) : "Not recorded",
          ]),
        },
      ],
    });
  }

  // 5. Findings & evidence
  if (findings.length > 0) {
    const findingSections: ReportSection[] = findings.map((f) => ({
      title: f.title,
      blocks: [
        {
          type: "kv",
          kv: [
            {
              label: "Category",
              value:
                FINDING_CATEGORY_LABELS[f.category as keyof typeof FINDING_CATEGORY_LABELS] ?? f.category,
            },
            {
              label: "Significance",
              value:
                SIGNIFICANCE_LABELS[f.significance as keyof typeof SIGNIFICANCE_LABELS] ?? f.significance,
            },
            {
              label: "Reported by",
              value: f.reporter.name,
            },
            {
              label: "Reported on",
              value: formatDate(f.createdAt),
            },
            {
              label: "Associated activity",
              value: f.activity?.title ?? "Not recorded",
            },
          ],
        },
        { type: "p", text: f.description },
      ],
    }));

    const withEvidence = findingSections.map((section, i) => {
      const f = findings[i];
      const evidenceBlocks: ReportBlock[] =
        f.evidence.length > 0
          ? [
              {
                type: "list",
                items: f.evidence.map((e) => {
                  const source =
                    EVIDENCE_SOURCE_LABELS[e.sourceType as keyof typeof EVIDENCE_SOURCE_LABELS] ??
                    e.sourceType;
                  const where = e.url ? ` (${e.url})` : e.doi ? ` (doi:${e.doi})` : "";
                  const note = e.note ? ` (${e.note})` : "";
                  return `${source}: ${e.title}${where}${note}`;
                }),
              },
            ]
          : [];
      return {
        ...section,
        blocks: [...section.blocks, ...evidenceBlocks],
      };
    });

    sections.push({
      title: "Findings & evidence",
      blocks: [{ type: "hr" }],
    });
    for (const s of withEvidence) {
      sections.push(s);
      sections.push({ title: "", blocks: [{ type: "hr" }] });
    }
  }

  // 6. Activity history
  if (history.length > 0) {
    sections.push({
      title: "Activity history",
      blocks: [
        {
          type: "table",
          columns: ["Date", "Event"],
          rows: history.slice(0, 20).map((h) => [formatDate(h.createdAt), h.summary]),
        },
      ],
    });
  }

  // 7. Methodological note
  sections.push({
    title: "Methodology & limitations",
    blocks: [
      {
        type: "quote",
        text: "This report was assembled automatically from the research program workspace. It is a record of research work, not a validated report, and it is not suitable for decision-making of any kind. Content taken from the bundled demo seed is synthetic and deidentified; anything else was supplied by the account holder.",
      },
      {
        type: "note",
        text: `Generated on ${formatDate(Date.now())}. Verify data provenance and analytical validity before any real-world use.`,
      },
    ],
  });

  return {
    title: programReportTitle(caseDisplayName(record)),
    summary: `${program.title} · ${data.length} data asset${data.length === 1 ? "" : "s"} catalogued.`,
    content: sections,
  };
}

export function programReportTitle(caseName: string): string {
  return `Research report · ${caseName}`;
}

export { DEMO_BADGE };
