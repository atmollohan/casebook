import { ALLOWED_EXTENSIONS } from "@/lib/files/storage";
import { clampFileExtension } from "@/lib/utils/format";

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

export function mimeTypeForPath(filename: string): string | null {
  const ext = clampFileExtension(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;
  return MIME_BY_EXT[ext] ?? null;
}
