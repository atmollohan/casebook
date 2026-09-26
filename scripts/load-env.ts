import fs from "node:fs";
import path from "node:path";
import { resolve } from "node:path";

export function loadEnv() {
  const envFile = resolve(process.cwd(), ".env");
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function dbFile(): string {
  const configured = process.env.DATABASE_FILE;
  return path.resolve(
    process.cwd(),
    configured && configured.trim().length > 0 ? configured : "./data/omanta.db",
  );
}
