import { loadEnv } from "./load-env";
import { newSessionToken, sessionTtlDays } from "@/lib/auth/session";
import { createSession, findUserByEmail } from "@/lib/db/repo";

async function main() {
  loadEnv();
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const user = findUserByEmail(db, "demo@omanta.dev");
  if (!user) throw new Error("demo user missing");
  const { raw, hash } = newSessionToken();
  createSession(db, user.id, hash, sessionTtlDays() * 86400_000);
  process.stdout.write(raw + "\n");
}
main();
