import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";

// Uploads in this suite write real bytes, so point storage at a temp dir before anything
// can read the setting. Never the project's data dir.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omanta-workflow-"));
process.env.DATA_DIR = TMP_DIR;

/**
 * The case lifecycle, end to end, through the real server actions.
 *
 * Everything below the request scope is real: real migrated SQLite, real filesystem
 * writes, real validation, real authorization. Only the session is stubbed, because a
 * server action reads it from request scope and there is no request here.
 *
 * This is the regression net for the workflows a researcher actually performs — upload a
 * file, run an activity, conclude a finding, cite evidence, generate and finalize a report
 * — and it asserts three things at once: the work persisted, a stranger is refused at
 * every step, and every step left an attributed history entry.
 */
let currentUserId: string | null = null;
const redirects: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (currentUserId ? { value: "test-token" } : undefined) }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Next's redirect() never returns: it throws NEXT_REDIRECT. The mock does the same, so
// actions that end in a redirect behave here exactly as they do in the app.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

vi.mock("@/lib/server/auth", () => ({
  requireUser: async () => {
    if (!currentUserId) throw new Error("redirect:/login");
    const { getDb } = await import("@/lib/db");
    const { findUserById } = await import("@/lib/db/repo");
    const user = findUserById(getDb(), currentUserId);
    if (!user) throw new Error("no such user");
    return user;
  },
}));

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, migrateDb, resetDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  createPatientAndProgram,
  listDataRecords,
  listActivities,
  listFindings,
  listEvidenceForProgram,
  getReportAccessible,
  listHistory,
} from "@/lib/db/repo";
import { storagePathExists, absoluteStoragePath } from "@/lib/files/storage";
import { uploadDataAction, deleteDataAction } from "@/actions/data";
import { createActivityAction, updateActivityStatusAction } from "@/actions/activities";
import { createFindingAction, addEvidenceAction } from "@/actions/findings";
import { generateReportAction, finalizeReportAction } from "@/actions/reports";

let ownerId: string;
let strangerId: string;
let patientId: string;
let programId: string;

beforeAll(() => {
  resetDb();
  migrateDb(getDb());
  const owner = createUser(getDb(), {
    email: "owner@omanta.dev",
    name: "Dr. Rosalind Franklin",
    passwordHash: hashPassword("owner-password"),
    title: "Principal Investigator",
  });
  const stranger = createUser(getDb(), {
    email: "stranger@omanta.dev",
    name: "Dr. Unrelated",
    passwordHash: hashPassword("stranger-password"),
    title: "Researcher",
  });
  ownerId = owner.id;
  strangerId = stranger.id;

  const created = createPatientAndProgram(getDb(), owner, {
    firstName: "Ada",
    lastName: "Nkemelu",
    birthYear: 2014,
    sex: "female",
    conditionSummary: "Unexplained developmental regression",
    consentStatus: "consented",
    programTitle: "Whole exome analysis",
    programHypothesis: "A coding variant explains the regression",
    focusArea: "Genomics",
  });
  patientId = created.patient.id;
  programId = created.program.id;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  currentUserId = ownerId;
  redirects.length = 0;
});

function form(values: Record<string, string | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.append(k, v);
  return fd;
}

/** A real file from the committed sample set, so the upload path sees real bytes. */
function sampleFile(name = "serial_cbc.csv") {
  const bytes = fs.readFileSync(path.resolve(process.cwd(), "samples", name));
  return new File([bytes], name, { type: "text/csv" });
}

const base = () => ({ programId, patientId });

describe("case lifecycle", () => {
  it("walks a program from empty to a finalized report", async () => {
    // --- 1. Upload data -----------------------------------------------------
    const upload = await uploadDataAction(
      {},
      form({
        ...base(),
        title: "Serial blood counts",
        category: "clinical",
        description: "18-point CBC",
        file: sampleFile(),
      }),
    );
    expect(upload.error).toBeUndefined();
    const files = listDataRecords(getDb(), programId, ownerId)!;
    expect(files).toHaveLength(1);
    expect(files[0].title).toBe("Serial blood counts");
    expect(files[0].isSynthetic).toBe(true);

    // Bytes are on disk under the program's directory, and the stored path is relative
    // so the data dir can move without rewriting rows.
    expect(files[0].storagePath).toMatch(new RegExp(`^programs/${programId}/`));
    expect(storagePathExists(files[0].storagePath!)).toBe(true);

    // --- 2. Run an activity -------------------------------------------------
    // Creating an activity ends in a redirect to it, so the action throws rather than returns.
    await expect(
      createActivityAction(
        {},
        form({
          ...base(),
          title: "Exome variant review",
          activityType: "variant_analysis",
          hypothesis: "Is there a de novo coding variant?",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirects[0]).toMatch(/^\/patients\/.+\/activities\/act_/);

    const activities = listActivities(getDb(), programId, ownerId)!;
    expect(activities).toHaveLength(1);
    const activityId = activities[0].id;
    expect(activities[0].status).toBe("planned");

    // --- 3. Walk it to completion ------------------------------------------
    for (const status of ["in_progress", "completed"]) {
      const res = await updateActivityStatusAction({}, form({ ...base(), activityId, status }));
      expect(res.error).toBeUndefined();
    }
    expect(listActivities(getDb(), programId, ownerId)![0].status).toBe("completed");

    // --- 4. Conclude a finding ---------------------------------------------
    const findingRes = await createFindingAction(
      {},
      form({
        ...base(),
        title: "De novo missense variant in the candidate gene",
        description: "Absent from both parents.",
        category: "molecular",
        significance: "high",
        activityId,
      }),
    );
    expect(findingRes.error).toBeUndefined();
    const findings = listFindings(getDb(), programId, ownerId)!;
    expect(findings).toHaveLength(1);
    expect(findings[0].activityId).toBe(activityId);
    const findingId = findings[0].id;

    // --- 5. Cite evidence --------------------------------------------------
    const evidenceRes = await addEvidenceAction(
      {},
      form({
        ...base(),
        findingId,
        sourceType: "publication",
        title: "Smith et al. 2019",
        url: "https://example.org/paper",
        doi: "10.0000/example",
        note: "Same phenotype, same residue.",
      }),
    );
    expect(evidenceRes.error).toBeUndefined();
    expect(listEvidenceForProgram(getDb(), programId, ownerId)).toHaveLength(1);

    // --- 6. Generate and finalize the report -------------------------------
    const generated = await generateReportAction({}, form(base()));
    expect(generated.error).toBeUndefined();
    expect(generated.reportId).toMatch(/^rpt_/);

    const reportId = generated.reportId!;
    const draft = getReportAccessible(getDb(), reportId, ownerId)!.report;
    expect(draft.status).toBe("draft");

    const finalized = await finalizeReportAction(
      {},
      form({ reportId: generated.reportId!, programId, patientId }),
    );
    expect(finalized.error).toBeUndefined();
    expect(getReportAccessible(getDb(), reportId, ownerId)!.report.status).toBe("final");

    // The report is a rendered document, so assert the work actually appears in it
    // rather than asserting on an internal shape.
    const rendered = draft.contentJson!;
    for (const expected of [
      "Nkemelu", // patient
      "Serial blood counts", // uploaded data
      "serial_cbc.csv", // its original filename
      "Exome variant review", // activity
      "De novo missense", // finding
      "Smith et al. 2019", // evidence citation
      "Whole exome analysis", // program
    ]) {
      expect(rendered, `report is missing ${expected}`).toContain(expected);
    }
    // The report credits the researcher who recorded the finding, not just the program.
    expect(rendered).toContain("Reported by");
    expect(rendered).toContain("Dr. Rosalind Franklin");
  });

  it("removes an uploaded file and its bytes, and says so in history", async () => {
    const before = listDataRecords(getDb(), programId, ownerId)!;
    const target = before[0];
    const res = await deleteDataAction({}, form({ recordId: target.id, ...base() }));
    expect(res.error).toBeUndefined();

    expect(listDataRecords(getDb(), programId, ownerId)).toHaveLength(0);
    expect(storagePathExists(target.storagePath!)).toBe(false);
    expect(() => absoluteStoragePath("../../etc/passwd")).toThrow();

    const events = listHistory(getDb(), programId, ownerId)!;
    expect(events.some((e) => e.eventType === "data_deleted")).toBe(true);
  });
});

describe("history attributes every step to the researcher who did it", () => {
  it("records each action with the acting researcher", () => {
    const events = listHistory(getDb(), programId, ownerId)!;
    const types = events.map((e) => e.eventType);

    for (const expected of [
      "program_created",
      "data_uploaded",
      "data_deleted",
      "activity_created",
      "activity_started",
      "activity_completed",
      "finding_created",
      "evidence_added",
      "report_generated",
      "report_finalized",
    ]) {
      expect(types, `history is missing ${expected}`).toContain(expected);
    }

    // Every entry names its actor. This is the basis for "who did what" once more than
    // one researcher can see a program.
    for (const e of events) {
      expect(e.actorId, `event ${e.eventType} has no actor`).toBe(ownerId);
    }
  });

  it("resolves each actor to a name, so the log reads as who did what", () => {
    const events = listHistory(getDb(), programId, ownerId)!;
    for (const e of events) {
      // Seeded fixtures and system writes have no actor; everything a researcher did does.
      expect(e.actorName, `event ${e.eventType} has no resolved actor`).toBe("Dr. Rosalind Franklin");
    }
  });
});

describe("a researcher who does not own the program is refused at every step", () => {
  beforeEach(() => {
    currentUserId = strangerId;
  });

  it("cannot read the data, activities, findings, or history", () => {
    expect(listDataRecords(getDb(), programId, strangerId)).toBeNull();
    expect(listActivities(getDb(), programId, strangerId)).toBeNull();
    expect(listFindings(getDb(), programId, strangerId)).toBeNull();
    expect(listHistory(getDb(), programId, strangerId)).toBeNull();
  });

  it("cannot upload, and nothing is written to disk", async () => {
    const res = await uploadDataAction(
      {},
      form({ ...base(), title: "Trespass", category: "clinical", file: sampleFile("panel_qc.tsv") }),
    );
    expect(res.error).toBe("Program not found.");
  });

  it("cannot start an activity", async () => {
    const res = await createActivityAction(
      {},
      form({ ...base(), title: "Trespass", activityType: "variant_analysis" }),
    );
    expect(res.error).toBe("Program not found.");
    expect(redirects).toHaveLength(0);
  });

  it("cannot conclude a finding or attach evidence to one", async () => {
    currentUserId = ownerId;
    await createFindingAction(
      {},
      form({
        ...base(),
        title: "Owner finding",
        description: "d",
        category: "molecular",
        significance: "low",
      }),
    );
    const findingId = listFindings(getDb(), programId, ownerId)![0].id;
    currentUserId = strangerId;

    const findingRes = await createFindingAction(
      {},
      form({ ...base(), title: "Trespass", description: "d", category: "molecular", significance: "low" }),
    );
    expect(findingRes.error).toBe("Program not found.");

    const evidenceRes = await addEvidenceAction(
      {},
      form({ ...base(), findingId, sourceType: "publication", title: "Trespass citation" }),
    );
    expect(evidenceRes.error).toBe("Finding not found.");
  });

  it("cannot generate or finalize a report", async () => {
    currentUserId = ownerId;
    const generated = await generateReportAction({}, form(base()));
    const reportId = generated.reportId!;
    currentUserId = strangerId;

    const res = await generateReportAction({}, form(base()));
    expect(res.error).toBe("Program not found.");

    const finalize = await finalizeReportAction({}, form({ reportId: reportId, programId, patientId }));
    // Opaque on purpose: it does not confirm the report exists.
    expect(finalize.error).toBe("Report not found.");
    expect(getReportAccessible(getDb(), reportId, strangerId)).toBeNull();
    expect(getReportAccessible(getDb(), reportId, ownerId)!.report.status).toBe("draft");
  });
});
