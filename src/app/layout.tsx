import type React from "react";
import { getCurrentUser } from "@/lib/server/auth";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: {
    default: "Casebook · Research Programs",
    template: "%s · Casebook",
  },
  description:
    "Casebook is a self-hosted workspace for genomic casework: upload data, record the analysis, cite the evidence, generate a report.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{user ? <AppShell user={user}>{children}</AppShell> : <>{children}</>}</body>
    </html>
  );
}
