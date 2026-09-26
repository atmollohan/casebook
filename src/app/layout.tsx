import type React from "react";
import { getCurrentUser } from "@/lib/server/auth";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: {
    default: "Omanta Lab · Research Programs",
    template: "%s · Omanta Lab",
  },
  description:
    "Omanta Lab is a collaborative research workspace for patient programs. Prototype uses synthetic data only.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{user ? <AppShell user={user}>{children}</AppShell> : <>{children}</>}</body>
    </html>
  );
}
