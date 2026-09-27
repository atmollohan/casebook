"use client";

import { useActionState } from "react";
import { createPatientAction, type FormState } from "@/actions/patient";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import {
  CONSENT_STATUSES,
  CONSENT_STATUS_LABELS,
  SEX_VALUES,
  SEX_LABELS,
  PROGRAM_INITIAL_STATUSES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_DEFAULT_STATUS,
  type ConsentStatus,
  type SexValue,
} from "@/lib/constants";
import { UserPlus } from "lucide-react";
import Link from "next/link";

export default function NewPatientPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPatientAction, {});

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">New patient program</h2>
          <p className="mt-0.5 text-sm text-ink-700/70">
            Register a patient and their research program in one step. The workspace opens with overview,
            data, activities, findings, evidence, reports, and history ready.
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
        <CardHeader
          title="Patient & program details"
          aside={<UserPlus className="size-5 text-brand-600" />}
        />
        <CardBody>
          <form action={formAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                htmlFor="firstName"
                required
                error={state.fieldErrors?.firstName?.[0]}
              >
                <Input id="firstName" name="firstName" autoComplete="given-name" />
              </Field>
              <Field label="Last name" htmlFor="lastName" required error={state.fieldErrors?.lastName?.[0]}>
                <Input id="lastName" name="lastName" autoComplete="family-name" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Birth year" htmlFor="birthYear" error={state.fieldErrors?.birthYear?.[0]}>
                <Input id="birthYear" name="birthYear" type="number" inputMode="numeric" placeholder="1985" />
              </Field>
              <Field label="Sex" htmlFor="sex">
                <Select id="sex" name="sex" defaultValue="unknown">
                  {SEX_VALUES.map((s: SexValue) => (
                    <option key={s} value={s}>
                      {SEX_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label="Reason for research engagement"
              htmlFor="conditionSummary"
              error={state.fieldErrors?.conditionSummary?.[0]}
              hint="diagnosis, clinical question, or research interest"
            >
              <Textarea
                id="conditionSummary"
                name="conditionSummary"
                rows={2}
                placeholder="e.g. Treatment-refractory CLL; TP53 disruption research focus…"
              />
            </Field>
            <Field label="Consent status" htmlFor="consentStatus" required>
              <Select id="consentStatus" name="consentStatus" defaultValue="consented">
                {CONSENT_STATUSES.map((c: ConsentStatus) => (
                  <option key={c} value={c}>
                    {CONSENT_STATUS_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="border-t border-ink-100 pt-5">
              <div className="text-[15px] font-semibold text-ink-900">Research program</div>
              <div className="mt-0.5 text-sm text-ink-700/70">
                Each patient program requires a title; the rest can be filled in later.
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
                placeholder="e.g. TP53 disruption in treatment-refractory CLL"
              />
            </Field>
            <Field label="Focus area" htmlFor="focusArea" error={state.fieldErrors?.focusArea?.[0]}>
              <Input id="focusArea" name="focusArea" placeholder="e.g. Genomics, somatic variants" />
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

            {state.error && <div className="field-error">{state.error}</div>}
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={pending} icon={<UserPlus className="size-4" />}>
                {pending ? "Creating…" : "Create patient program"}
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
