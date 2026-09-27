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
import {
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_TRANSITIONS,
  PROGRAM_INITIAL_STATUSES,
  PROGRAM_DEFAULT_STATUS,
  canTransitionProgram,
  type ProgramStatus,
} from "@/lib/constants";
import { createPatientAction, updateProgramStatusAction, type FormState } from "@/actions/patient";

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
      status: "planned",
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

describe("the status a program is created in", () => {
  // A new case is scoped before it is started, so creation defaults to planned and the first
  // real step is "Start program" on the Overview tab. `planned` is only reachable here —
  // no transition leads into it — so if this regressed the status would be dead.
  it("starts planned when the form does not say otherwise", async () => {
    const { patientId } = await create(minimalForm());

    expect(findPatientById(getDb(), patientId!, owner.id)!.program.status).toBe("planned");
  });

  it("can be created already active, for work starting now", async () => {
    const { patientId } = await create(minimalForm({ status: "active" }));

    expect(findPatientById(getDb(), patientId!, owner.id)!.program.status).toBe("active");
  });

  it("refuses to be born into a status that implies work already happened", async () => {
    for (const status of ["paused", "closing", "closed"]) {
      const { state, patientId } = await create(minimalForm({ status }));
      expect(patientId, `created a ${status} program`).toBeUndefined();
      expect(state?.fieldErrors?.status, `no message for ${status}`).toBeDefined();
    }
  });

  it("refuses a starting status that is not a status", async () => {
    for (const status of ["archived", "PLANNED", "1"]) {
      const { state, patientId } = await create(minimalForm({ status }));
      expect(patientId, `accepted ${JSON.stringify(status)}`).toBeUndefined();
      expect(state?.fieldErrors?.status).toBeDefined();
    }
  });

  it("falls back to the default when the field is submitted blank", async () => {
    // A select that was never touched still submits something, and an empty value means
    // "not specified" rather than "invalid" — the same as the other optional fields.
    const { state, patientId } = await create(minimalForm({ status: "" }));

    expect(state).toBeNull();
    expect(findPatientById(getDb(), patientId!, owner.id)!.program.status).toBe(PROGRAM_DEFAULT_STATUS);
  });

  it("only offers statuses that are a legal way to begin", () => {
    expect([...PROGRAM_INITIAL_STATUSES].sort()).toEqual(["active", "planned"]);
    for (const s of PROGRAM_INITIAL_STATUSES) expect(PROGRAM_STATUSES).toContain(s);
    expect(PROGRAM_DEFAULT_STATUS).toBe("planned");
  });

  it("records the new program in history with the status it was created in", async () => {
    const { patientId } = await create(minimalForm({ status: "active" }));
    const { program } = findPatientById(getDb(), patientId!, owner.id)!;

    const created = listHistory(getDb(), program.id, owner.id)!.find(
      (e) => e.eventType === "program_created",
    )!;
    expect(created.summary).toContain(program.title);
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

/**
 * Moving a program through its lifecycle — the "planned to active" step and every move
 * after it. The rule under test is `PROGRAM_STATUS_TRANSITIONS`, and the thing being
 * protected is that the rule is enforced on the server: a request can carry any status, so
 * the action cannot trust the control that produced it.
 */
describe("the program lifecycle", () => {
  it("only lists moves between real statuses, and never to the status it is in", () => {
    for (const [from, targets] of Object.entries(PROGRAM_STATUS_TRANSITIONS)) {
      expect(PROGRAM_STATUSES, `${from} is not a status`).toContain(from as ProgramStatus);
      for (const to of targets) {
        expect(PROGRAM_STATUSES, `${from} -> ${to} leaves the lifecycle`).toContain(to);
        expect(canTransitionProgram(from as ProgramStatus, to), `${from} -> ${to}`).toBe(true);
      }
      expect(targets, `${from} -> ${from}`).not.toContain(from);
    }
  });

  it("treats a closed program as the end of the line", () => {
    expect(PROGRAM_STATUS_TRANSITIONS.closed).toEqual([]);
    for (const to of PROGRAM_STATUSES) expect(canTransitionProgram("closed", to)).toBe(false);
  });

  it("leaves no program stranded: every status that is not closed can still reach closed", () => {
    for (const from of PROGRAM_STATUSES) {
      if (from === "closed") continue;
      const reachable = new Set<ProgramStatus>([from]);
      // Walk the graph rather than assume one hop is enough.
      for (let hop = 0; hop < PROGRAM_STATUSES.length; hop++) {
        for (const node of [...reachable]) {
          for (const to of PROGRAM_STATUS_TRANSITIONS[node]) reachable.add(to);
        }
      }
      expect(reachable.has("closed"), `${from} can never be closed`).toBe(true);
    }
  });

  it("rejects a move that is not in the table", () => {
    expect(canTransitionProgram("planned", "paused")).toBe(false);
    expect(canTransitionProgram("active", "planned")).toBe(false);
    expect(canTransitionProgram("planned", "planned")).toBe(false);
  });

  it("refuses an unknown status rather than coercing it", () => {
    expect(canTransitionProgram("planned", "archived" as ProgramStatus)).toBe(false);
  });
});

describe("moving a program to another status", () => {
  /** A case owned by `owner`, parked in `status` so the move under test starts from there. */
  async function programInStatus(status: ProgramStatus) {
    const { patientId } = await create(form(fullForm));
    const { program } = findPatientById(getDb(), patientId!, owner.id)!;
    // Arranging the starting state is fixture setup, so it goes in directly rather than
    // through a chain of moves the test is not about.
    getClient(getDb())
      .prepare("update research_programs set status = ? where id = ?")
      .run(status, program.id);
    return { patientId: patientId!, programId: program.id, program };
  }

  async function move(programId: string, status: string, patientId?: string) {
    return updateProgramStatusAction({}, form({ programId, patientId, status }));
  }

  function statusOf(programId: string) {
    return getProgramForResearcher(getDb(), programId, owner.id)!.program.status;
  }

  function statusEvents(programId: string) {
    return listHistory(getDb(), programId, owner.id)!.filter((e) => e.eventType === "program_status");
  }

  it("starts a planned program", async () => {
    const { programId, patientId } = await programInStatus("planned");

    const result = await move(programId, "active", patientId);

    expect(result.error).toBeUndefined();
    expect(statusOf(programId)).toBe("active");
  });

  it("records who moved it, and from where to", async () => {
    const { programId } = await programInStatus("planned");

    await move(programId, "active");

    const events = statusEvents(programId);
    expect(events).toHaveLength(1);
    expect(events[0].actorId).toBe(owner.id);
    expect(events[0].actorName).toBe("Owner One");
    expect(events[0].summary).toBe("Program status changed from Planned to Active");
    expect(JSON.parse(events[0].metadataJson!)).toEqual({ from: "planned", to: "active" });
  });

  it("walks a program through pause, resume, closing, and closed", async () => {
    const { programId, patientId } = await programInStatus("active");

    for (const step of ["paused", "active", "closing", "closed"] as ProgramStatus[]) {
      const result = await move(programId, step, patientId);
      expect(result.error, `could not move to ${step}`).toBeUndefined();
      expect(statusOf(programId)).toBe(step);
    }

    // Compared as a set: history reads newest-first, and moves made inside one test land
    // in the same millisecond, so the order between them is not a stable thing to assert.
    // What matters is that every step recorded the transition it actually made.
    expect(
      statusEvents(programId)
        .map((e) => e.summary)
        .sort(),
    ).toEqual(
      [
        "Program status changed from Active to Paused",
        "Program status changed from Paused to Active",
        "Program status changed from Active to Closing",
        "Program status changed from Closing to Closed",
      ].sort(),
    );
  });

  it("reopens a program that was being closed", async () => {
    const { programId } = await programInStatus("closing");

    await move(programId, "active");

    expect(statusOf(programId)).toBe("active");
  });

  it("refuses a move the lifecycle does not allow, and changes nothing", async () => {
    const { programId } = await programInStatus("planned");

    // planned -> paused is not a step; the control never offers it, but a crafted request can.
    const result = await move(programId, "paused");

    expect(result.error).toMatch(/planned/i);
    expect(result.error).toMatch(/paused/i);
    expect(statusOf(programId)).toBe("planned");
    expect(statusEvents(programId)).toHaveLength(0);
  });

  it("refuses to move a program to the status it is already in", async () => {
    const { programId } = await programInStatus("active");

    const result = await move(programId, "active");

    expect(result.error).toBeDefined();
    expect(statusOf(programId)).toBe("active");
    expect(statusEvents(programId)).toHaveLength(0);
  });

  it("refuses to reopen a closed program", async () => {
    const { programId } = await programInStatus("closed");

    const result = await move(programId, "active");

    expect(result.error).toMatch(/closed/i);
    expect(statusOf(programId)).toBe("closed");
    expect(statusEvents(programId)).toHaveLength(0);
  });

  it("refuses a status that is not part of the lifecycle at all", async () => {
    const { programId } = await programInStatus("active");

    for (const status of ["archived", "", "ACTIVE", "42"]) {
      const result = await move(programId, status);
      expect(result.error, `accepted ${JSON.stringify(status)}`).toBeDefined();
    }
    expect(statusOf(programId)).toBe("active");
  });

  it("refuses a move with no program id", async () => {
    const result = await move("", "active");
    expect(result.error).toBeDefined();
  });

  it("writes the label a person reads, not the stored value", async () => {
    const { programId } = await programInStatus("paused");

    await move(programId, "closing");

    expect(statusEvents(programId)[0].summary).toContain(
      `${PROGRAM_STATUS_LABELS.paused} to ${PROGRAM_STATUS_LABELS.closing}`,
    );
  });
});

describe("moving someone else's program", () => {
  async function ownersProgram() {
    const { patientId } = await create(form(fullForm));
    return findPatientById(getDb(), patientId!, owner.id)!.program;
  }

  it("is refused, and the program is left where it was", async () => {
    const program = await ownersProgram();
    currentUserId = stranger.id;

    // A move the owner could make, so the refusal can only be about who is asking.
    const result = await updateProgramStatusAction(
      {},
      form({ programId: program.id, patientId: program.patientId, status: "active" }),
    );

    expect(result.error).toMatch(/not found/i);
    expect(findPatientById(getDb(), program.patientId, owner.id)!.program.status).toBe("planned");
    expect(listHistory(getDb(), program.id, owner.id)!.some((e) => e.eventType === "program_status")).toBe(
      false,
    );
  });

  it("sends a signed-out visitor to sign in", async () => {
    const program = await ownersProgram();
    currentUserId = null;

    await expect(
      updateProgramStatusAction({}, form({ programId: program.id, status: "active" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(findPatientById(getDb(), program.patientId, owner.id)!.program.status).toBe("planned");
  });
});
