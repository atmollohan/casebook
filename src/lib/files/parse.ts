import fs from "node:fs";
import path from "node:path";
import { absoluteStoragePath } from "@/lib/files/storage";

export interface TablePreview {
  kind: "table";
  columns: string[];
  rows: string[][];
  truncatedRows: number;
  totalRows: number;
  metaLines?: string[];
}

export interface TextPreview {
  kind: "text";
  lines: string[];
  truncated: boolean;
  totalLines: number;
  language?: "json" | "text" | "markdown";
}

export interface BinaryPreview {
  kind: "image" | "unavailable";
  note?: string;
}

export type FilePreview = TablePreview | TextPreview | BinaryPreview;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "fasta",
  "fa",
  "fq",
  "bed",
  "gff",
  "gff3",
  "xls", // not really
]);

const TABLE_EXTENSIONS = new Set(["csv", "tsv", "vcf"]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

const MAX_BYTES_READ = 512 * 1024; // 512 KB
const PREVIEW_ROWS = 100;
const PREVIEW_COLUMNS = 20;
const PREVIEW_TEXT_LINES = 200;

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx <= 0) return "";
  return filename.slice(idx + 1).toLowerCase();
}

export function previewForFile(
  storagePath: string,
  mimeType: string | null,
  originalFilename: string,
): FilePreview {
  const dir = path.dirname(storagePath);
  void dir;
  const ext = extensionOf(originalFilename || storagePath);
  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(absoluteStoragePath(storagePath), { flag: "r" });
  } catch {
    return { kind: "unavailable", note: "File is missing on disk." };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return { kind: "image" };
  }

  if (TABLE_EXTENSIONS.has(ext)) {
    return previewTable(buffer, ext);
  }

  if (ext === "json") {
    return previewJson(buffer);
  }

  if (TEXT_EXTENSIONS.has(ext) || mimeType?.startsWith("text/")) {
    return previewText(buffer, ext, originalFilename);
  }

  return {
    kind: "unavailable",
    note: "Live preview is not available for this file type. Download the original to inspect it.",
  };
}

function previewTable(buffer: Buffer, ext: string): TablePreview {
  const text = buffer.subarray(0, MAX_BYTES_READ).toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (ext === "vcf") {
    const metaLines = lines.filter((l) => l.startsWith("##"));
    const headerIdx = lines.findIndex((l) => l.startsWith("#CHROM"));
    if (headerIdx === -1) {
      return {
        kind: "table",
        columns: ["Content"],
        rows: lines.map((l) => [l.slice(0, 200)]).slice(0, PREVIEW_ROWS),
        truncatedRows: Math.max(0, lines.length - PREVIEW_ROWS),
        totalRows: lines.length,
        metaLines,
      };
    }
    const header = parseDelimited(headerIdx >= 0 ? lines[headerIdx] : "", "\t").slice(0, PREVIEW_COLUMNS);
    const data = lines
      .slice(headerIdx + 1)
      .filter((l) => !l.startsWith("##") && !l.startsWith("#"))
      .map((l) =>
        parseDelimited(l, "\t")
          .slice(0, PREVIEW_COLUMNS)
          .map((c) => c.slice(0, 80)),
      )
      .slice(0, PREVIEW_ROWS);
    return {
      kind: "table",
      columns: header,
      rows: data,
      truncatedRows: Math.max(0, data.length - PREVIEW_ROWS),
      totalRows: lines.slice(headerIdx + 1).filter((l) => !l.startsWith("#")).length,
      metaLines,
    };
  }

  const delimiter = ext === "tsv" ? "\t" : ",";
  const header = parseDelimited(lines[0] ?? "", delimiter).slice(0, PREVIEW_COLUMNS);
  const rows = lines
    .slice(1)
    .map((l) =>
      parseDelimited(l, delimiter)
        .slice(0, PREVIEW_COLUMNS)
        .map((c) => c.slice(0, 120)),
    )
    .slice(0, PREVIEW_ROWS);
  return {
    kind: "table",
    columns: header,
    rows,
    truncatedRows: Math.max(0, Math.max(0, lines.length - 1 - PREVIEW_ROWS)),
    totalRows: Math.max(0, lines.length - 1),
  };
}

function parseDelimited(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function previewJson(buffer: Buffer): TextPreview {
  const text = buffer.subarray(0, MAX_BYTES_READ).toString("utf8");
  let formatted = text;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    formatted = text;
  }
  const lines = formatted.split("\n");
  const truncated = lines.length > PREVIEW_TEXT_LINES;
  return {
    kind: "text",
    lines: lines.slice(0, PREVIEW_TEXT_LINES),
    truncated,
    totalLines: lines.length,
    language: "json",
  };
}

function previewText(buffer: Buffer, ext: string, originalFilename: string): TextPreview {
  const text = buffer.subarray(0, MAX_BYTES_READ).toString("utf8");
  const lines = text.split("\n");
  const truncated = lines.length > PREVIEW_TEXT_LINES;
  const isMarkdown = ext === "md" || originalFilename.toLowerCase().endsWith(".md");
  return {
    kind: "text",
    lines: lines.slice(0, PREVIEW_TEXT_LINES),
    truncated,
    totalLines: lines.length,
    language: isMarkdown ? "markdown" : "text",
  };
}
