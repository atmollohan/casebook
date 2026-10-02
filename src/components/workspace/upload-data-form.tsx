"use client";

import { useActionState } from "react";
import { uploadDataAction, type DataFormState } from "@/actions/data";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/card";
import { DATA_CATEGORIES, DATA_CATEGORY_LABELS } from "@/lib/constants";
import { formatBytes } from "@/lib/utils/format";
import { Upload } from "lucide-react";
import { MAX_UPLOAD_BYTES } from "@/lib/files/limits";

export function UploadDataForm({ programId, caseId }: { programId: string; caseId: string }) {
  const [state, formAction, pending] = useActionState<DataFormState, FormData>(uploadDataAction, {});

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center gap-2">
          <Upload className="size-4 text-brand-600" />
          <h3 className="text-[15px] font-semibold text-ink-900">Upload research data</h3>
        </div>
        <p className="mb-4 text-[13px] text-ink-700/60">
          CSV, TSV, VCF, JSON, TXT, FASTA, BED, GFF, PDF, PNG/JPG, XLSX or Markdown · up to{" "}
          {formatBytes(MAX_UPLOAD_BYTES)}
        </p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="caseId" value={caseId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Display title"
              htmlFor="title"
              required
              error={state.fieldErrors?.title?.[0]}
              hint="e.g. “Variant calls, tumor WES”"
            >
              <Input id="title" name="title" placeholder="Variant calls, tumor WES" />
            </Field>
            <Field label="Category" htmlFor="category" required error={state.fieldErrors?.category?.[0]}>
              <Select id="category" name="category" defaultValue="genomics">
                {DATA_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DATA_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="File" htmlFor="file" required error={state.error ?? undefined}>
            <input
              id="file"
              name="file"
              type="file"
              className="focus-ring block w-full cursor-pointer rounded-lg border border-dashed border-ink-300 bg-ink-50/50 text-sm text-ink-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700"
            />
            <p className="mt-1 text-xs text-ink-700/50">
              Original filename is preserved; content is stored under a generated id.
            </p>
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            error={state.fieldErrors?.description?.[0]}
            hint="optional context for other researchers"
          >
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="What this file represents and how it was produced…"
            />
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={pending} icon={<Upload className="size-4" />}>
              {pending ? "Uploading…" : "Upload file"}
            </Button>
            <a
              href={`/cases/${caseId}/data`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700/70 hover:bg-ink-100 hover:text-ink-900"
            >
              Cancel
            </a>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
