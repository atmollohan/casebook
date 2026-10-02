"use client";

import { useEffect, useState } from "react";
import {
  loadOnboardingState,
  ONBOARDING_STEP_IDS,
  saveOnboardingState,
  type OnboardingState,
  type OnboardingStepId,
} from "@/lib/browser/onboarding-storage";
import { cn } from "@/components/ui/cn";
import { ButtonLink } from "@/components/ui/button";
import { Check, Circle, Compass, X } from "lucide-react";

export interface OnboardingTarget {
  caseId: string;
  reportId: string | null;
}

interface StepDef {
  id: OnboardingStepId;
  title: string;
  body: string;
  href?: string;
  action?: string;
}

const WORKFLOW =
  "A research program follows one case: review the data, run an activity, record what you find, back it with sources, then generate a report.";

function buildSteps(target: OnboardingTarget): StepDef[] {
  const base = `/cases/${target.caseId}`;
  return [
    {
      id: "directory",
      title: "Start from the program list",
      body: "One row per case research program.",
    },
    {
      id: "data",
      title: "Open the case and review its data",
      body: "Files preview and download in place.",
      href: `${base}/data`,
    },
    {
      id: "reports",
      title: "Generate and read the report",
      body: "The report assembles the program state.",
      href: target.reportId ? `/report/${target.reportId}` : `${base}/reports`,
      action: "Open the report",
    },
  ];
}

export function OnboardingGuide({
  target,
  autoOpen = false,
}: {
  target: OnboardingTarget | null;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [state, setState] = useState<OnboardingState>({ dismissed: false, done: [] });
  const hasTarget = target != null;
  const targetCaseId = target?.caseId;
  const targetReportId = target?.reportId;

  useEffect(() => {
    if (!hasTarget) return;
    const loaded = loadOnboardingState(window.localStorage);
    setState(loaded);
    const allDone = loaded.done.length >= ONBOARDING_STEP_IDS.length;
    if (autoOpen) {
      setFirstVisit(false);
      setOpen(true);
      return;
    }
    if (loaded.dismissed || allDone) return;
    setFirstVisit(true);
    setOpen(true);
    if (!loaded.done.includes("directory")) {
      const next: OnboardingState = { ...loaded, done: [...loaded.done, "directory"] };
      setState(next);
      saveOnboardingState(window.localStorage, next);
    }
  }, [autoOpen, hasTarget, targetCaseId, targetReportId]);

  const close = (dismiss: boolean) => {
    if (dismiss) {
      const next = { ...state, dismissed: true };
      setState(next);
      saveOnboardingState(window.localStorage, next);
    }
    setOpen(false);
  };

  const markDone = (id: OnboardingStepId) => {
    setState((prev) => {
      if (prev.done.includes(id)) return prev;
      const next = { ...prev, done: [...prev.done, id] };
      saveOnboardingState(window.localStorage, next);
      return next;
    });
  };

  if (!target || !open) return null;
  const steps = buildSteps(target);

  return (
    <section aria-label="How this works" className="card mb-6 border-brand-200">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700">
            <Compass className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">
              {firstVisit ? "Welcome to Casebook" : "How this works"}
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-700/75">{WORKFLOW}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => close(true)}
          aria-label="Close"
          className="focus-ring -mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-700/60 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <X className="size-4.5" />
        </button>
      </div>

      <ol className="grid gap-px border-y border-ink-100 bg-ink-100 sm:grid-cols-3">
        {steps.map((step) => {
          const done = state.done.includes(step.id);
          return (
            <li key={step.id} className="flex flex-col gap-2 bg-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                    done ? "bg-brand-600 text-white" : "border border-ink-200 text-ink-700/40",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3" /> : <Circle className="size-2" />}
                </span>
                <span className="text-sm font-medium text-ink-900">{step.title}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-700/70">{step.body}</p>
              {step.href ? (
                <ButtonLink
                  href={step.href}
                  variant={done ? "ghost" : "subtle"}
                  size="sm"
                  onClick={() => markDone(step.id)}
                  className="self-start"
                >
                  {step.action ?? (done ? "Revisit" : "Open")}
                </ButtonLink>
              ) : (
                <span className="text-[12px] text-ink-700/45">You are here</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex justify-end px-5 py-3">
        <ButtonLink href="/" variant="ghost" size="sm" onClick={() => close(true)}>
          Dismiss
        </ButtonLink>
      </div>
    </section>
  );
}
