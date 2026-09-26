import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <FileQuestion className="size-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Page not found</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-700/70">
          That page does not exist, or the link is out of date.
        </p>
        <div className="mt-6">
          <ButtonLink href="/">Back to programs</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
