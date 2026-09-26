"use client";

import { useActionState } from "react";
import { createFindingAction, type FindingFormState } from "@/actions/findings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  FINDING_CATEGORIES,
  FINDING_CATEGORY_LABELS,
  SIGNIFICANCE_LEVELS,
  SIGNIFICANCE_LABELS,
} from "@/lib/constants";
import { Lightbulb } from "lucide-react";

export function RecordFindingForm({
  programId,
  patientId,
  activityId,
  defaultCategory,
}: {
  programId: string;
  patientId: string;
  activityId?: string | null;
  defaultCategory?: string;
}) {
  const [state, formAction, pending] = useActionState<FindingFormState, FormData>(createFindingAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {activityId ? <input type="hidden" name="activityId" value={activityId} /> : null}
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="fromActivity" value={activityId ?? ""} />
      <Field
        label="Finding title"
        htmlFor="title"
        required
        error={state.fieldErrors?.title?.[0]}
        hint="a concise, specific observation"
      >
        <Input id="title" name="title" placeholder="e.g. Biallelic TP53 disruption in dominant clone" />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        required
        error={state.fieldErrors?.description?.[0]}
        hint="what was observed, how, and why it matters"
      >
        <Textarea
          id="description"
          name="description"
          rows={4}
          placeholder="Summarize the observation, linked to the data reviewed and the analysis run…"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" required>
          <Select id="category" name="category" defaultValue={defaultCategory ?? "molecular"}>
            {FINDING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FINDING_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Significance" htmlFor="significance" required>
          <Select id="significance" name="significance" defaultValue="medium">
            {SIGNIFICANCE_LEVELS.map((s) => (
              <option key={s} value={s}>
                {SIGNIFICANCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} icon={<Lightbulb className="size-4" />}>
          {pending ? "Recording…" : "Record finding"}
        </Button>
        {activityId && (
          <a
            href={`/patients/${patientId}/activities/${activityId}`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700/70 hover:bg-ink-100 hover:text-ink-900"
          >
            Cancel
          </a>
        )}
      </div>
    </form>
  );
}
