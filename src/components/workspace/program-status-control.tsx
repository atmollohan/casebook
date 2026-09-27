"use client";

import { useActionState } from "react";
import { updateProgramStatusAction } from "@/actions/patient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, CircleCheck, Flag } from "lucide-react";
import { PROGRAM_STATUS_LABELS, PROGRAM_STATUS_TRANSITIONS, type ProgramStatus } from "@/lib/constants";

const badgeTone: Record<ProgramStatus, "brand" | "green" | "amber" | "blue" | "slate"> = {
  planned: "brand",
  active: "green",
  paused: "amber",
  closing: "blue",
  closed: "slate",
};

type Variant = "primary" | "secondary" | "danger";

/**
 * Button copy and emphasis per move. The lifecycle itself lives in
 * `PROGRAM_STATUS_TRANSITIONS` — this is only how each legal move is worded, and a move
 * added there without an entry here still renders, using the status label on a neutral
 * button. Wording is deliberately the same verb as the resulting badge, so "Close program"
 * does not quietly become a status reading "Cancelled".
 */
const moveCopy: Partial<
  Record<
    ProgramStatus,
    Partial<Record<ProgramStatus, { label: string; variant: Variant; icon: React.ReactNode }>>
  >
> = {
  planned: {
    active: { label: "Start program", variant: "primary", icon: <Play className="size-3.5" /> },
    closed: { label: "Close program", variant: "danger", icon: <Flag className="size-3.5" /> },
  },
  active: {
    paused: { label: "Pause program", variant: "secondary", icon: <Pause className="size-3.5" /> },
    closing: { label: "Start closing", variant: "secondary", icon: <Flag className="size-3.5" /> },
  },
  paused: {
    active: { label: "Resume program", variant: "primary", icon: <Play className="size-3.5" /> },
    closing: { label: "Start closing", variant: "secondary", icon: <Flag className="size-3.5" /> },
  },
  closing: {
    active: { label: "Reopen program", variant: "primary", icon: <RotateCcw className="size-3.5" /> },
    closed: { label: "Mark closed", variant: "danger", icon: <CircleCheck className="size-3.5" /> },
  },
};

/**
 * Where a research program sits in its lifecycle, and the moves available from here.
 *
 * Every legal move is a button rather than a dropdown: a program has at most two, so a
 * picker would hide the outcome behind a click to reveal one. `closed` is terminal and
 * renders the status alone — no dead control.
 */
export function ProgramStatusControl({
  programId,
  patientId,
  current,
}: {
  programId: string;
  patientId: string;
  current: ProgramStatus;
}) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    updateProgramStatusAction,
    {},
  );

  const targets = PROGRAM_STATUS_TRANSITIONS[current] ?? [];
  const badge = (
    <Badge tone={badgeTone[current] ?? "slate"} dot>
      {PROGRAM_STATUS_LABELS[current]}
    </Badge>
  );

  if (targets.length === 0) {
    return (
      <div className="flex items-center gap-2">
        {badge}
        <span className="text-[13px] text-ink-700/60">This program is closed.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badge}
      {targets.map((to) => {
        const copy = moveCopy[current]?.[to] ?? {
          label: PROGRAM_STATUS_LABELS[to],
          variant: "secondary" as Variant,
          icon: null,
        };
        return (
          <form action={formAction} key={to} className="inline-flex">
            <input type="hidden" name="programId" value={programId} />
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="status" value={to} />
            <Button
              type="submit"
              size="sm"
              variant={copy.variant}
              disabled={pending}
              icon={copy.icon}
              onClick={(e) => {
                // Closing a program ends the work; a misclick here is not obviously
                // recoverable, and the button is one keystroke away.
                if (to === "closed" && !confirm("Close this research program?")) e.preventDefault();
              }}
            >
              {copy.label}
            </Button>
          </form>
        );
      })}
      {state.error && <span className="text-[13px] text-red-600">{state.error}</span>}
    </div>
  );
}
