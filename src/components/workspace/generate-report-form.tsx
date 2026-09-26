"use client";

import { useActionState } from "react";
import { generateReportAction } from "@/actions/reports";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export function GenerateReportForm({ programId, patientId }: { programId: string; patientId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<{ error?: string; reportId?: string }, FormData>(
    generateReportAction,
    {},
  );

  if (state.reportId) {
    router.push(`/report/${state.reportId}`);
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand-600" />
          <h3 className="text-[15px] font-semibold text-ink-900">Generate research report</h3>
        </div>
        <AlertBanner tone="brand" className="mt-3">
          The report is assembled automatically from the current program state: patient overview, data index,
          activities, findings with their evidence, and activity history. Regenerate anytime; the report opens
          for review.
        </AlertBanner>
        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="patientId" value={patientId} />
          <Button type="submit" disabled={pending} icon={<Sparkles className="size-4" />}>
            {pending ? "Assembling…" : "Generate report"}
          </Button>
          <a
            href={`/patients/${patientId}/reports`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700/70 hover:bg-ink-100 hover:text-ink-900"
          >
            Cancel
          </a>
        </form>
        {state.error && <div className="field-error mt-2">{state.error}</div>}
      </CardBody>
    </Card>
  );
}
