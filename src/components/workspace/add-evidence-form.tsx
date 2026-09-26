"use client";

import { useActionState } from "react";
import { addEvidenceAction, type FindingFormState } from "@/actions/findings";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EVIDENCE_SOURCE_TYPES, EVIDENCE_SOURCE_LABELS } from "@/lib/constants";
import { BookOpenText } from "lucide-react";

export function AddEvidenceForm({
  findingId,
  programId,
  patientId,
}: {
  findingId: string;
  programId: string;
  patientId: string;
}) {
  const [state, formAction, pending] = useActionState<FindingFormState, FormData>(addEvidenceAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="findingId" value={findingId} />
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="patientId" value={patientId} />
      <Field label="Source type" htmlFor="sourceType" required>
        <select
          id="sourceType"
          name="sourceType"
          defaultValue="publication"
          className="focus-ring w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm"
        >
          {EVIDENCE_SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVIDENCE_SOURCE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Citation / source title" htmlFor="title" required error={state.fieldErrors?.title?.[0]}>
        <Input id="title" name="title" placeholder="Author(s). Title. Journal Year." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="URL" htmlFor="url" error={state.fieldErrors?.url?.[0]}>
          <Input id="url" name="url" type="url" placeholder="https://…" />
        </Field>
        <Field label="DOI" htmlFor="doi" error={state.fieldErrors?.doi?.[0]}>
          <Input id="doi" name="doi" placeholder="10.1000/…" />
        </Field>
      </div>
      <Field label="Note" htmlFor="note" error={state.fieldErrors?.note?.[0]} hint="optional context">
        <Textarea id="note" name="note" rows={2} placeholder="How this source supports the finding…" />
      </Field>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={pending}
          variant="secondary"
          icon={<BookOpenText className="size-4" />}
        >
          {pending ? "Adding…" : "Attach source"}
        </Button>
      </div>
    </form>
  );
}
