import { loadEnv, dbFile } from "./load-env";
import fs from "node:fs";
import path from "node:path";

async function main() {
  loadEnv();

  const file = dbFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const needsMigrate = !fs.existsSync(file);
  const { migrateDb } = await import("@/lib/db");
  const { getDb } = await import("@/lib/db");
  if (needsMigrate) {
    migrateDb(getDb());
  }

  const { runSeed } = await import("@/lib/seed");
  const user = runSeed();
  console.log(
    `Seed complete. Demo researcher: ${user.name} (${process.env.DEMO_EMAIL ?? "demo@example.com"}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
