export const PROGRAM_STATUSES = ["active", "planned", "paused", "closing", "closed"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  active: "Active",
  planned: "Planned",
  paused: "Paused",
  closing: "Closing",
  closed: "Closed",
};

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
