"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, migrateDb, resetDb } from "@/lib/db";
import {
  createCaseAndProgram,
  updateCase,
  updateProgram,
  getProgramForResearcher,
  setProgramStatus,
} from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import {
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_INITIAL_STATUSES,
  PROGRAM_DEFAULT_STATUS,
  CASE_KINDS,
  canTransitionProgram,
  type ProgramStatus,
} from "@/lib/constants";
import { normalizeAttributeRows } from "@/lib/attributes";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * The create form posts one `<name>__key` / `<name>__value` pair per attribute row, because a
 * form cannot post a nested object. Rows with an empty name and an empty value are dropped by
 * `normalizeAttributeRows`; a name with no value is dropped, since an attribute with no content
 * is not a fact.
 */
function readAttributeRows(formData: FormData, field: string) {
  const rows: { key?: string; value?: string }[] = [];
  let index = 0;
  for (;;) {
    const key = formData.get(`${field}__key_${index}`);
    const value = formData.get(`${field}__value_${index}`);
    if (key === null && value === null) break;
    rows.push({
      key: typeof key === "string" ? key : undefined,
      value: typeof value === "string" ? value : undefined,
    });
    index += 1;
  }
  return rows;
}

const createCaseSchema = z.object({
  title: z.string().min(1, "A name for the case is required.").max(160),
  subtitle: z.string().max(200).optional().default(""),
  kind: z.enum(CASE_KINDS).default("subject"),
  summary: z.string().max(2000).optional().default(""),
  programTitle: z.string().min(1, "Research program title is required.").max(200),
  programDescription: z.string().max(2000).optional().default(""),
  programHypothesis: z.string().max(2000).optional().default(""),
  focusArea: z.string().max(200).optional().default(""),
  // Only the statuses a program can be born in. An untouched select still submits a value,
  // so the default is a real entry point rather than "whatever was missing".
  status: z.enum(PROGRAM_INITIAL_STATUSES).default(PROGRAM_DEFAULT_STATUS),
});

/**
 * A text field's value as a trimmed string, or `undefined` when nothing was submitted.
 *
 * Trimming before validation is what makes a required field honest: a title of `"   "` is
 * length 3, so `.min(1)` would accept it and store a case whose name is invisible. The old
 * optional fields were checked for emptiness with `v === ""` before Zod, which is why a blank
 * one could reach the database as `NaN` — the check has to be here, in one place, for both.
 */
function text(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function createCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const attributes = normalizeAttributeRows(readAttributeRows(formData, "attribute"));
  if (attributes.error) return { error: attributes.error };

  const parsed = createCaseSchema.safeParse({
    title: text(formData, "title"),
    subtitle: text(formData, "subtitle") ?? "",
    kind: text(formData, "kind") ?? undefined,
    summary: text(formData, "summary") ?? "",
    programTitle: text(formData, "programTitle"),
    programDescription: text(formData, "programDescription") ?? "",
    programHypothesis: text(formData, "programHypothesis") ?? "",
    focusArea: text(formData, "focusArea") ?? "",
    status: text(formData, "status") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { case: created } = createCaseAndProgram(getDb(), user, {
    ...parsed.data,
    attributes: attributes.attributes,
  });
  revalidatePath("/");
  redirect(`/cases/${created.id}?tab=overview&created=1`);
}

const updateCaseSchema = z.object({
  title: z.string().min(1, "A name for the case is required.").max(160),
  subtitle: z.string().max(200).optional().default(""),
  kind: z.enum(CASE_KINDS),
  summary: z.string().max(2000).optional().default(""),
});

export async function updateCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const programId = formData.get("programId");
  if (typeof programId !== "string") return { error: "Missing program id." };
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Case not found." };
  }
  const attributes = normalizeAttributeRows(readAttributeRows(formData, "attribute"));
  if (attributes.error) return { error: attributes.error };

  const parsed = updateCaseSchema.safeParse({
    title: text(formData, "title"),
    subtitle: text(formData, "subtitle") ?? "",
    kind: text(formData, "kind") ?? undefined,
    summary: text(formData, "summary") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  updateCase(getDb(), user, programId, { ...parsed.data, attributes: attributes.attributes });
  revalidatePath(`/cases/${programId}`);
  return { error: undefined };
}

const updateProgramSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  hypothesis: z.string().max(2000).optional().default(""),
  focusArea: z.string().max(200).optional().default(""),
  status: z.enum(PROGRAM_STATUSES),
});

export async function updateProgramAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof programId !== "string") return { error: "Missing program id." };
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Program not found." };
  }
  const parsed = updateProgramSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description") ?? "",
    hypothesis: text(formData, "hypothesis") ?? "",
    focusArea: text(formData, "focusArea") ?? "",
    status: text(formData, "status") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  updateProgram(getDb(), user, programId, parsed.data);
  revalidatePath(typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`);
  return { error: undefined };
}

const programStatusSchema = z.object({
  programId: z.string().min(1),
  caseId: z.string().optional(),
  status: z.enum(PROGRAM_STATUSES),
});

/**
 * Move a research program to the next state in its lifecycle — the "planned → active" step,
 * and every move after it.
 *
 * The action, not the control, decides whether a move is legal: the form only ever offers
 * the targets in `PROGRAM_STATUS_TRANSITIONS`, but a request can carry anything, so the same
 * table is checked here before the repo is touched. Without that, the lifecycle would be a
 * UI suggestion rather than a rule.
 */
export async function updateProgramStatusAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = programStatusSchema.safeParse({
    programId: formData.get("programId"),
    caseId: formData.get("caseId") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid status update." };
  const { programId, caseId, status } = parsed.data;

  // Scoped to the signed-in researcher, so this is both the authorization check and the
  // source of the status being moved from.
  const program = getProgramForResearcher(getDb(), programId, user.id);
  if (!program) return { error: "Program not found." };

  const from = program.program.status as ProgramStatus;
  if (!PROGRAM_STATUSES.includes(from) || !canTransitionProgram(from, status)) {
    const fromLabel = (PROGRAM_STATUS_LABELS[from] ?? from).toLowerCase();
    return {
      error: `This program is ${fromLabel} and cannot move to ${PROGRAM_STATUS_LABELS[status].toLowerCase()}.`,
    };
  }

  setProgramStatus(getDb(), user, programId, status);
  revalidatePath(`/cases/${caseId ?? program.program.caseId}`);
  revalidatePath("/");
  return {};
}

export async function ensureDbAction(): Promise<{ ok: boolean }> {
  try {
    migrateDb(getDb());
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false };
  }
}

export async function resetDemoDbAction(): Promise<{ ok: boolean }> {
  resetDb();
  migrateDb(getDb());
  return { ok: true };
}
