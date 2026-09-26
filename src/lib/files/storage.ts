import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { clampFileExtension } from "@/lib/utils/format";
import { MAX_UPLOAD_BYTES } from "@/lib/files/limits";

export { MAX_UPLOAD_BYTES };

export const ALLOWED_EXTENSIONS = new Set([
  "csv",
  "tsv",
  "txt",
  "vcf",
  "json",
  "fasta",
  "fa",
  "fq",
  "bed",
  "gff",
  "gff3",
  "md",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "xlsx",
]);

const MIME_BY_EXT: Record<string, string> = {
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  vcf: "text/plain",
  json: "application/json",
  fasta: "text/plain",
  fa: "text/plain",
  fq: "text/plain",
  bed: "text/plain",
  gff: "text/plain",
  gff3: "text/plain",
  md: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function resolveDataDir(): string {
  const configured = process.env.DATA_DIR;
  return path.resolve(
    process.cwd(),
    configured && configured.trim().length > 0 ? configured : "./data/storage",
  );
}

export function storageRoot(): string {
  return resolveDataDir();
}

function extensionOf(filename: string): string {
  return clampFileExtension(filename);
}

export function isAllowedUpload(filename: string, sizeBytes: number): { ok: boolean; reason?: string } {
  if (sizeBytes <= 0) return { ok: false, reason: "File is empty." };
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "File exceeds the 25 MB upload limit." };
  }
  const ext = extensionOf(filename);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      reason:
        "File type not allowed. Use CSV, TSV, VCF, JSON, TXT, FASTA, BED, GFF, PDF, PNG/IPG, XLSX, or Markdown.",
    };
  }
  return { ok: true };
}

export function saveUpload(
  data: Buffer,
  originalFilename: string,
  programId: string,
): {
  storagePath: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
} {
  const ext = extensionOf(originalFilename);
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const dirName = `programs/${programId}`;
  const fileName = `${randomUUID().replace(/-/g, "")}.${ext}`;
  const absoluteDir = path.join(resolveDataDir(), dirName);
  const absolutePath = path.join(absoluteDir, fileName);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(absolutePath, data, { flag: "wx" });
  return {
    storagePath: `${dirName}/${fileName}`,
    absolutePath,
    mimeType,
    sizeBytes: data.length,
  };
}

export function deleteStoredFile(storagePath: string | null) {
  if (!storagePath) return;
  const abs = path.join(resolveDataDir(), storagePath);
  if (!abs.startsWith(resolveDataDir() + path.sep)) return;
  try {
    fs.unlinkSync(abs);
  } catch {
    // Ignore missing files.
  }
}

export function absoluteStoragePath(storagePath: string): string {
  const root = resolveDataDir();
  const abs = path.resolve(root, storagePath);
  if (!abs.startsWith(root + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return abs;
}

export function storagePathExists(storagePath: string): boolean {
  try {
    return fs.existsSync(absoluteStoragePath(storagePath));
  } catch {
    return false;
  }
}
