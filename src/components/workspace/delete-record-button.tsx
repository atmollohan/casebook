"use client";

import { useActionState } from "react";
import { deleteDataAction } from "@/actions/data";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteRecordButton({
  recordId,
  recordTitle,
  backTo,
}: {
  recordId: string;
  recordTitle: string;
  backTo: string;
}) {
  const [, formAction, pending] = useActionState<{ error?: string }, FormData>(deleteDataAction, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remove “${recordTitle}” from the program? The stored file will also be deleted.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="backTo" value={backTo} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        icon={<Trash2 className="size-3.5" />}
        disabled={pending}
        className="text-ink-700/50 hover:text-red-600"
        title="Remove file"
      />
    </form>
  );
}
