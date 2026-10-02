"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createReport, finalizeReport, getProgramForResearcher } from "@/lib/db/repo";
import { generateReport } from "@/lib/report/generate";
import { requireUser } from "@/lib/server/auth";

export type ReportFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export async function generateReportAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string; reportId?: string }> {
  const user = await requireUser();
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof programId !== "string") return { error: "Missing program id." };
  const summary = getProgramForResearcher(getDb(), programId, user.id);
  if (!summary) return { error: "Program not found." };

  // Throws if the program is not readable, which the check above already ruled out; kept as a
  // second gate so a report is never assembled from a program this request cannot see.
  const generated = generateReport(getDb(), programId, user.id);
  const report = createReport(getDb(), {
    programId,
    generatedById: user.id,
    title: generated.title,
    summary: generated.summary,
    contentJson: JSON.stringify(generated.content),
  });
  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  revalidatePath(`${base}/reports`);
  revalidatePath(`${base}/history`);
  return { error: undefined, reportId: report.id };
}

export async function finalizeReportAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const reportId = formData.get("reportId");
  const programId = formData.get("programId");
  const caseId = formData.get("caseId");
  if (typeof reportId !== "string" || typeof programId !== "string") {
    return { error: "Missing ids." };
  }
  const result = finalizeReport(getDb(), user, reportId, programId);
  if (!result) return { error: "Report not found." };
  const base = typeof caseId === "string" ? `/cases/${caseId}` : `/cases/${programId}`;
  revalidatePath(`${base}/reports`);
  revalidatePath(`/report/${reportId}`);
  return {};
}
