import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { hashToken, getSessionCookie } from "@/lib/auth/session";
import { users, sessions, type User } from "@/lib/db/schema";

export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const db = getDb();
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .get();
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    db.delete(sessions).where(eq(sessions.id, session.id)).run();
    return null;
  }
  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
