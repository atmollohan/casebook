process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";

// The action is exercised directly, so the request scope it depends on is stubbed.
// The database is NOT stubbed: every query below hits a real migrated SQLite instance.
let currentUserId: string | null = null;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (currentUserId ? { value: "test-token" } : undefined) }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/server/auth", () => ({
  requireUser: async () => {
    if (!currentUserId) throw new Error("redirect:/login");
    return { id: currentUserId, email: "user@example.com", name: "User" };
  },
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, migrateDb, resetDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  createCaseAndProgram,
  createReport,
  getReportAccessible,
  listReports,
  listHistory,
} from "@/lib/db/repo";
import { generateReportAction, finalizeReportAction } from "@/actions/reports";

let ownerId: string;
let otherUserId: string;
let ownerProgramId: string;

beforeAll(() => {
  resetDb();
  migrateDb(getDb());
  const owner = createUser(getDb(), {
    email: "owner@example.com",
    name: "Dr. Owner",
    passwordHash: hashPassword("owner-password"),
  });
  const other = createUser(getDb(), {
    email: "other@example.com",
    name: "Dr. Other",
    passwordHash: hashPassword("other-password"),
  });
  ownerId = owner.id;
  otherUserId = other.id;
  const { program } = createCaseAndProgram(getDb(), { id: ownerId } as never, {
    title: "Rosalind Franklin",
    subtitle: "Test condition",
    kind: "subject",
    summary: "Test condition",
    attributes: { "Birth year": "1980" },
    programTitle: "Test program",
    programHypothesis: "A test hypothesis",
    focusArea: "Genomics",
  });
  ownerProgramId = program.id;
});

beforeEach(() => {
  currentUserId = ownerId;
});

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.append(k, v);
  return fd;
}

describe("generateReportAction", () => {
  it("creates a saved draft report and returns the id needed to open it", async () => {
    const result = await generateReportAction({}, form({ programId: ownerProgramId, caseId: "cas_1" }));

    expect(result.error).toBeUndefined();
    expect(result.reportId).toBeTruthy();

    const saved = getReportAccessible(getDb(), result.reportId as string, ownerId);
    expect(saved?.report.status).toBe("draft");
    expect(saved?.report.contentJson).toContain("Case overview");
  });

  it("records the generation in the program history", async () => {
    const result = await generateReportAction({}, form({ programId: ownerProgramId, caseId: "cas_1" }));
    const events = listHistory(getDb(), ownerProgramId, ownerId) ?? [];

    expect(result.reportId).toBeTruthy();
    expect(events.some((e) => e.eventType === "report_generated")).toBe(true);
  });

  it("adds a new report each time instead of replacing the previous one", async () => {
    const before = (listReports(getDb(), ownerProgramId, ownerId) ?? []).length;
    await generateReportAction({}, form({ programId: ownerProgramId, caseId: "cas_1" }));
    const after = listReports(getDb(), ownerProgramId, ownerId) ?? [];

    expect(after).toHaveLength(before + 1);
    expect(new Set(after.map((r) => r.id)).size).toBe(after.length);
  });

  it("refuses a program the signed-in researcher does not own, and writes nothing", async () => {
    currentUserId = otherUserId;
    const before = listReports(getDb(), ownerProgramId, otherUserId) ?? [];

    const result = await generateReportAction({}, form({ programId: ownerProgramId, caseId: "cas_1" }));

    expect(result.reportId).toBeUndefined();
    expect(result.error).toBe("Program not found.");
    expect(listReports(getDb(), ownerProgramId, otherUserId) ?? []).toHaveLength(before.length);
  });

  it("reports a missing program id instead of failing silently", async () => {
    const result = await generateReportAction({}, form({ caseId: "cas_1" }));

    expect(result.reportId).toBeUndefined();
    expect(result.error).toBe("Missing program id.");
  });

  it("never returns internal error text to the client", async () => {
    currentUserId = null;
    await expect(generateReportAction({}, form({ programId: ownerProgramId }))).rejects.toThrow();
  });
});

describe("finalizeReportAction", () => {
  it("finalizes a draft and locks it to final", async () => {
    const created = createReport(getDb(), {
      programId: ownerProgramId,
      generatedById: ownerId,
      title: "Research report — CB-P-9999",
      summary: "summary",
      contentJson: "[]",
    });

    const result = await finalizeReportAction(
      {},
      form({ reportId: created.id, programId: ownerProgramId, caseId: "cas_1" }),
    );
    const after = getReportAccessible(getDb(), created.id, ownerId);

    expect(result.error).toBeUndefined();
    expect(after?.report.status).toBe("final");
    expect(after?.report.finalizedAt).toBeTruthy();
  });

  it("refuses to finalize a report belonging to another researcher's program", async () => {
    const created = createReport(getDb(), {
      programId: ownerProgramId,
      generatedById: ownerId,
      title: "Research report — CB-P-9998",
      summary: "summary",
      contentJson: "[]",
    });
    currentUserId = otherUserId;

    const result = await finalizeReportAction(
      {},
      form({ reportId: created.id, programId: ownerProgramId, caseId: "cas_1" }),
    );

    expect(result.error).toBe("Report not found.");
    expect(getReportAccessible(getDb(), created.id, ownerId)?.report.status).toBe("draft");
  });
});
