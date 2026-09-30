"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/actions/auth";
import { BrandMark } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Dna, Lock, Mail } from "lucide-react";

/**
 * The sign-in form. Interactive, so it is a client component; the decision about whether to
 * show it at all belongs to the server-rendered page that renders this.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(loginAction, {});

  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-xl font-medium leading-none tracking-tight text-white">Casebook</span>
        </div>
        <div className="max-w-md">
          <p className="text-4xl font-normal leading-[1.2] tracking-tight text-white">
            A research workspace organized around every patient and their investigation.
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-ink-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-xl font-medium leading-none tracking-tight text-ink-900">Casebook</span>
          </div>
          <h1 className="text-3xl font-normal tracking-tight text-ink-900">Sign in</h1>
          <p className="mt-2 text-sm text-ink-700/70">
            Researcher access. Accounts are created by running the seed script locally.
          </p>
          <form action={formAction} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email?.[0]}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-700/40" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@institute.org"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="password" required error={state.fieldErrors?.password?.[0]}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-700/40" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
            </Field>
            {state.error && <div className="field-error">{state.error}</div>}
            <Button type="submit" disabled={pending} className="w-full" size="lg">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-brand-300/50 bg-brand-50 p-4 text-sm">
            <div className="flex items-center gap-1.5 font-medium uppercase tracking-wide text-brand-900">
              <Dna className="size-4" /> Demo access
            </div>
            <p className="mt-1.5 text-brand-800/90">
              Representative researcher account is pre-seeded with a demo program catalog.
            </p>
            <pre className="mt-3 rounded-lg bg-white px-3 py-2.5 text-xs leading-relaxed text-ink-700">
              demo@example.com
              <br />
              demo-password
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
