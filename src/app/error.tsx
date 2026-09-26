"use client";

import { AlertTriangle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Something went wrong</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-700/70">
          This page could not be loaded. Your work is saved — retrying usually resolves it.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-ink-700/50">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Back to programs
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
