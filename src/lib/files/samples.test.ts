import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAllowedUpload } from "@/lib/files/storage";
import { mimeTypeForPath } from "@/lib/files/mime";

/**
 * Guards the demo sample files. A sample the app would reject — or one large enough to
 * stall a live upload — is worse than no sample at all, so this is checked in CI rather
 * than discovered in front of an audience.
 */
const SAMPLES = path.resolve(process.cwd(), "samples");
const MAX_DEMO_SAMPLE_BYTES = 2 * 1024 * 1024;

/** Files that carry prose, so each must be self-identifying as synthetic. */
const MUST_DECLARE_SYNTHETIC = [".vcf", ".json", ".txt", ".md", ".fasta", ".gff", ".bed"];

function sampleFiles() {
  return fs
    .readdirSync(SAMPLES)
    .filter((f) => !f.toLowerCase().endsWith(".md") || f === "README.md")
    .map((f) => ({ name: f, size: fs.statSync(path.join(SAMPLES, f)).size }));
}

describe("demo sample files", () => {
  it("ships a set of samples", () => {
    expect(sampleFiles().length).toBeGreaterThanOrEqual(10);
  });

  it("only contains files the upload allowlist accepts", () => {
    for (const { name, size } of sampleFiles()) {
      const result = isAllowedUpload(name, size);
      expect(result, `${name}: ${result.reason ?? ""}`).toEqual({ ok: true });
    }
  });

  it("keeps every sample small enough to upload instantly during a demo", () => {
    for (const { name, size } of sampleFiles()) {
      expect(size, name).toBeLessThanOrEqual(MAX_DEMO_SAMPLE_BYTES);
      expect(size, name).toBeGreaterThan(0);
    }
  });

  it("covers the formats worth showing off", () => {
    const exts = new Set(sampleFiles().map((f) => path.extname(f.name).toLowerCase()));
    for (const ext of [
      ".vcf",
      ".csv",
      ".tsv",
      ".bed",
      ".gff",
      ".fasta",
      ".json",
      ".txt",
      ".md",
      ".png",
      ".pdf",
    ]) {
      expect(exts, `missing a ${ext} sample`).toContain(ext);
    }
  });

  it("resolves a mime type for every sample, so previews and downloads work", () => {
    for (const { name } of sampleFiles()) {
      expect(mimeTypeForPath(name), name).toBeTruthy();
    }
  });

  it("labels every prose-bearing sample as synthetic", () => {
    for (const { name } of sampleFiles()) {
      const ext = path.extname(name).toLowerCase();
      if (!MUST_DECLARE_SYNTHETIC.includes(ext)) continue;
      const body = fs.readFileSync(path.join(SAMPLES, name), "utf8").toLowerCase();
      expect(body, `${name} must say it is synthetic`).toContain("synthetic");
    }
  });

  it("uses only obviously fake sample identifiers", () => {
    // Every synthetic identifier must come from a namespace this file defines. A new
    // namespace means someone pasted in an id we did not fabricate, which is the risk.
    const ALLOWED = [/^SYN-DEMO/, /^SYN_SV/, /^SYN\d{3,}$/];
    for (const { name } of sampleFiles()) {
      if (path.extname(name).toLowerCase() === ".pdf") continue; // binary
      const body = fs.readFileSync(path.join(SAMPLES, name), "utf8");
      for (const id of body.match(/SYN[-_][A-Za-z0-9-]*/g) ?? []) {
        expect(
          ALLOWED.some((re) => re.test(id)),
          `${name} contains unexpected id ${id}`,
        ).toBe(true);
      }
    }
  });

  it("documents the set for whoever runs the demo", () => {
    const readme = fs.readFileSync(path.join(SAMPLES, "README.md"), "utf8").toLowerCase();
    expect(readme).toContain("synthetic");
    expect(readme).toContain("npm run samples");
  });
});
