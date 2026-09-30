import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

function resolveDbFile(): string {
  const configured = process.env.DATABASE_FILE;
  const file = configured && configured.trim().length > 0 ? configured : "./data/casebook.db";
  return path.resolve(process.cwd(), file);
}

let cached: ReturnType<typeof createDb> | null = null;

function createDb() {
  const file = process.env.TEST_DATABASE === "memory" ? ":memory:" : resolveDbFile();
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db, file };
}

export type Db = ReturnType<typeof createDb>["db"];

/** Raw better-sqlite3 handle for ad-hoc SQL. */
export function getClient(db: Db): Database.Database {
  return db.$client;
}

export function migrateDb(db: Db) {
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
}

export function getDb(): Db {
  if (!cached) {
    cached = createDb();
  }
  return cached.db;
}

/** Close the underlying connection (used by tests). */
export function closeDb() {
  if (cached) {
    cached.sqlite.close();
    cached = null;
  }
}

/** Point the data layer at a fresh DB (tests / reset). */
export function resetDb() {
  closeDb();
}

export { schema };
