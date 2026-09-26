"use client";

import { useActionState } from "react";
import { updateActivityStatusAction } from "@/actions/activities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2 } from "lucide-react";
import type { ActivityStatus } from "@/lib/constants";

const badgeTone: Record<ActivityStatus, "brand" | "blue" | "green" | "slate"> = {
  planned: "brand",
  in_progress: "blue",
  completed: "green",
  closed: "slate",
};

const label: Record<ActivityStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};

export function ActivityStatusControl({
  activityId,
  programId,
  current,
}: {
  activityId: string;
  programId: string;
  current: ActivityStatus;
}) {
  const [, formAction, pending] = useActionState<{ error?: string }, FormData>(
    updateActivityStatusAction,
    {},
  );

  const isFinished = current === "completed" || current === "closed";
  const next: ActivityStatus = current === "planned" ? "in_progress" : "completed";

  return (
    <div className="flex items-center gap-3">
      <Badge tone={badgeTone[current] ?? "slate"} dot>
        {label[current]}
      </Badge>
      {!isFinished && (
        <form
          action={formAction}
          onSubmit={(e) => {
            if (next === "completed" && !confirm("Mark this analysis as completed?")) e.preventDefault();
          }}
          className="inline-flex items-center gap-2"
        >
          <input type="hidden" name="activityId" value={activityId} />
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="status" value={next} />
          <Button
            type="submit"
            size="sm"
            disabled={pending}
            variant={next === "in_progress" ? "secondary" : "primary"}
            icon={
              next === "in_progress" ? <Play className="size-3.5" /> : <CheckCircle2 className="size-3.5" />
            }
          >
            {next === "in_progress" ? "Start analysis" : "Mark completed"}
          </Button>
        </form>
      )}
    </div>
  );
}
