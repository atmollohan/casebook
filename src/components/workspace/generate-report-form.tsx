"use client";

import { useActionState, useEffect } from "react";
import { generateReportAction } from "@/actions/reports";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/empty-state";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export function GenerateReportForm({ programId, patientId }: { programId: string; patientId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<{ error?: string; reportId?: string }, FormData>(
    generateReportAction,
    {},
  );

  // Navigation is a side effect, so it belongs in an effect — never in the render body.
  useEffect(() => {
    if (state.reportId) router.push(`/report/${state.reportId}`);
  }, [state.reportId, router]);

  // The report is already saved at this point, so show a way through even if the
  // client-side navigation above does not fire.
  if (state.reportId) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-600" />
              <span className="text-[15px] font-semibold text-ink-900">Report generated</span>
            </div>
            <ButtonLink href={`/report/${state.reportId}`} size="sm" icon={<ArrowRight className="size-4" />}>
              Open report
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand-600" />
          <h3 className="text-[15px] font-semibold text-ink-900">Generate research report</h3>
        </div>
        <AlertBanner tone="brand" className="mt-3">
          Assembled from the current program state: patient overview, data index, activities, findings with
          their evidence, and activity history.
        </AlertBanner>
        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="patientId" value={patientId} />
          <Button type="submit" disabled={pending} icon={<Sparkles className="size-4" />}>
            {pending ? "Assembling…" : "Generate report"}
          </Button>
          <ButtonLink href={`/patients/${patientId}/reports`} variant="ghost">
            Cancel
          </ButtonLink>
        </form>
        {state.error && <div className="field-error mt-2">{state.error}</div>}
      </CardBody>
    </Card>
  );
}
