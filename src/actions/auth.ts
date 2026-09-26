"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  findUserByEmail,
  createSession,
  deleteSessionByTokenHash,
  pruneExpiredSessions,
} from "@/lib/db/repo";
import { verifyPassword } from "@/lib/auth/password";
import {
  newSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionCookie,
  hashToken,
  sessionTtlDays,
} from "@/lib/auth/session";
import { MS_DAY } from "@/lib/utils/format";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const user = findUserByEmail(db, email);
  const ok = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return { error: "Invalid email or password." };
  }
  pruneExpiredSessions(db);
  const { raw, hash } = newSessionToken();
  createSession(db, user.id, hash, sessionTtlDays() * MS_DAY);
  await setSessionCookie(raw);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionCookie();
  if (token) {
    const db = getDb();
    deleteSessionByTokenHash(db, hashToken(token));
  }
  await clearSessionCookie();
  redirect("/login");
}
