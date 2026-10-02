"use client";

import { useActionState } from "react";
import { createActivityAction, type ActivityFormState } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { FlaskConical } from "lucide-react";

export function NewActivityForm({ programId, caseId }: { programId: string; caseId: string }) {
  const [state, formAction, pending] = useActionState<ActivityFormState, FormData>(createActivityAction, {});

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="New research analysis"
        description="Findings can be recorded against this activity."
        aside={<FlaskConical className="size-5 text-brand-600" />}
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="caseId" value={caseId} />
          <Field
            label="Activity title"
            htmlFor="title"
            required
            error={state.fieldErrors?.title?.[0]}
            hint="e.g. “Variant burden review of tumor WES”"
          >
            <Input id="title" name="title" placeholder="Variant burden review, tumor WES" />
          </Field>
          <Field label="Activity type" htmlFor="activityType" required>
            <Select id="activityType" name="activityType" defaultValue="variant_analysis">
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Hypothesis"
            htmlFor="hypothesis"
            error={state.fieldErrors?.hypothesis?.[0]}
            hint="what this analysis is testing"
          >
            <Textarea
              id="hypothesis"
              name="hypothesis"
              rows={2}
              placeholder="This analysis will test whether…"
            />
          </Field>
          <Field label="Description" htmlFor="description" error={state.fieldErrors?.description?.[0]}>
            <Textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Scope, inputs (which data assets), and planned approach…"
            />
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={pending} icon={<FlaskConical className="size-4" />}>
              {pending ? "Creating…" : "Create analysis"}
            </Button>
            <a
              href={`/cases/${caseId}/activities`}
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
