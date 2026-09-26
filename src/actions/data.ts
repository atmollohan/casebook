"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createDataRecord, deleteDataRecord, getProgramForResearcher } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { isAllowedUpload, saveUpload, deleteStoredFile } from "@/lib/files/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/files/limits";
import { DATA_CATEGORIES } from "@/lib/constants";

export type DataFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  category: z.enum(DATA_CATEGORIES),
  description: z.string().max(2000).optional().default(""),
  programId: z.string().min(1),
});

export async function uploadDataAction(_prev: DataFormState, formData: FormData): Promise<DataFormState> {
  const user = await requireUser();
  const parsed = uploadSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || "",
    programId: formData.get("programId"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { programId, title, category, description } = parsed.data;
  if (!getProgramForResearcher(getDb(), programId, user.id)) {
    return { error: "Program not found." };
  }

  const patientId = formData.get("patientId");
  const base = typeof patientId === "string" ? `/patients/${patientId}` : `/patients/${programId}`;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File exceeds the 25 MB upload limit." };
  }
  const check = isAllowedUpload(file.name, file.size);
  if (!check.ok) {
    return { error: check.reason };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = saveUpload(buffer, file.name, programId);

  createDataRecord(getDb(), {
    programId,
    uploadedById: user.id,
    title,
    category: category as (typeof DATA_CATEGORIES)[number],
    originalFilename: file.name,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    storagePath: stored.storagePath,
    description,
    isSynthetic: true,
  });

  revalidatePath(base);
  revalidatePath(`${base}/data`);
  return { error: undefined };
}

export async function deleteDataAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const recordId = formData.get("recordId");
  const path = typeof formData.get("backTo") === "string" ? formData.get("backTo") : undefined;
  if (typeof recordId !== "string") return { error: "Missing record id." };
  const record = deleteDataRecord(getDb(), user, recordId);
  if (!record) return { error: "Record not found." };
  deleteStoredFile(record.storagePath);
  revalidatePath(`/patients/${path ?? record.programId}/data`);
  return {};
}

export async function getUploadedBytes(): Promise<number> {
  return MAX_UPLOAD_BYTES;
}
