"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createActivity, setActivityStatus, getProgramForResearcher } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES } from "@/lib/constants";

export type ActivityFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

const createActivitySchema = z.object({
  title: z.string().min(1, "Activity title is required.").max(200),
  activityType: z.enum(ACTIVITY_TYPES),
  hypothesis: z.string().max(2000).optional().default(""),
  description: z.string().max(3000).optional().default(""),
});

export async function createActivityAction(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const user = await requireUser();
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof programId !== "string") return { error: "Missing program id." };
  if (typeof caseId !== "string") return { error: "Missing case id." };
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Program not found." };
  }
  const parsed = createActivitySchema.safeParse({
    title: formData.get("title"),
    activityType: formData.get("activityType"),
    hypothesis: formData.get("hypothesis") || "",
    description: formData.get("description") || "",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const activity = createActivity(getDb(), user, { programId, ...parsed.data });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}/activities`);
  redirect(`/cases/${caseId}/activities/${activity.id}?created=1`);
}

const statusSchema = z.object({
  activityId: z.string().min(1),
  programId: z.string().min(1),
  status: z.enum(ACTIVITY_STATUSES),
});

export async function updateActivityStatusAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse({
    activityId: formData.get("activityId"),
    programId: formData.get("programId"),
    status: formData.get("status"),
  });
  const caseId = formData.get("caseId");
  if (!parsed.success) return { error: "Invalid status update." };
  const { activityId, programId, status } = parsed.data;
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Program not found." };
  }
  setActivityStatus(getDb(), user, activityId, programId, status);
  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  revalidatePath(`${base}/activities`);
  revalidatePath(`${base}/activities/${activityId}`);
  revalidatePath(base);
  return {};
}
