"use client";

import { useActionState } from "react";
import { removeEvidenceAction } from "@/actions/findings";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function RemoveEvidenceButton({
  evidenceId,
  findingId,
  programId,
  patientId,
}: {
  evidenceId: string;
  findingId: string;
  programId: string;
  patientId: string;
}) {
  const [, formAction, pending] = useActionState<{ error?: string }, FormData>(removeEvidenceAction, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Remove this evidence source from the finding?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <input type="hidden" name="findingId" value={findingId} />
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="patientId" value={patientId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        icon={<X className="size-3.5" />}
        disabled={pending}
        className="shrink-0 text-ink-700/40 hover:text-red-600"
        title="Remove source"
      />
    </form>
  );
}
