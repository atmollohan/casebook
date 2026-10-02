import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";

/**
 * Creating a case and its research program, end to end, through the real server action.
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
  findCaseById,
  getProgramForResearcher,
  listHistory,
  listProgramsForResearcher,
} from "@/lib/db/repo";
import type { User } from "@/lib/db/schema";
import {
  ATTRIBUTE_MAX_COUNT,
  ATTRIBUTE_VALUE_MAX,
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_TRANSITIONS,
  PROGRAM_INITIAL_STATUSES,
  PROGRAM_DEFAULT_STATUS,
  canTransitionProgram,
  type ProgramStatus,
} from "@/lib/constants";
import {
  createCaseAction,
  updateCaseAction,
  updateProgramStatusAction,
  type FormState,
} from "@/actions/case";
import { parseAttributes } from "@/lib/attributes";

/** Build FormData the way the browser would, so optional fields are genuinely absent. */
function form(fields: Record<string, string | undefined>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

/** One attribute row, in the `<field>__key_<n>` / `<field>__value_<n>` shape the form posts. */
function attributeRow(index: number, key?: string, value?: string) {
  return {
    [`attribute__key_${index}`]: key,
    [`attribute__value_${index}`]: value,
  };
}

/** The only required inputs, plus the two selects the page always submits. */
function minimalForm(overrides: Record<string, string | undefined> = {}) {
  return form({
    title: "Test subject",
    kind: "subject",
    programTitle: "TP53 disruption in treatment-refractory CLL",
    ...overrides,
  });
}

/** The researcher's own dashboard list, as the page reads it. */
function ownedPrograms(userId: string) {
  return listProgramsForResearcher(getDb(), userId);
}

const fullForm = {
  title: "Test subject",
  subtitle: "treatment-refractory CLL",
  kind: "subject",
  summary: "Refractory CLL; TP53 disruption research focus",
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

/** Run the action and return the case id it redirected to, or the state it returned. */
async function create(formData: FormData) {
  const before = redirects.length;
  const state = (await createCaseAction({} as FormState, formData).catch((e: Error) =>
    /NEXT_REDIRECT/.test(e.message) ? null : Promise.reject(e),
  )) as FormState | null;
  // The redirect this call produced, not one left over from an earlier call in the same test.
  const to = redirects[before];
  return { state, caseId: to ? to.match(/^\/cases\/([^/?]+)/)?.[1] : undefined };
}

describe("creating a case", () => {
  it("creates the case and program and opens the new workspace", async () => {
    const { state, caseId } = await create(form(fullForm));

    expect(state).toBeNull(); // ended in a redirect, not a returned error
    expect(caseId).toMatch(/^cas_/);
    expect(redirects[0]).toBe(`/cases/${caseId}?tab=overview&created=1`);
  });

  it("persists what the form collected, on both the case and the program", async () => {
    const { caseId } = await create(form(fullForm));

    const found = findCaseById(getDb(), caseId!, owner.id);
    expect(found).not.toBeNull();
    expect(found!.case).toMatchObject({
      title: "Test subject",
      subtitle: "treatment-refractory CLL",
      kind: "subject",
      summary: "Refractory CLL; TP53 disruption research focus",
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

  it("gives the case a unique human-readable code", async () => {
    const first = await create(form(fullForm));
    const second = await create(form(fullForm));

    const codes = [first.caseId!, second.caseId!].map((id) => findCaseById(getDb(), id, owner.id)!.case.code);
    expect(new Set(codes).size).toBe(2);
    for (const code of codes) expect(code).toMatch(/^CB-C-\d{4}$/);
  });

  it("records who created the case", async () => {
    const { caseId } = await create(form(fullForm));
    const { program } = findCaseById(getDb(), caseId!, owner.id)!;

    const events = listHistory(getDb(), program.id, owner.id);
    expect(events!.map((e) => e.eventType)).toContain("program_created");
    const created = events!.find((e) => e.eventType === "program_created")!;
    expect(created.actorId).toBe(owner.id);
    expect(created.actorName).toBe("Owner One");
  });

  it("shows the new case in the researcher's own list", async () => {
    const before = ownedPrograms(owner.id).length;
    const { caseId } = await create(form(fullForm));
    const after = ownedPrograms(owner.id);

    expect(after).toHaveLength(before + 1);
    expect(after.map((p) => p.case.id)).toContain(caseId);
  });

  it("stays invisible to a researcher who does not own it", async () => {
    const { caseId } = await create(form(fullForm));

    expect(findCaseById(getDb(), caseId!, stranger.id)).toBeNull();
    expect(ownedPrograms(stranger.id).map((p) => p.case.id)).not.toContain(caseId);
  });
});

describe("case kinds", () => {
  it("defaults to subject when the select is not touched", async () => {
    const { caseId } = await create(form({ ...fullForm, kind: undefined }));

    expect(findCaseById(getDb(), caseId!, owner.id)!.case.kind).toBe("subject");
  });

  // A `subject` is one kind among several, not the shape the app assumes. A case with no
  // person in it has to be a first-class thing, or the model is not actually general.
  it.each(["material", "sample", "dataset", "device"])("accepts a %s case", async (kind) => {
    const { caseId } = await create(form({ ...fullForm, kind }));

    expect(findCaseById(getDb(), caseId!, owner.id)!.case.kind).toBe(kind);
  });

  it("refuses a kind that is not one of them", async () => {
    const { state, caseId } = await create(form({ ...fullForm, kind: "patient" }));

    expect(caseId).toBeUndefined();
    expect(state?.fieldErrors?.kind).toBeDefined();
  });
});

describe("attributes", () => {
  it("stores the rows the form posted", async () => {
    const { caseId } = await create(
      form({
        ...fullForm,
        ...attributeRow(0, "Birth year", "1985"),
        ...attributeRow(1, "Specimen", "Peripheral blood"),
      }),
    );

    const found = findCaseById(getDb(), caseId!, owner.id)!;
    expect(parseAttributes(found.case.attributes)).toEqual({
      "Birth year": "1985",
      Specimen: "Peripheral blood",
    });
  });

  it("ignores a row with neither a name nor a value, and a name with no value", async () => {
    const { state, caseId } = await create(
      form({
        ...fullForm,
        ...attributeRow(0, "  ", "  "),
        ...attributeRow(1, "Specimen", ""),
        ...attributeRow(2, "Site", "North"),
      }),
    );

    expect(state).toBeNull();
    expect(parseAttributes(findCaseById(getDb(), caseId!, owner.id)!.case.attributes)).toEqual({
      Site: "North",
    });
  });

  it("refuses a value with no name rather than storing a nameless fact", async () => {
    const { state, caseId } = await create(form({ ...fullForm, ...attributeRow(0, "", "1985") }));

    expect(caseId).toBeUndefined();
    expect(state?.error).toMatch(/name/i);
  });

  it("refuses a submission past the documented bounds, rather than truncating it", async () => {
    // Silently dropping attributes would be the worse failure: the investigator would believe
    // a fact was recorded when it was not.
    const tooLong = form({
      ...fullForm,
      ...attributeRow(0, "Notes", "x".repeat(ATTRIBUTE_VALUE_MAX + 1)),
    });
    expect((await create(tooLong)).state?.error).toBeDefined();

    const tooMany = form({
      ...fullForm,
      ...Object.fromEntries(
        Array.from({ length: ATTRIBUTE_MAX_COUNT + 1 }, (_, i) =>
          Object.entries(attributeRow(i, `Field ${i}`, "value")),
        ).flat(),
      ),
    });
    expect((await create(tooMany)).state?.error).toBeDefined();
  });
});

describe("optional fields on the create form", () => {
  // Regression: optional input used to be preprocessed with `v === "" ? undefined : Number(v)`,
  // so a blank field became undefined, then Number(undefined) === NaN, and Zod rejected the
  // submission. Optional fields are not required, so every user who skipped one could not
  // create a case at all. They are first-class cases here rather than an afterthought.
  it("accepts a submission with every optional field blank", async () => {
    const { state, caseId } = await create(minimalForm());

    expect(state).toBeNull();
    expect(caseId).toMatch(/^cas_/);
    const found = findCaseById(getDb(), caseId!, owner.id)!;
    // Blank optional input is stored as "not recorded", not as an empty string.
    expect(found.case.subtitle).toBeNull();
    expect(found.case.summary).toBeNull();
    expect(found.case.attributes).toBeNull();
    expect(found.program.focusArea).toBeNull();
    expect(found.program.hypothesis).toBeNull();
  });

  it.each([
    ["an empty string", ""],
    ["whitespace", "   "],
  ])("treats a title of %s as not submitted, and says so", async (_label, title) => {
    const { state, caseId } = await create(minimalForm({ title }));

    expect(caseId).toBeUndefined();
    expect(state?.fieldErrors?.title).toBeDefined();
  });
});

describe("case codes once a case has been removed", () => {
  // Retention and deletion are Phase 8, but creating a case has to survive them arriving: the
  // code used to be derived from the row count, so after any deletion the next create was
  // handed a code that was already taken and died on the unique index. It is now derived from
  // the highest code in use.
  //
  // What this does NOT yet guarantee is that a removed case's code is never issued again. That
  // needs a high-water-mark counter that outlives the row, and it has to land with the deletion
  // work in Phase 8 — recorded in ASSUMPTIONS rather than half-solved here.
  it("still creates a case after one in the middle is removed", async () => {
    const created: string[] = [];
    for (let i = 0; i < 3; i++) {
      created.push((await create(form(fullForm))).caseId!);
    }
    const middle = created[1];
    getClient(getDb()).prepare("delete from research_programs where case_id = ?").run(middle);
    getClient(getDb()).prepare("delete from cases where id = ?").run(middle);

    const next = await create(form(fullForm));

    expect(next.caseId).toMatch(/^cas_/);
    const taken = ownedPrograms(owner.id).map((p) => p.case.code);
    expect(taken).toContain(findCaseById(getDb(), next.caseId!, owner.id)!.case.code);
  });

  it("keeps issuing codes in ascending order", async () => {
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { caseId } = await create(form(fullForm));
      const code = findCaseById(getDb(), caseId!, owner.id)!.case.code;
      seen.push(Number(code.replace(/\D/g, "")));
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(3);
  });
});

describe("editing a case", () => {
  async function ownedCase() {
    const { caseId } = await create(
      form({ ...fullForm, ...attributeRow(0, "Specimen", "Peripheral blood") }),
    );
    return findCaseById(getDb(), caseId!, owner.id)!;
  }

  it("changes the case fields the investigator edited", async () => {
    const { program } = await ownedCase();

    const result = await updateCaseAction(
      {},
      form({
        programId: program.id,
        title: "Renamed subject",
        subtitle: "new subtitle",
        kind: "sample",
        summary: "new summary",
        ...attributeRow(0, "Specimen", "Bone marrow"),
        ...attributeRow(1, "Site", "North"),
      }),
    );

    expect(result.error).toBeUndefined();
    const after = findCaseById(getDb(), program.caseId, owner.id)!;
    expect(after.case).toMatchObject({
      title: "Renamed subject",
      subtitle: "new subtitle",
      kind: "sample",
      summary: "new summary",
    });
    expect(parseAttributes(after.case.attributes)).toEqual({
      Specimen: "Bone marrow",
      Site: "North",
    });
  });

  it("clears the summary when the field is emptied", async () => {
    const { program } = await ownedCase();

    await updateCaseAction(
      {},
      form({ programId: program.id, title: "Test subject", kind: "subject", summary: "" }),
    );

    expect(findCaseById(getDb(), program.caseId, owner.id)!.case.summary).toBeNull();
  });

  it("records the edit in history", async () => {
    const { program } = await ownedCase();

    await updateCaseAction({}, form({ programId: program.id, title: "Renamed subject", kind: "subject" }));

    const events = listHistory(getDb(), program.id, owner.id)!;
    expect(events.map((e) => e.eventType)).toContain("case_updated");
  });

  it("refuses a kind that is not one of them", async () => {
    const { program } = await ownedCase();

    const result = await updateCaseAction(
      {},
      form({ programId: program.id, title: "Test subject", kind: "patient" }),
    );

    expect(result.fieldErrors?.kind).toBeDefined();
    expect(findCaseById(getDb(), program.caseId, owner.id)!.case.title).toBe("Test subject");
  });

  it("will not edit a case belonging to someone else", async () => {
    const { program } = await ownedCase();
    currentUserId = stranger.id;

    const result = await updateCaseAction(
      {},
      form({ programId: program.id, title: "Hijacked", kind: "subject" }),
    );

    expect(result.error).toMatch(/not found/i);
    expect(findCaseById(getDb(), program.caseId, owner.id)!.case.title).toBe("Test subject");
  });
});

describe("the status a program is created in", () => {
  // A new case is scoped before it is started, so creation defaults to planned and the first
  // real step is "Start program" on the Overview tab. `planned` is only reachable here —
  // no transition leads into it — so if this regressed the status would be dead.
  it("starts planned when the form does not say otherwise", async () => {
    const { caseId } = await create(minimalForm());

    expect(findCaseById(getDb(), caseId!, owner.id)!.program.status).toBe("planned");
  });

  it("can be created already active, for work starting now", async () => {
    const { caseId } = await create(minimalForm({ status: "active" }));

    expect(findCaseById(getDb(), caseId!, owner.id)!.program.status).toBe("active");
  });

  it("refuses to be born into a status that implies work already happened", async () => {
    for (const status of ["paused", "closing", "closed"]) {
      const { state, caseId } = await create(minimalForm({ status }));
      expect(caseId, `created a ${status} program`).toBeUndefined();
      expect(state?.fieldErrors?.status, `no message for ${status}`).toBeDefined();
    }
  });

  it("refuses a starting status that is not a status", async () => {
    for (const status of ["archived", "PLANNED", "1"]) {
      const { state, caseId } = await create(minimalForm({ status }));
      expect(caseId, `accepted ${JSON.stringify(status)}`).toBeUndefined();
      expect(state?.fieldErrors?.status).toBeDefined();
    }
  });

  it("falls back to the default when the field is submitted blank", async () => {
    // A select that was never touched still submits something, and an empty value means
    // "not specified" rather than "invalid" — the same as the other optional fields.
    const { state, caseId } = await create(minimalForm({ status: "" }));

    expect(state).toBeNull();
    expect(findCaseById(getDb(), caseId!, owner.id)!.program.status).toBe(PROGRAM_DEFAULT_STATUS);
  });

  it("only offers statuses that are a legal way to begin", () => {
    expect([...PROGRAM_INITIAL_STATUSES].sort()).toEqual(["active", "planned"]);
    for (const s of PROGRAM_INITIAL_STATUSES) expect(PROGRAM_STATUSES).toContain(s);
    expect(PROGRAM_DEFAULT_STATUS).toBe("planned");
  });

  it("records the new program in history with the status it was created in", async () => {
    const { caseId } = await create(minimalForm({ status: "active" }));
    const { program } = findCaseById(getDb(), caseId!, owner.id)!;

    const created = listHistory(getDb(), program.id, owner.id)!.find(
      (e) => e.eventType === "program_created",
    )!;
    expect(created.summary).toContain(program.title);
  });
});

describe("required fields on the create form", () => {
  it.each([
    ["title", { title: undefined }],
    ["programTitle", { programTitle: undefined }],
  ])("refuses to create a case without %s", async (field, overrides) => {
    const { state, caseId } = await create(minimalForm(overrides));

    expect(caseId).toBeUndefined();
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

    await expect(createCaseAction({} as FormState, form(fullForm))).rejects.toThrow("NEXT_REDIRECT");

    expect(ownedPrograms(owner.id)).toHaveLength(before);
  });

  it("does not let a signed-in researcher attach a program to someone else's case", async () => {
    const { caseId } = await create(form(fullForm));
    currentUserId = stranger.id;

    // Ownership is decided by the session, not by anything the form supplies, so a
    // stranger asking for a program id cannot reach an existing case.
    expect(
      getProgramForResearcher(getDb(), findCaseById(getDb(), caseId!, owner.id)!.program.id, stranger.id),
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
    const { caseId } = await create(form(fullForm));
    const { program } = findCaseById(getDb(), caseId!, owner.id)!;
    // Arranging the starting state is fixture setup, so it goes in directly rather than
    // through a chain of moves the test is not about.
    getClient(getDb())
      .prepare("update research_programs set status = ? where id = ?")
      .run(status, program.id);
    return { caseId: caseId!, programId: program.id, program };
  }

  async function move(programId: string, status: string, caseId?: string) {
    return updateProgramStatusAction({}, form({ programId, caseId, status }));
  }

  function statusOf(programId: string) {
    return getProgramForResearcher(getDb(), programId, owner.id)!.program.status;
  }

  function statusEvents(programId: string) {
    return listHistory(getDb(), programId, owner.id)!.filter((e) => e.eventType === "program_status");
  }

  it("starts a planned program", async () => {
    const { programId, caseId } = await programInStatus("planned");

    const result = await move(programId, "active", caseId);

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
    const { programId, caseId } = await programInStatus("active");

    for (const step of ["paused", "active", "closing", "closed"] as ProgramStatus[]) {
      const result = await move(programId, step, caseId);
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
    const { caseId } = await create(form(fullForm));
    return findCaseById(getDb(), caseId!, owner.id)!.program;
  }

  it("is refused, and the program is left where it was", async () => {
    const program = await ownersProgram();
    currentUserId = stranger.id;

    // A move the owner could make, so the refusal can only be about who is asking.
    const result = await updateProgramStatusAction(
      {},
      form({ programId: program.id, caseId: program.caseId, status: "active" }),
    );

    expect(result.error).toMatch(/not found/i);
    expect(findCaseById(getDb(), program.caseId, owner.id)!.program.status).toBe("planned");
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

    expect(findCaseById(getDb(), program.caseId, owner.id)!.program.status).toBe("planned");
  });
});
