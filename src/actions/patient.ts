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
} from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { PROGRAM_STATUSES, CONSENT_STATUSES, SEX_VALUES } from "@/lib/constants";
import { now } from "@/lib/utils/format";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

const createPatientSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(80),
  lastName: z.string().min(1, "Last name is required.").max(80),
  birthYear: z.preprocess(
    (v) => (v === "" || v === null ? undefined : Number(v)),
    z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  ),
  sex: z.enum(SEX_VALUES).optional(),
  conditionSummary: z.string().max(500).optional().default(""),
  consentStatus: z.enum(CONSENT_STATUSES).default("consented"),
  programTitle: z.string().min(1, "Research program title is required.").max(200),
  programDescription: z.string().max(2000).optional().default(""),
  programHypothesis: z.string().max(2000).optional().default(""),
  focusArea: z.string().max(200).optional().default(""),
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
