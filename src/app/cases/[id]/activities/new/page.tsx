import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { findCaseById } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { NewActivityForm } from "@/components/workspace/new-activity-form";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "New analysis" };

export default async function NewActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const found = findCaseById(getDb(), id, user.id);
  if (!found) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/cases/${id}/activities`}
        className="focus-ring inline-flex items-center gap-1 rounded-lg text-sm font-medium text-ink-700/70 hover:text-brand-700"
      >
        <ChevronLeft className="size-4" /> Activities
      </Link>
      <NewActivityForm programId={found.program.id} caseId={id} />
    </div>
  );
}
