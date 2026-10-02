"use client";

import { useActionState } from "react";
import { finalizeReportAction } from "@/actions/reports";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function FinalizeReportForm({
  reportId,
  programId,
  caseId,
}: {
  reportId: string;
  programId: string;
  caseId: string;
}) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(finalizeReportAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="caseId" value={caseId} />
      <Button type="submit" disabled={pending} variant="secondary" icon={<Lock className="size-3.5" />}>
        {pending ? "Finalizing…" : "Mark as final"}
      </Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
