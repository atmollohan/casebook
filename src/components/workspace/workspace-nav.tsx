"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  FlaskConical,
  Lightbulb,
  BookOpenText,
  FileText,
  History,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

const items = [
  { href: "/cases/[id]", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/cases/[id]/data", label: "Research data", icon: Database },
  { href: "/cases/[id]/activities", label: "Activities", icon: FlaskConical },
  { href: "/cases/[id]/findings", label: "Findings", icon: Lightbulb },
  { href: "/cases/[id]/evidence", label: "Evidence & sources", icon: BookOpenText },
  { href: "/cases/[id]/reports", label: "Reports", icon: FileText },
  { href: "/cases/[id]/history", label: "History", icon: History },
];

export function WorkspaceNav() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const base = `/cases/${params.id}`;

  return (
    <nav className="flex w-full flex-row gap-1 overflow-x-auto border-b border-ink-200/70 pb-px sm:flex-col sm:border-b-0 sm:pb-0">
      {items.map((item) => {
        const href = item.href.replace("[id]", params.id);
        const active = item.exact ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-800"
                : "text-ink-700/80 hover:bg-ink-100/70 hover:text-ink-900",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
