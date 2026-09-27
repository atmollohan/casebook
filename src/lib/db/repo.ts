import { and, desc, eq, sql } from "drizzle-orm";
import { type Db } from "@/lib/db";
import {
  patients,
  researchPrograms,
  dataRecords,
  researchActivities,
  findings,
  evidence,
  reports,
  historyEvents,
  sessions,
  users,
  type Patient,
  type ResearchProgram,
  type DataRecord,
  type ResearchActivity,
  type Finding,
  type Evidence,
  type Report,
  type HistoryEvent,
  type User,
} from "@/lib/db/schema";
import { newId, now } from "@/lib/utils/format";
import type {
  ProgramStatus,
  DataCategory,
  ActivityType,
  ActivityStatus,
  FindingCategory,
  SignificanceLevel,
  EvidenceSourceType,
  HistoryEventType,
} from "@/lib/constants";
import { PROGRAM_STATUS_LABELS, PROGRAM_DEFAULT_STATUS } from "@/lib/constants";

/**
 * A stored status rendered for a human. Tolerates a value that is no longer a known status
 * rather than rendering `undefined` into a history line.
 */
function programStatusLabel(status: string): string {
  return PROGRAM_STATUS_LABELS[status as ProgramStatus] ?? status;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function findUserByEmail(db: Db, email: string): User | undefined {
  return db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
}

export function findUserById(db: Db, id: string): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function createUser(
  db: Db,
  input: { email: string; name: string; title?: string; passwordHash: string },
): User {
  const row: User = {
    id: newId("usr"),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    title: input.title?.trim() || null,
    passwordHash: input.passwordHash,
    createdAt: now(),
  };
  db.insert(users).values(row).run();
  return row;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function createSession(db: Db, userId: string, tokenHash: string, ttlMs: number) {
  const nowMs = now();
  db.insert(sessions)
    .values({ id: newId("ses"), userId, tokenHash, createdAt: nowMs, expiresAt: nowMs + ttlMs })
    .run();
}

export function deleteSessionByTokenHash(db: Db, tokenHash: string) {
  db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
}

export function pruneExpiredSessions(db: Db) {
  db.delete(sessions)
    .where(sql`expires_at < ${now()}`)
    .run();
}

// ---------------------------------------------------------------------------
// Patients + programs
// ---------------------------------------------------------------------------

export interface ProgramSummary {
  patient: Patient;
  program: ResearchProgram;
  dataCount: number;
  activityCount: number;
  findingCount: number;
  reportCount: number;
}

export function listProgramsForResearcher(db: Db, userId: string): ProgramSummary[] {
  const rows = db
    .select({
      patient: patients,
      program: researchPrograms,
    })
    .from(patients)
    .innerJoin(researchPrograms, eq(researchPrograms.patientId, patients.id))
    .where(eq(patients.ownerId, userId))
    .orderBy(desc(researchPrograms.updatedAt))
    .all();
  return rows.map((r) => ({
    patient: r.patient,
    program: r.program,
    dataCount: countData(db, r.program.id),
    activityCount: countActivities(db, r.program.id),
    findingCount: countFindings(db, r.program.id),
    reportCount: countReports(db, r.program.id),
  }));
}

function countData(db: Db, programId: string): number {
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(dataRecords)
    .where(eq(dataRecords.programId, programId))
    .get();
  return row?.c ?? 0;
}

function countActivities(db: Db, programId: string): number {
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(researchActivities)
    .where(eq(researchActivities.programId, programId))
    .get();
  return row?.c ?? 0;
}

function countFindings(db: Db, programId: string): number {
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(findings)
    .where(eq(findings.programId, programId))
    .get();
  return row?.c ?? 0;
}

function countReports(db: Db, programId: string): number {
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.programId, programId))
    .get();
  return row?.c ?? 0;
}

export function getProgramForResearcher(db: Db, programId: string, userId: string): ProgramSummary | null {
  const found = listProgramsForResearcher(db, userId).find((s) => s.program.id === programId);
  return found ?? null;
}

export function findPatientById(
  db: Db,
  patientId: string,
  userId: string,
): { patient: Patient; program: ResearchProgram } | null {
  const rows = db
    .select({
      patient: patients,
      program: researchPrograms,
    })
    .from(patients)
    .innerJoin(researchPrograms, eq(researchPrograms.patientId, patients.id))
    .where(and(eq(patients.id, patientId), eq(patients.ownerId, userId)))
    .limit(1)
    .all();
  if (rows.length === 0) return null;
  return rows[0];
}

export function nextPatientPid(db: Db): string {
  // Derived from the highest pid already issued, never from the row count: retention and
  // deletion (Phase 8) remove rows, and a count would then hand back a pid that is already
  // taken, failing the unique index on an otherwise valid create.
  const row = db
    .select({ n: sql<number | null>`max(cast(replace(${patients.pid}, 'OM-P-', '') as integer))` })
    .from(patients)
    .get();
  const highest = row?.n ?? 0;
  return `OM-P-${String(highest + 1).padStart(4, "0")}`;
}

export function createPatientAndProgram(
  db: Db,
  user: User,
  input: {
    firstName: string;
    lastName: string;
    birthYear?: number | null;
    sex?: string | null;
    conditionSummary?: string;
    consentStatus?: string;
    programTitle: string;
    programDescription?: string;
    programHypothesis?: string;
    focusArea?: string;
    status?: ProgramStatus;
  },
): { patient: Patient; program: ResearchProgram } {
  const patientId = newId("pat");
  const programId = newId("prg");
  const nowMs = now();
  const pid = nextPatientPid(db);
  const patient: Patient = {
    id: patientId,
    pid,
    ownerId: user.id,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthYear: input.birthYear ?? null,
    sex: input.sex ?? null,
    conditionSummary: input.conditionSummary?.trim() || null,
    consentStatus: input.consentStatus ?? "consented",
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  const program: ResearchProgram = {
    id: programId,
    patientId,
    title: input.programTitle.trim(),
    description: input.programDescription?.trim() || null,
    hypothesis: input.programHypothesis?.trim() || null,
    focusArea: input.focusArea?.trim() || null,
    status: input.status ?? PROGRAM_DEFAULT_STATUS,
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  db.transaction((tx) => {
    tx.insert(patients).values(patient).run();
    tx.insert(researchPrograms).values(program).run();
    logHistory(tx, {
      programId,
      actorId: user.id,
      eventType: "program_created",
      entityType: "research_program",
      entityId: programId,
      summary: `Research program “${program.title}” created for patient ${patient.pid}`,
    });
  });
  return { patient, program };
}

export function updateProgram(
  db: Db,
  user: User,
  programId: string,
  input: Partial<{
    title: string;
    description: string;
    hypothesis: string;
    focusArea: string;
    status: ProgramStatus;
  }>,
) {
  const patch: Partial<ResearchProgram> = {};
  if (typeof input.title === "string") patch.title = input.title.trim();
  if (typeof input.description === "string") patch.description = input.description.trim();
  if (typeof input.hypothesis === "string") patch.hypothesis = input.hypothesis.trim();
  if (typeof input.focusArea === "string") patch.focusArea = input.focusArea.trim();
  if (input.status) patch.status = input.status;
  patch.updatedAt = now();
  db.update(researchPrograms).set(patch).where(eq(researchPrograms.id, programId)).run();
  logHistory(db, {
    programId,
    actorId: user.id,
    eventType: "program_updated",
    entityType: "research_program",
    entityId: programId,
    summary: "Research program details updated",
  });
}

/**
 * Move a program to a new status and leave the move in the case history.
 *
 * The lifecycle itself (which move is legal) is `canTransitionProgram`, enforced by the
 * server action before this is called — this function is the data layer and does not
 * second-guess it. It records where the program came from as well as where it went, because
 * "planned to active" is the fact a reader of the timeline actually needs.
 *
 * Returns null when the program does not exist, so a caller racing a delete finds out.
 */
export function setProgramStatus(
  db: Db,
  user: User,
  programId: string,
  status: ProgramStatus,
): ResearchProgram | null {
  const program = db.select().from(researchPrograms).where(eq(researchPrograms.id, programId)).get();
  if (!program) return null;
  const updatedAt = now();
  db.update(researchPrograms).set({ status, updatedAt }).where(eq(researchPrograms.id, programId)).run();
  logHistory(db, {
    programId,
    actorId: user.id,
    eventType: "program_status",
    entityType: "research_program",
    entityId: programId,
    summary: `Program status changed from ${programStatusLabel(program.status)} to ${programStatusLabel(status)}`,
    metadataJson: JSON.stringify({ from: program.status, to: status }),
  });
  return { ...program, status, updatedAt };
}

// ---------------------------------------------------------------------------
// Data records
// ---------------------------------------------------------------------------

export function createDataRecord(
  db: Db,
  input: {
    programId: string;
    uploadedById: string;
    title: string;
    category: DataCategory;
    originalFilename: string;
    mimeType: string | null;
    sizeBytes: number;
    storagePath: string;
    description?: string;
    isSynthetic?: boolean;
  },
): DataRecord {
  const record: DataRecord = {
    id: newId("rec"),
    programId: input.programId,
    uploadedById: input.uploadedById,
    title: input.title.trim(),
    category: input.category,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storagePath: input.storagePath,
    description: input.description?.trim() || null,
    isSynthetic: input.isSynthetic ?? true,
    uploadedAt: now(),
  };
  db.insert(dataRecords).values(record).run();
  logHistory(db, {
    programId: record.programId,
    actorId: record.uploadedById,
    eventType: "data_uploaded",
    entityType: "data_record",
    entityId: record.id,
    summary: `Uploaded “${record.title}” (${formatFileRef(record)})`,
    metadataJson: JSON.stringify({ category: record.category, storagePath: record.storagePath }),
  });
  return record;
}

function formatFileRef(record: DataRecord): string {
  return record.storagePath ? record.originalFilename : "document";
}

export function listDataRecords(db: Db, programId: string, userId: string): DataRecord[] | null {
  if (!programAllowed(db, programId, userId)) return null;
  return db
    .select()
    .from(dataRecords)
    .where(eq(dataRecords.programId, programId))
    .orderBy(desc(dataRecords.uploadedAt))
    .all();
}

export function getDataRecord(
  db: Db,
  recordId: string,
  programId: string,
  userId: string,
): DataRecord | null {
  if (!programAllowed(db, programId, userId)) return null;
  return (
    db
      .select()
      .from(dataRecords)
      .where(and(eq(dataRecords.id, recordId), eq(dataRecords.programId, programId)))
      .get() ?? null
  );
}

export function deleteDataRecord(db: Db, user: User, recordId: string): DataRecord | null {
  const record = db.select().from(dataRecords).where(eq(dataRecords.id, recordId)).get();
  if (!record) return null;
  if (!programAllowed(db, record.programId, user.id)) return null;
  db.delete(dataRecords).where(eq(dataRecords.id, recordId)).run();
  logHistory(db, {
    programId: record.programId,
    actorId: user.id,
    eventType: "data_deleted",
    entityType: "data_record",
    entityId: recordId,
    summary: `Removed “${record.title}”`,
  });
  return record;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export function listActivities(db: Db, programId: string, userId: string): ResearchActivity[] | null {
  if (!programAllowed(db, programId, userId)) return null;
  return db
    .select()
    .from(researchActivities)
    .where(eq(researchActivities.programId, programId))
    .orderBy(desc(researchActivities.createdAt))
    .all();
}

export function getActivity(
  db: Db,
  activityId: string,
  programId: string,
  userId: string,
): ResearchActivity | null {
  if (!programAllowed(db, programId, userId)) return null;
  return (
    db
      .select()
      .from(researchActivities)
      .where(and(eq(researchActivities.id, activityId), eq(researchActivities.programId, programId)))
      .get() ?? null
  );
}

export function createActivity(
  db: Db,
  user: User,
  input: {
    programId: string;
    title: string;
    activityType: ActivityType;
    description?: string;
    hypothesis?: string;
  },
): ResearchActivity {
  const activity: ResearchActivity = {
    id: newId("act"),
    programId: input.programId,
    createdById: user.id,
    title: input.title.trim(),
    activityType: input.activityType,
    description: input.description?.trim() || null,
    hypothesis: input.hypothesis?.trim() || null,
    status: "planned",
    startedAt: null,
    completedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
  db.insert(researchActivities).values(activity).run();
  logHistory(db, {
    programId: input.programId,
    actorId: user.id,
    eventType: "activity_created",
    entityType: "research_activity",
    entityId: activity.id,
    summary: `Activity “${activity.title}” created`,
  });
  return activity;
}

export function setActivityStatus(
  db: Db,
  user: User,
  activityId: string,
  programId: string,
  status: ActivityStatus,
) {
  const activity = db
    .select()
    .from(researchActivities)
    .where(and(eq(researchActivities.id, activityId), eq(researchActivities.programId, programId)))
    .get();
  if (!activity) return null;
  const nowMs = now();
  const patch: Partial<ResearchActivity> = { status, updatedAt: nowMs };
  if (status === "in_progress" && !activity.startedAt) patch.startedAt = nowMs;
  if (status === "completed") {
    patch.completedAt = nowMs;
    if (!activity.startedAt) patch.startedAt = nowMs;
  }
  db.update(researchActivities).set(patch).where(eq(researchActivities.id, activityId)).run();
  const eventType: HistoryEventType =
    status === "in_progress"
      ? "activity_started"
      : status === "completed"
        ? "activity_completed"
        : "activity_status";
  logHistory(db, {
    programId,
    actorId: user.id,
    eventType,
    entityType: "research_activity",
    entityId: activityId,
    summary: `Activity “${activity.title}” marked as ${activityStatusLabel(status)}`,
  });
  return activity;
}

function activityStatusLabel(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    planned: "planned",
    in_progress: "in progress",
    completed: "completed",
    closed: "closed",
  };
  return labels[status];
}

// ---------------------------------------------------------------------------
// Findings + evidence
// ---------------------------------------------------------------------------

export interface FindingWithEvidence extends Finding {
  activity: { id: string; title: string } | null;
  reporter: { id: string; name: string };
  evidence: Evidence[];
}

export function listFindings(db: Db, programId: string, userId: string): FindingWithEvidence[] | null {
  if (!programAllowed(db, programId, userId)) return null;
  const findingRows = db
    .select()
    .from(findings)
    .where(eq(findings.programId, programId))
    .orderBy(desc(findings.createdAt))
    .all();
  const activityRows = db
    .select({ id: researchActivities.id, title: researchActivities.title })
    .from(researchActivities)
    .where(eq(researchActivities.programId, programId))
    .all();
  const reporterRows = db.select({ id: users.id, name: users.name }).from(users).all();
  const activityMap = new Map(activityRows.map((a) => [a.id, a]));
  const reporterMap = new Map(reporterRows.map((u) => [u.id, u]));
  const ids = findingRows.map((f) => f.id);
  const allEvidence = ids.length > 0 ? queryEvidenceForFindingIds(db, ids) : [];
  return findingRows.map((f) => ({
    ...f,
    activity: f.activityId ? (activityMap.get(f.activityId) ?? null) : null,
    reporter: reporterMap.get(f.reportedById) ?? { id: f.reportedById, name: f.reportedById },
    evidence: allEvidence.filter((e) => e.findingId === f.id),
  }));
}

function queryEvidenceForFindingIds(db: Db, findingIds: string[]): Evidence[] {
  const ids = [...new Set(findingIds)];
  const quoted = ids.map((id) => `'${id.replace(/'/g, "")}'`).join(",");
  if (quoted.length === 0) return [];
  const rows = db.$client
    .prepare(
      `select id, finding_id as findingId, added_by_id as addedById, source_type as sourceType,
              title, url, doi, note, attachment_data_record_id as attachmentDataRecordId, created_at as createdAt
       from evidence where finding_id in (${quoted}) order by created_at asc`,
    )
    .all() as unknown as Evidence[];
  return rows;
}

export function getFinding(
  db: Db,
  findingId: string,
  programId: string,
  userId: string,
): FindingWithEvidence | null {
  const all = listFindings(db, programId, userId) ?? [];
  return all.find((f) => f.id === findingId) ?? null;
}

export function createFinding(
  db: Db,
  user: User,
  input: {
    programId: string;
    activityId?: string | null;
    title: string;
    description: string;
    category: FindingCategory;
    significance: SignificanceLevel;
  },
): Finding {
  const finding: Finding = {
    id: newId("fnd"),
    programId: input.programId,
    activityId: input.activityId || null,
    reportedById: user.id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    significance: input.significance,
    createdAt: now(),
    updatedAt: now(),
  };
  db.insert(findings).values(finding).run();
  logHistory(db, {
    programId: input.programId,
    actorId: user.id,
    eventType: "finding_created",
    entityType: "finding",
    entityId: finding.id,
    summary: `Finding recorded: “${finding.title}”`,
    metadataJson: JSON.stringify({ significance: finding.significance }),
  });
  return finding;
}

export function updateFinding(
  db: Db,
  user: User,
  findingId: string,
  programId: string,
  input: Partial<{
    title: string;
    description: string;
    category: FindingCategory;
    significance: SignificanceLevel;
    activityId: string | null;
  }>,
) {
  const finding = db
    .select()
    .from(findings)
    .where(and(eq(findings.id, findingId), eq(findings.programId, programId)))
    .get();
  if (!finding) return null;
  const patch: Partial<Finding> = { updatedAt: now() };
  if (typeof input.title === "string") patch.title = input.title.trim();
  if (typeof input.description === "string") patch.description = input.description.trim();
  if (input.category) patch.category = input.category;
  if (input.significance) patch.significance = input.significance;
  if (input.activityId !== undefined) patch.activityId = input.activityId;
  db.update(findings).set(patch).where(eq(findings.id, findingId)).run();
  logHistory(db, {
    programId,
    actorId: user.id,
    eventType: "finding_updated",
    entityType: "finding",
    entityId: findingId,
    summary: `Finding updated: “${finding.title}”`,
  });
  return finding;
}

export function addEvidence(
  db: Db,
  user: User,
  input: {
    findingId: string;
    programId: string;
    sourceType: EvidenceSourceType;
    title: string;
    url?: string | null;
    doi?: string | null;
    note?: string | null;
    attachmentDataRecordId?: string | null;
  },
): Evidence | null {
  const finding = db
    .select()
    .from(findings)
    .where(and(eq(findings.id, input.findingId), eq(findings.programId, input.programId)))
    .get();
  if (!finding) return null;
  const row: Evidence = {
    id: newId("evd"),
    findingId: input.findingId,
    addedById: user.id,
    sourceType: input.sourceType,
    title: input.title.trim(),
    url: input.url?.trim() || null,
    doi: input.doi?.trim() || null,
    note: input.note?.trim() || null,
    attachmentDataRecordId: input.attachmentDataRecordId || null,
    createdAt: now(),
  };
  db.insert(evidence).values(row).run();
  logHistory(db, {
    programId: input.programId,
    actorId: user.id,
    eventType: "evidence_added",
    entityType: "evidence",
    entityId: row.id,
    summary: `Evidence added to “${finding.title}”: ${row.title}`,
  });
  return row;
}

export function removeEvidence(
  db: Db,
  user: User,
  evidenceId: string,
  findingId: string,
  programId: string,
): Evidence | null {
  const row = db
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, evidenceId), eq(evidence.findingId, findingId)))
    .get();
  if (!row) return null;
  const finding = db
    .select()
    .from(findings)
    .where(and(eq(findings.id, findingId), eq(findings.programId, programId)))
    .get();
  if (!finding) return null;
  db.delete(evidence).where(eq(evidence.id, evidenceId)).run();
  return row;
}

export function listEvidenceForProgram(db: Db, programId: string, userId: string): Evidence[] | null {
  if (!programAllowed(db, programId, userId)) return null;
  const findingRows = db.select().from(findings).where(eq(findings.programId, programId)).all();
  if (findingRows.length === 0) return [];
  return queryEvidenceForFindingIds(
    db,
    findingRows.map((f) => f.id),
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function listReports(db: Db, programId: string, userId: string): Report[] | null {
  if (!programAllowed(db, programId, userId)) return null;
  return db
    .select()
    .from(reports)
    .where(eq(reports.programId, programId))
    .orderBy(desc(reports.createdAt))
    .all();
}

export function getReport(db: Db, reportId: string, programId: string, userId: string): Report | null {
  if (!programAllowed(db, programId, userId)) return null;
  return (
    db
      .select()
      .from(reports)
      .where(and(eq(reports.id, reportId), eq(reports.programId, programId)))
      .get() ?? null
  );
}

export function getReportAccessible(
  db: Db,
  reportId: string,
  userId: string,
): { report: Report; programId: string; patientId: string } | null {
  const report = db.select().from(reports).where(eq(reports.id, reportId)).get();
  if (!report) return null;
  if (!programAllowed(db, report.programId, userId)) return null;
  const patient = db
    .select({ id: patients.id, pid: patients.pid })
    .from(researchPrograms)
    .innerJoin(patients, eq(patients.id, researchPrograms.patientId))
    .where(eq(researchPrograms.id, report.programId))
    .get();
  if (!patient) return null;
  return { report, programId: report.programId, patientId: patient.id };
}

export function createReport(
  db: Db,
  input: {
    programId: string;
    generatedById: string;
    title: string;
    summary: string;
    contentJson: string;
  },
): Report {
  const report: Report = {
    id: newId("rpt"),
    programId: input.programId,
    generatedById: input.generatedById,
    title: input.title,
    status: "draft",
    summary: input.summary,
    contentJson: input.contentJson,
    createdAt: now(),
    finalizedAt: null,
  };
  db.insert(reports).values(report).run();
  logHistory(db, {
    programId: input.programId,
    actorId: input.generatedById,
    eventType: "report_generated",
    entityType: "report",
    entityId: report.id,
    summary: `Report generated: “${report.title}”`,
  });
  return report;
}

export function finalizeReport(db: Db, user: User, reportId: string, programId: string): Report | null {
  const report = db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.programId, programId)))
    .get();
  if (!report) return null;
  // Finalizing locks a report and writes history, so it needs the same ownership
  // check as every other write — a report id alone must not be enough.
  if (!programAllowed(db, programId, user.id)) return null;
  db.update(reports).set({ status: "final", finalizedAt: now() }).where(eq(reports.id, reportId)).run();
  logHistory(db, {
    programId,
    actorId: user.id,
    eventType: "report_finalized",
    entityType: "report",
    entityId: reportId,
    summary: `Report finalized: “${report.title}”`,
  });
  return { ...report, status: "final", finalizedAt: now() };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function logHistory(
  db: InsertableDb,
  input: {
    programId: string;
    actorId?: string | null;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    summary: string;
    metadataJson?: string | null;
    createdAt?: number;
  },
) {
  const row: HistoryEvent = {
    id: newId("evt"),
    programId: input.programId,
    actorId: input.actorId ?? null,
    eventType: input.eventType,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    summary: input.summary,
    metadataJson: input.metadataJson ?? null,
    createdAt: input.createdAt ?? now(),
  };
  db.insert(historyEvents).values(row).run();
}

/**
 * A history entry with its actor resolved. Attribution is the point of this table: a case
 * is meant to be handed between researchers, so "what happened" is only half the record.
 * `actorName` is null for events with no actor (seeded fixtures, system writes).
 */
export interface HistoryEntry extends HistoryEvent {
  actorName: string | null;
}

export function listHistory(db: Db, programId: string, userId: string): HistoryEntry[] | null {
  if (!programAllowed(db, programId, userId)) return null;
  return db
    .select({
      id: historyEvents.id,
      programId: historyEvents.programId,
      actorId: historyEvents.actorId,
      eventType: historyEvents.eventType,
      entityType: historyEvents.entityType,
      entityId: historyEvents.entityId,
      summary: historyEvents.summary,
      metadataJson: historyEvents.metadataJson,
      createdAt: historyEvents.createdAt,
      actorName: users.name,
    })
    .from(historyEvents)
    .leftJoin(users, eq(users.id, historyEvents.actorId))
    .where(eq(historyEvents.programId, programId))
    .orderBy(desc(historyEvents.createdAt))
    .all();
}

// ---------------------------------------------------------------------------
// Ownership guard
// ---------------------------------------------------------------------------

/** Minimal insert-capable handle (drizzle db or a drizzle tx). */
type InsertableDb = {
  insert(table: object): { values(row: object): { run(): unknown } };
};

export function programAllowed(db: Db, programId: string, userId: string): boolean {
  const row = db
    .select({ pid: patients.id })
    .from(researchPrograms)
    .innerJoin(patients, eq(patients.id, researchPrograms.patientId))
    .where(and(eq(researchPrograms.id, programId), eq(patients.ownerId, userId)))
    .limit(1)
    .all();
  return row.length > 0;
}
