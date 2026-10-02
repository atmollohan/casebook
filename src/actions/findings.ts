"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  createFinding,
  updateFinding,
  addEvidence,
  removeEvidence,
  getProgramForResearcher,
  getFinding,
} from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { FINDING_CATEGORIES, SIGNIFICANCE_LEVELS, EVIDENCE_SOURCE_TYPES } from "@/lib/constants";

export type FindingFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

const findingSchema = z.object({
  title: z.string().min(1, "Finding title is required.").max(200),
  description: z.string().min(1, "Describe the finding.").max(3000),
  category: z.enum(FINDING_CATEGORIES),
  significance: z.enum(SIGNIFICANCE_LEVELS),
  activityId: z.string().optional().nullable(),
});

export async function createFindingAction(
  _prev: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const user = await requireUser();
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  const fromActivity = formData.get("fromActivity");
  if (typeof programId !== "string") return { error: "Missing program id." };
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Program not found." };
  }
  const parsed = findingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    significance: formData.get("significance"),
    activityId: formData.get("activityId") || null,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { activityId, ...rest } = parsed.data;
  createFinding(getDb(), user, { programId, ...rest, activityId: activityId ?? null });

  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  const backTo =
    typeof fromActivity === "string" && fromActivity.length > 0
      ? `${base}/activities/${fromActivity}?finding=1`
      : `${base}/findings`;
  revalidatePath(`${base}/findings`);
  revalidatePath(backTo);
  return { error: undefined };
}

export async function updateFindingAction(
  _prev: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const user = await requireUser();
  const findingId = formData.get("findingId");
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof findingId !== "string" || typeof programId !== "string") {
    return { error: "Missing finding or program id." };
  }
  if (!getFinding(getDb(), findingId, programId, user.id)) {
    return { error: "Finding not found." };
  }
  const parsed = findingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    significance: formData.get("significance"),
    activityId: formData.get("activityId") || null,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { activityId } = parsed.data;
  updateFinding(getDb(), user, findingId, programId, { ...parsed.data, activityId: activityId ?? null });
  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  revalidatePath(`${base}/findings`);
  revalidatePath(`${base}/activities`);
  return {};
}

const evidenceSchema = z.object({
  sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
  title: z.string().min(1, "Enter a citation or source title.").max(500),
  url: z.string().url("Enter a valid URL.").optional().default(""),
  doi: z.string().max(200).optional().default(""),
  note: z.string().max(1000).optional().default(""),
  attachmentDataRecordId: z.string().optional().nullable(),
});

export async function addEvidenceAction(
  _prev: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const user = await requireUser();
  const findingId = formData.get("findingId");
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof findingId !== "string" || typeof programId !== "string") {
    return { error: "Missing finding or program id." };
  }
  if (!getFinding(getDb(), findingId, programId, user.id)) {
    return { error: "Finding not found." };
  }
  const parsed = evidenceSchema.safeParse({
    sourceType: formData.get("sourceType"),
    title: formData.get("title"),
    url: formData.get("url") || "",
    doi: formData.get("doi") || "",
    note: formData.get("note") || "",
    attachmentDataRecordId: formData.get("attachmentDataRecordId") || null,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  addEvidence(getDb(), user, {
    findingId,
    programId,
    sourceType: parsed.data.sourceType,
    title: parsed.data.title,
    url: parsed.data.url || null,
    doi: parsed.data.doi || null,
    note: parsed.data.note || null,
    attachmentDataRecordId: parsed.data.attachmentDataRecordId,
  });
  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  revalidatePath(`${base}/findings`);
  revalidatePath(`${base}/evidence`);
  revalidatePath(`${base}/activities`);
  return {};
}

export async function removeEvidenceAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const evidenceId = formData.get("evidenceId");
  const findingId = formData.get("findingId");
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof evidenceId !== "string" || typeof findingId !== "string" || typeof programId !== "string") {
    return { error: "Missing ids." };
  }
  removeEvidence(getDb(), user, evidenceId, findingId, programId);
  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  revalidatePath(`${base}/findings`);
  revalidatePath(`${base}/evidence`);
  return {};
}
