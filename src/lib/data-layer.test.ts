process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";

import { beforeAll, describe, expect, it } from "vitest";
import { getDb, migrateDb, resetDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  createPatientAndProgram,
  findPatientById,
  listProgramsForResearcher,
  createDataRecord,
  listDataRecords,
  deleteDataRecord,
  createActivity,
  setActivityStatus,
  listActivities,
  createFinding,
  addEvidence,
  removeEvidence,
  listFindings,
  listEvidenceForProgram,
  createReport,
  finalizeReport,
  getReportAccessible,
  listHistory,
} from "@/lib/db/repo";
import { generateReportContent } from "@/lib/report/generate";

let userId: string;

beforeAll(() => {
  resetDb();
  migrateDb(getDb());
  const user = createUser(getDb(), {
    email: "test@omanta.dev",
    name: "Dr. Test",
    passwordHash: hashPassword("test-password"),
  });
  userId = user.id;
});

function makePatient() {
  return createPatientAndProgram(getDb(), { id: userId } as never, {
    firstName: "Ada",
    lastName: "Lovelace",
    birthYear: 1979,
    sex: "female",
    conditionSummary: "Test condition",
    consentStatus: "consented",
    programTitle: "Test program",
    programHypothesis: "A test hypothesis",
    focusArea: "Genomics",
  });
}

describe("patient + program lifecycle", () => {
  it("creates a patient, program, pid, and program_created history event", () => {
    const { patient, program } = makePatient();
    expect(patient.pid).toMatch(/^OM-P-\d{4}$/);
    expect(program.patientId).toBe(patient.id);

    const found = findPatientById(getDb(), patient.id, userId);
    expect(found?.patient.id).toBe(patient.id);
    expect(found?.program.id).toBe(program.id);

    const events = listHistory(getDb(), program.id, userId) ?? [];
    expect(events.some((e) => e.eventType === "program_created")).toBe(true);
  });

  it("issues sequential pids", () => {
    const a = makePatient();
    const b = makePatient();
    const seqA = Number(a.patient.pid.split("-").pop());
    const seqB = Number(b.patient.pid.split("-").pop());
    expect(seqB).toBe(seqA + 1);
  });

  it("only the owning researcher can see a program", () => {
    const other = createUser(getDb(), {
      email: "other@omanta.dev",
      name: "Dr. Other",
      passwordHash: hashPassword("x"),
    });
    const { patient, program } = makePatient();
    expect(listProgramsForResearcher(getDb(), userId).some((s) => s.program.id === program.id)).toBe(true);
    expect(listProgramsForResearcher(getDb(), other.id).some((s) => s.program.id === program.id)).toBe(false);
    expect(findPatientById(getDb(), patient.id, other.id)).toBeNull();
  });
});

describe("data records", () => {
  it("creates, lists, and deletes a record with history", () => {
    const { program } = makePatient();
    const rec = createDataRecord(getDb(), {
      programId: program.id,
      uploadedById: userId,
      title: "Variant calls",
      category: "genomics",
      originalFilename: "vars.csv",
      mimeType: "text/csv",
      sizeBytes: 1024,
      storagePath: "synthetic/vars.csv",
      description: "Test data",
    });
    expect(rec.isSynthetic).toBe(true);
    const listed = listDataRecords(getDb(), program.id, userId) ?? [];
    expect(listed.some((r) => r.id === rec.id)).toBe(true);

    const removed = deleteDataRecord(getDb(), { id: userId } as never, rec.id);
    expect(removed?.id).toBe(rec.id);
    expect((listDataRecords(getDb(), program.id, userId) ?? []).some((r) => r.id === rec.id)).toBe(false);
    const events = listHistory(getDb(), program.id, userId) ?? [];
    expect(events.some((e) => e.eventType === "data_deleted")).toBe(true);
  });
});

describe("activities", () => {
  it("creates an activity and walks planned → in_progress → completed", () => {
    const { program } = makePatient();
    const act = createActivity(getDb(), { id: userId } as never, {
      programId: program.id,
      title: "Variant burden review",
      activityType: "variant_analysis",
      description: "Review variants",
      hypothesis: "TP53 is dominant",
    });
    expect(act.status).toBe("planned");

    setActivityStatus(getDb(), { id: userId } as never, act.id, program.id, "in_progress");
    let current = listActivities(getDb(), program.id, userId)?.find((a) => a.id === act.id);
    expect(current?.status).toBe("in_progress");
    expect(current?.startedAt).toBeTruthy();

    setActivityStatus(getDb(), { id: userId } as never, act.id, program.id, "completed");
    current = listActivities(getDb(), program.id, userId)?.find((a) => a.id === act.id);
    expect(current?.status).toBe("completed");
    expect(current?.completedAt).toBeTruthy();

    const events = listHistory(getDb(), program.id, userId) ?? [];
    expect(events.some((e) => e.eventType === "activity_created")).toBe(true);
    expect(events.some((e) => e.eventType === "activity_started")).toBe(true);
    expect(events.some((e) => e.eventType === "activity_completed")).toBe(true);
  });
});

describe("findings + evidence", () => {
  it("records a finding tied to an activity with reporter and evidence", () => {
    const { program } = makePatient();
    const act = createActivity(getDb(), { id: userId } as never, {
      programId: program.id,
      title: "Scan literature",
      activityType: "literature_review",
    });
    const finding = createFinding(getDb(), { id: userId, name: "Dr. Test" } as never, {
      programId: program.id,
      activityId: act.id,
      title: "Biallelic TP53 loss in dominant clone",
      description: "Observed 17p deletion and missense mutation together.",
      category: "molecular",
      significance: "high",
    });

    const ev = addEvidence(getDb(), { id: userId } as never, {
      findingId: finding.id,
      programId: program.id,
      sourceType: "publication",
      title: "TP53 loss in CLL",
      url: "https://example.org/1",
      doi: null,
      note: "Reference",
      attachmentDataRecordId: null,
    });
    expect(ev).not.toBeNull();

    const list = listFindings(getDb(), program.id, userId) ?? [];
    const wrapped = list.find((f) => f.id === finding.id);
    expect(wrapped?.activity?.id).toBe(act.id);
    expect(wrapped?.reporter.name).toBe("Dr. Test");
    expect(wrapped?.evidence).toHaveLength(1);
    expect(wrapped?.evidence[0].sourceType).toBe("publication");

    const allEvidence = listEvidenceForProgram(getDb(), program.id, userId) ?? [];
    expect(allEvidence.some((e) => e.id === ev?.id)).toBe(true);

    removeEvidence(getDb(), { id: userId } as never, ev!.id, finding.id, program.id);
    expect(
      (listFindings(getDb(), program.id, userId) ?? []).find((f) => f.id === finding.id)?.evidence,
    ).toHaveLength(0);
  });

  it("blocks access to findings for a non-owner", () => {
    const other = createUser(getDb(), { email: "o2@omanta.dev", name: "O", passwordHash: hashPassword("x") });
    const { program } = makePatient();
    expect(listFindings(getDb(), program.id, other.id)).toBeNull();
  });
});

describe("reports", () => {
  it("generates content, creates a report, and finalizes it", () => {
    const { patient, program } = makePatient();
    createDataRecord(getDb(), {
      programId: program.id,
      uploadedById: userId,
      title: "WES variants",
      category: "genomics",
      originalFilename: "w.csv",
      mimeType: "text/csv",
      sizeBytes: 5,
      storagePath: "s/x.csv",
    });

    const content = generateReportContent(getDb(), program.id, userId);
    const titles = content.map((s) => s.title);
    expect(titles).toContain("Patient overview");
    expect(titles).toContain("Research program");
    expect(titles).toContain("Methodology & limitations");
    const dataSection = content.find((s) => s.title === "Research data");
    expect(dataSection?.blocks.find((b) => b.type === "table")?.rows).toHaveLength(1);

    const report = createReport(getDb(), {
      programId: program.id,
      generatedById: userId,
      title: `Research report — ${patient.pid}`,
      summary: "summary",
      contentJson: JSON.stringify(content),
    });
    expect(report.status).toBe("draft");

    const accessible = getReportAccessible(getDb(), report.id, userId);
    expect(accessible?.patientId).toBe(patient.id);

    finalizeReport(getDb(), { id: userId } as never, report.id, program.id);
    const finalized = getReportAccessible(getDb(), report.id, userId);
    expect(finalized?.report.status).toBe("final");
    expect(finalized?.report.finalizedAt).toBeTruthy();
    const events = listHistory(getDb(), program.id, userId) ?? [];
    expect(events.some((e) => e.eventType === "report_finalized")).toBe(true);
  });
});
