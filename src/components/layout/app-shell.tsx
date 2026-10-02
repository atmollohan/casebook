import type { User } from "@/lib/db/schema";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/actions/auth";
import { Dna, FlaskConical, LogOut, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex size-9 items-center justify-center border border-brand-600/30 bg-ink-50 text-brand-700 ${className}`}
    >
      <Dna className="size-4.5" strokeWidth={1.75} />
    </span>
  );
}

/**
 * The single persistent home of the synthetic-data statement. The full wording is
 * disclosure-on-demand so it stays visible without competing with the work. It separates
 * the seeded demo content from anything the researcher uploads, because only the former is
 * synthetic and this instance is expected to hold real files.
 */
export function SyntheticDataNotice() {
  return (
    <details className="group relative">
      <summary
        className="focus-ring flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 [&::-webkit-details-marker]:hidden"
        title="About the seeded demo data"
      >
        <FlaskConical className="size-3.5" />
        <span className="hidden sm:inline">Synthetic demo data</span>
        <span className="sm:hidden">Demo</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-amber-200 bg-white p-3 text-[13px] leading-relaxed text-ink-700 shadow-lg">
        The patients, files, findings, and reports that ship with this app are{" "}
        <strong className="text-ink-900">synthetic and deidentified</strong>, for trying the workflow out.
        Anything you upload yourself is your own data and is not marked synthetic. Casebook is not a clinical
        system and its output is not suitable for clinical decision-making.
      </div>
    </details>
  );
}

export function LogoutButton({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2.5 sm:flex">
        <Avatar name={user.name} />
        <div className="leading-tight">
          <div className="text-sm font-medium text-ink-900">{user.name}</div>
          <div className="text-xs text-ink-700/60">{user.title ?? "Researcher"}</div>
        </div>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          title="Sign out"
          className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-ink-700/70 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <LogOut className="size-4.5" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="print-hide sticky top-0 z-30 border-b border-ink-200/70 bg-ink-50/90 backdrop-blur">
        <div className="h-1 bg-brand-600" />
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg">
            <BrandMark />
            <span className="text-[19px] font-medium leading-none tracking-tight text-ink-900">Casebook</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <SyntheticDataNotice />
            <ButtonLink
              href="/help"
              variant="ghost"
              size="sm"
              aria-label="Help and documentation"
              className="shrink-0"
            >
              Help
            </ButtonLink>
            <ButtonLink href="/cases/new" variant="secondary" size="sm" icon={<Plus className="size-4" />}>
              <span className="hidden sm:inline">New patient program</span>
              <span className="sm:hidden">New</span>
            </ButtonLink>
            <LogoutButton user={user} />
          </div>
        </div>
      </header>
      <main className="py-8">{children}</main>
    </div>
  );
}
