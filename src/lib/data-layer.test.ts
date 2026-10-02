process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";

import { beforeAll, describe, expect, it } from "vitest";
import { getDb, migrateDb, resetDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  createCaseAndProgram,
  findCaseById,
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
import { generateReport } from "@/lib/report/generate";

let userId: string;

beforeAll(() => {
  resetDb();
  migrateDb(getDb());
  const user = createUser(getDb(), {
    email: "test@example.com",
    name: "Dr. Test",
    passwordHash: hashPassword("test-password"),
  });
  userId = user.id;
});

function makeCase() {
  return createCaseAndProgram(getDb(), { id: userId } as never, {
    title: "Ada Lovelace",
    subtitle: "Test condition",
    kind: "subject",
    summary: "Test condition",
    attributes: { "Birth year": "1979" },
    programTitle: "Test program",
    programHypothesis: "A test hypothesis",
    focusArea: "Genomics",
  });
}

describe("case + program lifecycle", () => {
  it("creates a case, program, code, and program_created history event", () => {
    const { case: created, program } = makeCase();
    expect(created.code).toMatch(/^CB-C-\d{4}$/);
    expect(program.caseId).toBe(created.id);

    const found = findCaseById(getDb(), created.id, userId);
    expect(found?.case.id).toBe(created.id);
    expect(found?.program.id).toBe(program.id);

    const events = listHistory(getDb(), program.id, userId) ?? [];
    expect(events.some((e) => e.eventType === "program_created")).toBe(true);
  });

  it("issues sequential codes", () => {
    const a = makeCase();
    const b = makeCase();
    const seqA = Number(a.case.code.split("-").pop());
    const seqB = Number(b.case.code.split("-").pop());
    expect(seqB).toBe(seqA + 1);
  });

  it("only the owning researcher can see a program", () => {
    const other = createUser(getDb(), {
      email: "other@example.com",
      name: "Dr. Other",
      passwordHash: hashPassword("x"),
    });
    const { case: created, program } = makeCase();
    expect(listProgramsForResearcher(getDb(), userId).some((s) => s.program.id === program.id)).toBe(true);
    expect(listProgramsForResearcher(getDb(), other.id).some((s) => s.program.id === program.id)).toBe(false);
    expect(findCaseById(getDb(), created.id, other.id)).toBeNull();
  });
});

describe("data records", () => {
  it("creates, lists, and deletes a record with history", () => {
    const { program } = makeCase();
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
    const { program } = makeCase();
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
    const { program } = makeCase();
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
    const other = createUser(getDb(), {
      email: "o2@example.com",
      name: "O",
      passwordHash: hashPassword("x"),
    });
    const { program } = makeCase();
    expect(listFindings(getDb(), program.id, other.id)).toBeNull();
  });
});

describe("reports", () => {
  it("generates content, creates a report, and finalizes it", () => {
    const { case: created, program } = makeCase();
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

    const report0 = generateReport(getDb(), program.id, userId);
    const content = report0.content;
    const titles = content.map((s) => s.title);
    expect(titles).toContain("Case overview");
    expect(titles).toContain("Research program");
    expect(titles).toContain("Methodology & limitations");
    const dataSection = content.find((s) => s.title === "Research data");
    expect(dataSection?.blocks.find((b) => b.type === "table")?.rows).toHaveLength(1);

    const report = createReport(getDb(), {
      programId: program.id,
      generatedById: userId,
      title: report0.title,
      summary: "summary",
      contentJson: JSON.stringify(content),
    });
    expect(report.status).toBe("draft");

    const accessible = getReportAccessible(getDb(), report.id, userId);
    expect(accessible?.caseId).toBe(created.id);

    finalizeReport(getDb(), { id: userId } as never, report.id, program.id);
    const finalized = getReportAccessible(getDb(), report.id, userId);
    expect(finalized?.report.status).toBe("final");
    expect(finalized?.report.finalizedAt).toBeTruthy();
    const events = listHistory(getDb(), program.id, userId) ?? [];
    expect(events.some((e) => e.eventType === "report_finalized")).toBe(true);
  });
});
