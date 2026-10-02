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

/**
 * What a case is about. This is a label for the reader, not a switch the app branches on: it
 * changes how a case is described, never what the workflow does. `subject` is the default because
 * it is still the most common case here, and the rest exist so a soil core, a device, or a dataset
 * can be recorded without pretending to be a person.
 */
export const CASE_KINDS = [
  "subject",
  "material",
  "sample",
  "dataset",
  "cohort",
  "device",
  "process",
  "other",
] as const;
export type CaseKind = (typeof CASE_KINDS)[number];

export const CASE_KIND_LABELS: Record<CaseKind, string> = {
  subject: "Subject",
  material: "Material",
  sample: "Sample",
  dataset: "Dataset",
  cohort: "Cohort",
  device: "Device",
  process: "Process",
  other: "Other",
};

export const CASE_KIND_DESCRIPTIONS: Record<CaseKind, string> = {
  subject: "A person, organism, or other subject of study",
  material: "A physical material being characterized",
  sample: "A specific sample drawn or selected for analysis",
  dataset: "A collection of records analyzed as a unit",
  cohort: "A group of subjects studied together",
  device: "An instrument, rig, or machine under evaluation",
  process: "A procedure, method, or production run under study",
  other: "Something that does not fit the other kinds",
};

/**
 * How an uploaded asset is classified. The neutral entries lead, because they are what a new user
 * gets; the life-science entries are kept as real, selectable answers rather than deleted, since
 * they are correct for the genomic work this project was built around.
 */
export const DATA_CATEGORIES = [
  "measurement",
  "reference",
  "sample_data",
  "derived",
  "documentation",
  "clinical",
  "genomics",
  "transcriptomics",
  "imaging",
  "lab",
  "other",
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  measurement: "Measurement",
  reference: "Reference",
  sample_data: "Sample data",
  derived: "Derived output",
  documentation: "Documentation",
  clinical: "Clinical",
  genomics: "Genomics",
  transcriptomics: "Transcriptomics",
  imaging: "Imaging",
  lab: "Lab",
  other: "Other",
};

export const ACTIVITY_TYPES = [
  "analysis",
  "data_review",
  "literature_review",
  "comparison",
  "statistical_analysis",
  "experimental_work",
  "manuscript_draft",
  "variant_analysis",
  "imaging_review",
  "cohort_comparison",
  "clinical_correlate",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  analysis: "Analysis",
  data_review: "Data review",
  literature_review: "Literature review",
  comparison: "Comparison",
  statistical_analysis: "Statistical analysis",
  experimental_work: "Experimental work",
  manuscript_draft: "Manuscript draft",
  variant_analysis: "Variant analysis",
  imaging_review: "Imaging review",
  cohort_comparison: "Cohort comparison",
  clinical_correlate: "Clinical correlate",
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

export const FINDING_CATEGORIES = [
  "observation",
  "mechanism",
  "method",
  "limitation",
  "behavioral",
  "molecular",
  "clinical",
  "imaging",
  "lab",
  "other",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  observation: "Observation",
  mechanism: "Mechanism",
  method: "Method",
  limitation: "Limitation",
  behavioral: "Behavioral",
  molecular: "Molecular",
  clinical: "Clinical",
  imaging: "Imaging",
  lab: "Laboratory",
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
  "dataset",
  "measurement",
  "communication",
  "clinical_record",
  "other",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  publication: "Publication",
  database: "Database entry",
  dataset: "Dataset",
  measurement: "Measurement",
  communication: "Personal communication",
  clinical_record: "Clinical record",
  other: "Other",
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
  "case_updated",
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

/** Attribute keys are labels the owner types; these bounds keep them renderable and bounded. */
export const ATTRIBUTE_KEY_MAX = 40;
export const ATTRIBUTE_VALUE_MAX = 500;
export const ATTRIBUTE_MAX_COUNT = 20;
