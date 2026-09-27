import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

/**
 * The signed-in bounce lives here, not in `src/middleware.ts`.
 *
 * Middleware runs on the edge runtime and cannot reach the session store, so all it can see
 * is whether a session cookie is present. Acting on that — sending anyone holding a cookie
 * away from this page — assumed presence meant a valid session, and a stale token turned that
 * assumption into an endless redirect between here and `/`, with the sign-in form unreachable.
 * This is the first layer that can actually resolve the token, so this is where the decision
 * belongs: a real session skips the form, and a token that no longer resolves renders it.
 */
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginForm />;
}
