export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".vcf",
  ".json",
  ".txt",
  ".fasta",
  ".fa",
  ".fq",
  ".bed",
  ".gff",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".xlsx",
  ".md",
] as const;
