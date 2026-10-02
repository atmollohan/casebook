"use client";

import { useActionState } from "react";
import { createCaseAction, type FormState } from "@/actions/case";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { AttributeFields } from "@/components/workspace/attribute-fields";
import {
  PROGRAM_INITIAL_STATUSES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_DEFAULT_STATUS,
  CASE_KINDS,
  CASE_KIND_LABELS,
} from "@/lib/constants";
import { FolderPlus } from "lucide-react";
import Link from "next/link";

export default function NewCasePage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCaseAction, {});

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">New case</h2>
          <p className="mt-0.5 text-sm text-ink-700/70">
            A case is whatever the investigation is about — a person, a material, a sample, a dataset, a
            device. Register it and its research program in one step.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700/70 hover:bg-ink-100 hover:text-ink-900"
        >
          Cancel
        </Link>
      </div>

      <Card>
        <CardHeader title="Case & program details" aside={<FolderPlus className="size-5 text-brand-600" />} />
        <CardBody>
          <form action={formAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="title" required error={state.fieldErrors?.title?.[0]}>
                <Input
                  id="title"
                  name="title"
                  required
                  placeholder="e.g. Soil core 14-B, or a person's name"
                />
              </Field>
              <Field
                label="Qualifier"
                htmlFor="subtitle"
                error={state.fieldErrors?.subtitle?.[0]}
                hint="optional: the detail that distinguishes it"
              >
                <Input id="subtitle" name="subtitle" placeholder="e.g. treatment-refractory CLL" />
              </Field>
            </div>
            <Field
              label="Kind"
              htmlFor="kind"
              hint="how the case should be described; it does not change what the app does"
            >
              <Select id="kind" name="kind" defaultValue="subject">
                {CASE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CASE_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Reason for the investigation"
              htmlFor="summary"
              error={state.fieldErrors?.summary?.[0]}
            >
              <Textarea
                id="summary"
                name="summary"
                rows={2}
                placeholder="e.g. Which question this case exists to answer…"
              />
            </Field>

            <div className="border-t border-ink-100 pt-5">
              <AttributeFields error={state.error} />
            </div>

            <div className="border-t border-ink-100 pt-5">
              <div className="text-[15px] font-semibold text-ink-900">Research program</div>
              <div className="mt-0.5 text-sm text-ink-700/70">
                Each case needs a program title; the rest can be filled in later.
              </div>
            </div>
            <Field
              label="Starting status"
              htmlFor="status"
              error={state.fieldErrors?.status?.[0]}
              hint="a program is scoped first, and started when the work begins"
            >
              <Select id="status" name="status" defaultValue={PROGRAM_DEFAULT_STATUS}>
                {PROGRAM_INITIAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROGRAM_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Program title"
              htmlFor="programTitle"
              required
              error={state.fieldErrors?.programTitle?.[0]}
            >
              <Input
                id="programTitle"
                name="programTitle"
                placeholder="e.g. Copy-number instability in treatment-refractory CLL"
              />
            </Field>
            <Field label="Focus area" htmlFor="focusArea" error={state.fieldErrors?.focusArea?.[0]}>
              <Input id="focusArea" name="focusArea" placeholder="e.g. Structural variation" />
            </Field>
            <Field
              label="Hypothesis"
              htmlFor="programHypothesis"
              error={state.fieldErrors?.programHypothesis?.[0]}
            >
              <Textarea
                id="programHypothesis"
                name="programHypothesis"
                rows={2}
                placeholder="What will this program test?"
              />
            </Field>
            <Field
              label="Program description"
              htmlFor="programDescription"
              error={state.fieldErrors?.programDescription?.[0]}
            >
              <Textarea
                id="programDescription"
                name="programDescription"
                rows={3}
                placeholder="Scope, data sources, and investigation plan…"
              />
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={pending} icon={<FolderPlus className="size-4" />}>
                {pending ? "Creating…" : "Create case"}
              </Button>
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700/70 hover:bg-ink-100 hover:text-ink-900"
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
