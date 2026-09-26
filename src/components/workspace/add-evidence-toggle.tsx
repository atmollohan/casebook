"use client";

import { useState } from "react";
import { AddEvidenceForm } from "@/components/workspace/add-evidence-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function AddEvidenceToggle({
  findingId,
  programId,
  patientId,
}: {
  findingId: string;
  programId: string;
  patientId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full sm:w-auto">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        icon={!open ? <Plus className="size-3.5" /> : undefined}
        className="text-brand-700 hover:bg-brand-50"
      >
        {open ? "Hide form" : "Attach source"}
      </Button>
      {open && (
        <div className="mt-3 rounded-lg border border-ink-100 bg-white p-4">
          <AddEvidenceForm findingId={findingId} programId={programId} patientId={patientId} />
        </div>
      )}
    </div>
  );
}
