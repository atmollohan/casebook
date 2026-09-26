import fs from "node:fs";
import path from "node:path";
import { loadEnv, dbFile } from "./load-env";

async function main() {
  loadEnv();

  const file = dbFile();
  for (const f of [file, `${file}-wal`, `${file}-shm`]) {
    if (fs.existsSync(f)) {
      fs.rmSync(f, { force: true });
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const storage = path.resolve(
    process.cwd(),
    process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0 ? process.env.DATA_DIR : "./data/storage",
  );
  fs.rmSync(storage, { recursive: true, force: true });
  fs.mkdirSync(storage, { recursive: true });

  const { migrateDb } = await import("@/lib/db");
  const { getDb } = await import("@/lib/db");
  migrateDb(getDb());

  const { runSeed } = await import("@/lib/seed");
  runSeed();

  console.log(`\nDatabase ready at ${file}`);
  console.log("Signed in as the seeded demo researcher when you log in.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
