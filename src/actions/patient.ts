"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, getClient, migrateDb, resetDb } from "@/lib/db";
import {
  createPatientAndProgram,
  updateProgram,
  getProgramForResearcher,
  findPatientById,
  logHistory,
  setProgramStatus,
} from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import {
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_INITIAL_STATUSES,
  PROGRAM_DEFAULT_STATUS,
  CONSENT_STATUSES,
  SEX_VALUES,
  canTransitionProgram,
  type ProgramStatus,
} from "@/lib/constants";
import { now } from "@/lib/utils/format";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

const createPatientSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(80),
  lastName: z.string().min(1, "Last name is required.").max(80),
  // An untouched number input submits "", and a missing field submits null. Both mean
  // "not recorded" for an optional field. Anything else is coerced, and junk is left as-is
  // so Zod reports a real type error instead of an unexplained NaN.
  birthYear: z.preprocess((v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string" && v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
  }, z.number().int().min(1900).max(new Date().getFullYear()).optional()),
  sex: z.enum(SEX_VALUES).optional(),
  conditionSummary: z.string().max(500).optional().default(""),
  consentStatus: z.enum(CONSENT_STATUSES).default("consented"),
  programTitle: z.string().min(1, "Research program title is required.").max(200),
  programDescription: z.string().max(2000).optional().default(""),
  programHypothesis: z.string().max(2000).optional().default(""),
  focusArea: z.string().max(200).optional().default(""),
  // Only the statuses a program can be born in. An untouched select still submits a value,
  // so the default is a real entry point rather than "whatever was missing".
  status: z.enum(PROGRAM_INITIAL_STATUSES).default(PROGRAM_DEFAULT_STATUS),
});

export async function createPatientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createPatientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    birthYear: formData.get("birthYear") || undefined,
    sex: formData.get("sex") || undefined,
    conditionSummary: formData.get("conditionSummary") || "",
    consentStatus: formData.get("consentStatus") || "consented",
    programTitle: formData.get("programTitle"),
    programDescription: formData.get("programDescription") || "",
    programHypothesis: formData.get("programHypothesis") || "",
    focusArea: formData.get("focusArea") || "",
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { patient } = createPatientAndProgram(getDb(), user, parsed.data);
  revalidatePath("/");
  redirect(`/patients/${patient.id}?tab=overview&created=1`);
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
  const patientId = formData.get("patientId");
  if (typeof programId !== "string") return { error: "Missing program id." };
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Program not found." };
  }
  const parsed = updateProgramSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    hypothesis: formData.get("hypothesis") || "",
    focusArea: formData.get("focusArea") || "",
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  updateProgram(getDb(), user, programId, parsed.data);
  revalidatePath(typeof patientId === "string" ? `/patients/${patientId}` : `/patients/${programId}`);
  return { error: undefined };
}

const programStatusSchema = z.object({
  programId: z.string().min(1),
  patientId: z.string().optional(),
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
    patientId: formData.get("patientId") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid status update." };
  const { programId, patientId, status } = parsed.data;

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
  revalidatePath(`/patients/${patientId ?? program.program.patientId}`);
  revalidatePath("/");
  return {};
}

export async function updatePatientNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const patientId = formData.get("patientId");
  const conditionSummary = formData.get("conditionSummary");
  if (typeof patientId !== "string" || typeof conditionSummary !== "string") {
    return { error: "Missing patient or note." };
  }
  const found = findPatientById(getDb(), patientId, user.id);
  if (!found) return { error: "Patient not found." };

  const db = getDb();
  getClient(db)
    .prepare("update patients set condition_summary = ?, updated_at = ? where id = ?")
    .run(conditionSummary.trim(), now(), patientId);
  logHistory(db, {
    programId: found.program.id,
    actorId: user.id,
    eventType: "patient_updated",
    entityType: "patient",
    entityId: patientId,
    summary: "Patient clinical summary updated",
  });
  revalidatePath(`/patients/${patientId}`);
  return { error: undefined };
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
