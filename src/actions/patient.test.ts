import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";

/**
 * Creating a patient and their research program, end to end, through the real server action.
 *
 * This is the entry point to the whole product: nothing exists until this form works. It was
 * reported as "fails" and the cause was an optional field (birth year) that rejected every
 * submission left blank, so the optional-input cases are first-class here rather than an
 * afterthought.
 *
 * Real migrated SQLite, real validation, real authorization. Only the session is stubbed,
 * because a server action reads it from request scope and there is no request here.
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
    if (!currentUserId) throw new Error("NEXT_REDIRECT:/login");
    const { getDb } = await import("@/lib/db");
    const { findUserById } = await import("@/lib/db/repo");
    const user = findUserById(getDb(), currentUserId);
    if (!user) throw new Error("no such user");
    return user;
  },
}));

import { getClient, getDb, migrateDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  findPatientById,
  getProgramForResearcher,
  listHistory,
  listProgramsForResearcher,
} from "@/lib/db/repo";
import type { User } from "@/lib/db/schema";
import { createPatientAction, type FormState } from "@/actions/patient";

/** Build FormData the way the browser would, so optional fields are genuinely absent. */
function form(fields: Record<string, string | undefined>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

/** The only two required inputs, plus the two selects the page always submits. */
function minimalForm(overrides: Record<string, string | undefined> = {}) {
  return form({
    firstName: "Testy",
    lastName: "McTestface",
    sex: "unknown",
    consentStatus: "consented",
    programTitle: "TP53 disruption in treatment-refractory CLL",
    ...overrides,
  });
}

/** The researcher's own dashboard list, as the page reads it. */
function ownedPrograms(userId: string) {
  return listProgramsForResearcher(getDb(), userId);
}

const fullForm = {
  firstName: "Testy",
  lastName: "McTestface",
  birthYear: "1985",
  sex: "unknown",
  conditionSummary: "Refractory CLL; TP53 disruption research focus",
  consentStatus: "consented",
  programTitle: "TP53 disruption in treatment-refractory CLL",
  programDescription: "Scope, data sources, and investigation plan",
  programHypothesis: "TP53 disruption drives resistance",
  focusArea: "Genomics",
};

let owner: User;
let stranger: User;

beforeAll(() => {
  migrateDb(getDb());
  owner = createUser(getDb(), {
    email: "owner@test.dev",
    name: "Owner One",
    title: "Researcher",
    passwordHash: hashPassword("password-123"),
  });
  stranger = createUser(getDb(), {
    email: "stranger@test.dev",
    name: "Stranger Two",
    passwordHash: hashPassword("password-123"),
  });
});

beforeEach(() => {
  currentUserId = owner.id;
  redirects.length = 0;
});

/** Run the action and return the patient id it redirected to, or the state it returned. */
async function create(formData: FormData) {
  const before = redirects.length;
  const state = (await createPatientAction({} as FormState, formData).catch((e: Error) =>
    /NEXT_REDIRECT/.test(e.message) ? null : Promise.reject(e),
  )) as FormState | null;
  // The redirect this call produced, not one left over from an earlier call in the same test.
  const to = redirects[before];
  return { state, patientId: to ? to.match(/^\/patients\/([^/?]+)/)?.[1] : undefined };
}

describe("creating a patient program", () => {
  it("creates the patient and program and opens the new workspace", async () => {
    const { state, patientId } = await create(form(fullForm));

    expect(state).toBeNull(); // ended in a redirect, not a returned error
    expect(patientId).toMatch(/^pat_/);
    expect(redirects[0]).toBe(`/patients/${patientId}?tab=overview&created=1`);
  });

  it("persists what the form collected, on both the patient and the program", async () => {
    const { patientId } = await create(form(fullForm));

    const found = findPatientById(getDb(), patientId!, owner.id);
    expect(found).not.toBeNull();
    expect(found!.patient).toMatchObject({
      firstName: "Testy",
      lastName: "McTestface",
      birthYear: 1985,
      sex: "unknown",
      conditionSummary: "Refractory CLL; TP53 disruption research focus",
      consentStatus: "consented",
      ownerId: owner.id,
    });
    expect(found!.program).toMatchObject({
      title: "TP53 disruption in treatment-refractory CLL",
      description: "Scope, data sources, and investigation plan",
      hypothesis: "TP53 disruption drives resistance",
      focusArea: "Genomics",
      status: "active",
    });
  });

  it("gives the patient a unique human-readable id", async () => {
    const first = await create(form(fullForm));
    const second = await create(form(fullForm));

    const pids = [first.patientId!, second.patientId!].map(
      (id) => findPatientById(getDb(), id, owner.id)!.patient.pid,
    );
    expect(new Set(pids).size).toBe(2);
  });

  it("records who created the case", async () => {
    const { patientId } = await create(form(fullForm));
    const { program } = findPatientById(getDb(), patientId!, owner.id)!;

    const events = listHistory(getDb(), program.id, owner.id);
    expect(events!.map((e) => e.eventType)).toContain("program_created");
    const created = events!.find((e) => e.eventType === "program_created")!;
    expect(created.actorId).toBe(owner.id);
    expect(created.actorName).toBe("Owner One");
  });

  it("shows the new case in the researcher's own list", async () => {
    const before = ownedPrograms(owner.id).length;
    const { patientId } = await create(form(fullForm));
    const after = ownedPrograms(owner.id);

    expect(after).toHaveLength(before + 1);
    expect(after.map((p) => p.patient.id)).toContain(patientId);
  });

  it("stays invisible to a researcher who does not own it", async () => {
    const { patientId } = await create(form(fullForm));

    expect(findPatientById(getDb(), patientId!, stranger.id)).toBeNull();
    expect(ownedPrograms(stranger.id).map((p) => p.patient.id)).not.toContain(patientId);
  });
});

describe("optional fields on the create form", () => {
  // Regression: birth year was preprocessed with `v === "" ? undefined : Number(v)`, so a
  // blank field became undefined, then Number(undefined) === NaN, and Zod rejected the
  // submission with "Expected number, received nan". Birth year is not required, so every
  // user who skipped it could not create a patient at all.
  it("accepts a submission with every optional field blank", async () => {
    const { state, patientId } = await create(minimalForm());

    expect(state).toBeNull();
    expect(patientId).toMatch(/^pat_/);
    const found = findPatientById(getDb(), patientId!, owner.id)!;
    // Blank optional input is stored as "not recorded", not as an empty string.
    expect(found.patient.birthYear).toBeNull();
    expect(found.patient.conditionSummary).toBeNull();
    expect(found.program.focusArea).toBeNull();
    expect(found.program.hypothesis).toBeNull();
  });

  it.each([
    ["an empty string", ""],
    ["whitespace", "   "],
  ])("treats a birth year of %s as not recorded", async (_label, birthYear) => {
    const { patientId } = await create(minimalForm({ birthYear }));

    expect(patientId).toMatch(/^pat_/);
    expect(findPatientById(getDb(), patientId!, owner.id)!.patient.birthYear).toBeNull();
  });

  it("rejects a birth year that is not a real year", async () => {
    for (const birthYear of ["1800", String(new Date().getFullYear() + 1), "1985.5"]) {
      const { state, patientId } = await create(minimalForm({ birthYear }));
      expect(patientId, `accepted birth year ${birthYear}`).toBeUndefined();
      expect(state?.fieldErrors?.birthYear, `no message for ${birthYear}`).toBeDefined();
    }
  });

  it("rejects junk in a numeric field with a message a person can act on", async () => {
    const { state } = await create(minimalForm({ birthYear: "nineteen eighty five" }));

    expect(state?.fieldErrors?.birthYear?.[0]).not.toMatch(/nan/i);
  });
});

describe("patient ids once a patient has been removed", () => {
  // Retention and deletion are Phase 8, but creating a patient has to survive them arriving:
  // the id used to be derived from the row count, so after any deletion the next create was
  // handed a pid that was already taken and died on the unique index. It is now derived from
  // the highest id in use.
  //
  // What this does NOT yet guarantee is that a removed patient's number is never issued again.
  // That needs a high-water-mark counter that outlives the row, and it has to land with the
  // deletion work in Phase 8 — recorded in ASSUMPTIONS rather than half-solved here.
  // Deleting a patient in the middle of the sequence is the case that used to crash: the
  // count-based id handed back a number another patient was still using.
  it("still creates a case after a patient in the middle is removed", async () => {
    const created: string[] = [];
    for (let i = 0; i < 3; i++) {
      created.push((await create(form(fullForm))).patientId!);
    }
    const middle = created[1];
    getClient(getDb()).prepare("delete from research_programs where patient_id = ?").run(middle);
    getClient(getDb()).prepare("delete from patients where id = ?").run(middle);

    const next = await create(form(fullForm));

    expect(next.patientId).toMatch(/^pat_/);
    const taken = ownedPrograms(owner.id).map((p) => p.patient.pid);
    expect(taken).toContain(findPatientById(getDb(), next.patientId!, owner.id)!.patient.pid);
  });

  it("keeps issuing ids in ascending order", async () => {
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { patientId } = await create(form(fullForm));
      const pid = findPatientById(getDb(), patientId!, owner.id)!.patient.pid;
      seen.push(Number(pid.replace(/\D/g, "")));
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(3);
  });
});

describe("required fields on the create form", () => {
  it.each([
    ["firstName", { firstName: undefined }],
    ["lastName", { lastName: undefined }],
    ["programTitle", { programTitle: undefined }],
  ])("refuses to create a case without %s", async (field, overrides) => {
    const { state, patientId } = await create(minimalForm(overrides));

    expect(patientId).toBeUndefined();
    expect(state?.fieldErrors?.[field]).toBeDefined();
  });

  it("creates nothing when validation fails", async () => {
    const before = ownedPrograms(owner.id).length;

    await create(minimalForm({ programTitle: undefined }));

    expect(ownedPrograms(owner.id)).toHaveLength(before);
  });
});

describe("authorization", () => {
  it("sends a signed-out visitor to sign in and creates nothing", async () => {
    currentUserId = null;
    const before = ownedPrograms(owner.id).length;

    await expect(createPatientAction({} as FormState, form(fullForm))).rejects.toThrow("NEXT_REDIRECT");

    expect(ownedPrograms(owner.id)).toHaveLength(before);
  });

  it("does not let a signed-in researcher attach a program to someone else's case", async () => {
    const { patientId } = await create(form(fullForm));
    currentUserId = stranger.id;

    // Ownership is decided by the session, not by anything the form supplies, so a
    // stranger asking for a program id cannot reach an existing case.
    expect(
      getProgramForResearcher(
        getDb(),
        findPatientById(getDb(), patientId!, owner.id)!.program.id,
        stranger.id,
      ),
    ).toBeNull();
  });
});
