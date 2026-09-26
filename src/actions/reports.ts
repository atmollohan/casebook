"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createReport, finalizeReport, getProgramForResearcher } from "@/lib/db/repo";
import { generateReportContent, programReportTitle, reportSummary } from "@/lib/report/generate";
import { requireUser } from "@/lib/server/auth";

export type ReportFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export async function generateReportAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string; reportId?: string }> {
  const user = await requireUser();
  const programId = formData.get("programId");
  const patientId = formData.get("patientId");
  if (typeof programId !== "string") return { error: "Missing program id." };
  const summary = getProgramForResearcher(getDb(), programId, user.id);
  if (!summary) return { error: "Program not found." };

  const content = generateReportContent(getDb(), programId, user.id);
  const patientName = `${summary.patient.lastName}, ${summary.patient.firstName}`;
  const report = createReport(getDb(), {
    programId,
    generatedById: user.id,
    title: programReportTitle(patientName),
    summary: reportSummary(content),
    contentJson: JSON.stringify(content),
  });
  const base = typeof patientId === "string" ? `/patients/${patientId}` : `/patients/${programId}`;
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
  const patientId = formData.get("patientId");
  if (typeof reportId !== "string" || typeof programId !== "string") {
    return { error: "Missing ids." };
  }
  const result = finalizeReport(getDb(), user, reportId, programId);
  if (!result) return { error: "Report not found." };
  const base = typeof patientId === "string" ? `/patients/${patientId}` : `/patients/${programId}`;
  revalidatePath(`${base}/reports`);
  revalidatePath(`/report/${reportId}`);
  return {};
}
