export const PROGRAM_STATUSES = ["active", "planned", "paused", "closing", "closed"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  active: "Active",
  planned: "Planned",
  paused: "Paused",
  closing: "Closing",
  closed: "Closed",
};

/**
 * Which status may follow which. The one place the program lifecycle is defined: the server
 * action refuses a move that is not listed here, and the control in the workspace offers
 * exactly the listed targets, so the two cannot disagree.
 *
 * The shape of the lifecycle: a program is scoped before it starts (`planned`), runs
 * (`active`), can be held (`paused`) and resumed, is wound down deliberately (`closing`),
 * and ends `closed`. `closed` is terminal, and every other status can still reach it, so no
 * case can be stranded.
 */
export const PROGRAM_STATUS_TRANSITIONS: Record<ProgramStatus, readonly ProgramStatus[]> = {
  planned: ["active", "closed"],
  active: ["paused", "closing"],
  paused: ["active", "closing"],
  closing: ["active", "closed"],
  closed: [],
};

/** True when `to` is a legal next status for a program currently in `from`. */
export function canTransitionProgram(from: ProgramStatus, to: ProgramStatus): boolean {
  return PROGRAM_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The statuses a program may be *created* in. A new case starts at the beginning of the
 * lifecycle, so it cannot be born paused, closing, or closed — those only mean something
 * once there has been work.
 */
export const PROGRAM_INITIAL_STATUSES = ["planned", "active"] as const;
export type ProgramInitialStatus = (typeof PROGRAM_INITIAL_STATUSES)[number];

/**
 * A new program is scoped, not started: the common case is registering a case now and
 * beginning the investigation once the data or a collaborator is in place, and the Overview
 * tab then offers "Start program" as the first real step.
 */
export const PROGRAM_DEFAULT_STATUS: ProgramInitialStatus = "planned";

export const DATA_CATEGORIES = [
  "clinical",
  "genomics",
  "transcriptomics",
  "imaging",
  "lab",
  "other",
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  clinical: "Clinical",
  genomics: "Genomics",
  transcriptomics: "Transcriptomics",
  imaging: "Imaging",
  lab: "Lab",
  other: "Other",
};

export const ACTIVITY_TYPES = [
  "variant_analysis",
  "literature_review",
  "imaging_review",
  "cohort_comparison",
  "statistical_analysis",
  "clinical_correlate",
  "manuscript_draft",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  variant_analysis: "Variant analysis",
  literature_review: "Literature review",
  imaging_review: "Imaging review",
  cohort_comparison: "Cohort comparison",
  statistical_analysis: "Statistical analysis",
  clinical_correlate: "Clinical correlate",
  manuscript_draft: "Manuscript draft",
  other: "Other",
};

export const ACTIVITY_STATUSES = ["planned", "in_progress", "completed", "closed"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};

export const FINDING_CATEGORIES = ["molecular", "clinical", "imaging", "lab", "behavioral", "other"] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  molecular: "Molecular",
  clinical: "Clinical",
  imaging: "Imaging",
  lab: "Laboratory",
  behavioral: "Behavioral",
  other: "Other",
};

export const SIGNIFICANCE_LEVELS = ["low", "medium", "high"] as const;
export type SignificanceLevel = (typeof SIGNIFICANCE_LEVELS)[number];

export const SIGNIFICANCE_LABELS: Record<SignificanceLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const EVIDENCE_SOURCE_TYPES = [
  "publication",
  "database",
  "clinical_record",
  "dataset",
  "communication",
  "other",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  publication: "Publication",
  database: "Database entry",
  clinical_record: "Clinical record",
  dataset: "Dataset",
  communication: "Personal communication",
  other: "Other",
};

export const CONSENT_STATUSES = ["consented", "deidentified", "consent_pending"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  consented: "Consent on file",
  deidentified: "Deidentified cohort",
  consent_pending: "Consent pending",
};

export const SEX_VALUES = ["female", "male", "unknown"] as const;
export type SexValue = (typeof SEX_VALUES)[number];

export const SEX_LABELS: Record<SexValue, string> = {
  female: "Female",
  male: "Male",
  unknown: "Not specified",
};

export const REPORT_STATUS = ["draft", "final"] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: "Draft",
  final: "Final",
};

export const HISTORY_EVENT_TYPES = [
  "program_created",
  "program_updated",
  "program_status",
  "patient_updated",
  "data_uploaded",
  "data_deleted",
  "activity_created",
  "activity_started",
  "activity_completed",
  "activity_status",
  "finding_created",
  "finding_updated",
  "evidence_added",
  "report_generated",
  "report_finalized",
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export const DEMO_BADGE = "Synthetic data, not for clinical use";
