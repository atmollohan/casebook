"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./globals.css";

// Replaces the root layout, so it must render its own <html>/<body>. This is the boundary
// that catches failures in the layout itself — most importantly a database that is missing
// or not migrated, which is the failure a demo is most likely to hit.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-ink-50">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-xl border border-ink-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-ink-900">Casebook could not start</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-700/70">
              The workspace failed to load. If this keeps happening, the local database may need to be
              rebuilt.
            </p>
            {error.digest && (
              <p className="mt-3 text-xs text-ink-700/50">
                Reference: <span className="font-mono">{error.digest}</span>
              </p>
            )}
            <div className="mt-6">
              <Button onClick={() => window.location.reload()}>Reload</Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
