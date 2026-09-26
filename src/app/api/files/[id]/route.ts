import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/db";
import { getProgramForResearcher } from "@/lib/db/repo";
import { absoluteStoragePath, storagePathExists } from "@/lib/files/storage";
import { mimeTypeForPath } from "@/lib/files/mime";
import { readFile } from "node:fs/promises";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = getDb()
    .$client.prepare("select id, program_id, original_filename, storage_path from data_records where id = ?")
    .get(id) as
    { id: string; program_id: string; original_filename: string; storage_path: string | null } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!getProgramForResearcher(getDb(), row.program_id, user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!row.storage_path || !storagePathExists(row.storage_path)) {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  const fileBuffer = await readFile(absoluteStoragePath(row.storage_path));
  const filename = encodeURIComponent(row.original_filename || "download");
  const response = new NextResponse(fileBuffer);
  response.headers.set("Content-Type", mimeTypeForPath(row.original_filename) || "application/octet-stream");
  response.headers.set("Content-Disposition", `inline; filename*=UTF-8''${filename}`);
  response.headers.set("Cache-Control", "private, max-age=300");
  return response;
}
