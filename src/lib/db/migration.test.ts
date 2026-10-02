/**
 * The migration from `patients` to `cases` moves an instance's own data, so it gets the test
 * AGENTS.md requires: build the *previous* schema, insert rows, apply the migration, and
 * assert the rows are still there and still authorized.
 *
 * The migration is hand-written (see the header of `drizzle/0001_silky_turbo.sql` for why),
 * which makes this the only thing standing between it and a silent data loss. The generated
 * version of the same change was "create `cases`, drop `patients`" — every row gone, and the
 * copy statement selected a column that did not exist at that point in the script.
 *
 * This runs against a real SQLite file rather than the shared in-memory connection, because
 * the point is the SQL as written: a real migrator, real transactions, real foreign keys.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const MIGRATIONS = path.resolve(process.cwd(), "drizzle");
const ENTRY_0000 = "0000_unique_living_turbunal";
const ENTRY_0001 = "0001_silky_turbo";

let tmp: string;

function makeDb(file: string) {
  return drizzle(new Database(file), {});
}

function journalWithoutLast() {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, -1);
  return journal;
}

/**
 * Migrate a database up to `0000` only, by pointing the migrator at a temp folder holding
 * that one migration and a journal that lists only it.
 */
function migrateToPreviousSchema(target: string) {
  const stage = path.join(tmp, `stage-${path.basename(target)}`);
  fs.mkdirSync(path.join(stage, "meta"), { recursive: true });
  fs.copyFileSync(path.join(MIGRATIONS, `${ENTRY_0000}.sql`), path.join(stage, `${ENTRY_0000}.sql`));
  fs.writeFileSync(path.join(stage, "meta", "_journal.json"), JSON.stringify(journalWithoutLast()));
  migrate(makeDb(target), { migrationsFolder: stage });
}

/** Apply the real migration as the migrator would, in its transaction. */
function migrateToCurrentSchema(target: string) {
  migrate(makeDb(target), { migrationsFolder: MIGRATIONS });
}

/** Apply the real migration body, for the in-transaction foreign-key assertions. */
function applyMigrationSql(target: string) {
  const sql = fs
    .readFileSync(path.join(MIGRATIONS, `${ENTRY_0001}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  const conn = new Database(target);
  conn.pragma("foreign_keys = ON");
  conn.transaction(() => {
    for (const statement of sql) conn.exec(statement);
  })();
  conn.close();
}

function fresh(name: string) {
  const file = path.join(tmp, `${name}.db`);
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}-wal`, { force: true });
  fs.rmSync(`${file}-shm`, { force: true });
  return file;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "casebook-migration-"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("the patients → cases migration", () => {
  it("keeps every row, every child row, and every fact that was recorded before it", () => {
    const file = fresh("preserved");
    migrateToPreviousSchema(file);

    const before = new Database(file);
    before.pragma("foreign_keys = ON");
    before
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    before
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_other", "other@test.dev", "Other", "hash", 1000);
    before
      .prepare(
        `insert into patients
           (id, pid, owner_id, first_name, last_name, birth_year, sex, condition_summary, consent_status, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        "pat_1",
        "CB-P-0001",
        "usr_owner",
        "Ada",
        "Lovelace",
        1979,
        "female",
        "Refractory course; TP53 focus",
        "consented",
        1000,
        1000,
      );
    // Every optional column null, which is the case json_remove exists for. `consent_status`
    // is NOT NULL with a default, so it is left to the default rather than passed as null.
    before
      .prepare(
        `insert into patients
           (id, pid, owner_id, first_name, last_name, birth_year, sex, condition_summary, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run("pat_2", "CB-P-0002", "usr_owner", "", "", null, null, null, 1000, 1000);
    before
      .prepare(
        "insert into research_programs (id, patient_id, title, description, hypothesis, focus_area, status, created_at, updated_at) values (?,?,?,?,?,?,?,?,?)",
      )
      .run("prg_1", "pat_1", "TP53 disruption", "Scope", "Hypothesis", "Genomics", "active", 1000, 1000);
    // A grandchild: the cascade is the failure mode the hand-written migration exists to avoid.
    before
      .prepare(
        "insert into research_activities (id, program_id, created_by_id, title, activity_type, description, status, created_at, updated_at) values (?,?,?,?,?,?,?,?,?)",
      )
      .run("act_1", "prg_1", "usr_owner", "Assess burden", "analysis", "Desc", "completed", 1000, 1000);
    before.close();

    migrateToCurrentSchema(file);

    const after = new Database(file);
    const cases = after.prepare("select * from cases order by id").all() as Record<string, unknown>[];
    expect(cases).toHaveLength(2);

    // The two name columns collapse into one display name.
    const migrated = cases.find((c) => c.id === "pat_1")!;
    expect(migrated.title).toBe("Ada Lovelace");
    expect(migrated.code).toBe("CB-C-0001");
    expect(migrated.owner_id).toBe("usr_owner");
    expect(migrated.summary).toBe("Refractory course; TP53 focus");
    expect(migrated.kind).toBe("subject");
    // The clinical columns become owner-supplied attributes rather than being dropped.
    expect(JSON.parse(migrated.attributes_json as string)).toEqual({
      "Birth year": "1979",
      Sex: "Female",
      "Consent status": "Consent on file",
    });

    // The child rows survive, under the renamed foreign key.
    const programs = after.prepare("select * from research_programs").all() as Record<string, unknown>[];
    expect(programs).toHaveLength(1);
    expect(programs[0].case_id).toBe("pat_1");
    expect(after.prepare("select * from research_activities").all()).toHaveLength(1);

    after.close();
  });

  it("records only the facts that were actually filled in", () => {
    const file = fresh("sparse");
    migrateToPreviousSchema(file);

    const before = new Database(file);
    before
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    before
      .prepare(
        `insert into patients
           (id, pid, owner_id, first_name, last_name, birth_year, sex, condition_summary, consent_status, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        "pat_1",
        "CB-P-0002",
        "usr_owner",
        "Okafor",
        "Patricia",
        null,
        "female",
        null,
        "consented",
        1000,
        1000,
      );
    before.close();

    migrateToCurrentSchema(file);

    const after = new Database(file);
    const row = after.prepare("select * from cases where id = ?").get("pat_1") as Record<string, unknown>;
    // json_object materializes a key for every argument, nulls included. A null birth year
    // must not survive as "Birth year": null, or a reader sees a fact that was never recorded.
    const attributes = JSON.parse(row.attributes_json as string) as Record<string, unknown>;
    expect(attributes).toEqual({ Sex: "Female", "Consent status": "Consent on file" });
    expect(Object.values(attributes)).not.toContain(null);
    expect(row.summary).toBeNull();
    after.close();
  });

  it("keeps the numeric part of every code, so old references still resolve", () => {
    const file = fresh("codes");
    migrateToPreviousSchema(file);

    const before = new Database(file);
    before
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    for (const [id, code] of [
      ["pat_1", "CB-P-0001"],
      ["pat_2", "CB-P-0042"],
    ] as const) {
      before
        .prepare(
          `insert into patients
             (id, pid, owner_id, first_name, last_name, condition_summary, created_at, updated_at)
           values (?,?,?,?,?,?,?,?)`,
        )
        .run(id, code, "usr_owner", "A", "B", "s", 1000, 1000);
    }
    before.close();

    migrateToCurrentSchema(file);

    const after = new Database(file);
    const codes = (after.prepare("select code from cases order by code").all() as { code: string }[]).map(
      (r) => r.code,
    );
    expect(codes).toEqual(["CB-C-0001", "CB-C-0042"]);
    // The uniqueness the create path depends on is still enforced, not merely implied.
    expect(() =>
      after
        .prepare(`insert into cases (id, code, owner_id, title, created_at, updated_at) values (?,?,?,?,?,?)`)
        .run("pat_3", "CB-C-0001", "usr_owner", "Dup", 1000, 1000),
    ).toThrow(/unique/i);
    after.close();
  });

  it("leaves every migrated case owned by the researcher who created it", () => {
    // Authorization is not carried by the migration; it is carried by owner_id. This asserts
    // the column the ownership check reads still says who owned the case, after the rename.
    const file = fresh("ownership");
    migrateToPreviousSchema(file);

    const before = new Database(file);
    before
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    before
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_stranger", "stranger@test.dev", "Stranger", "hash", 1000);
    before
      .prepare(
        `insert into patients
           (id, pid, owner_id, first_name, last_name, condition_summary, created_at, updated_at)
         values (?,?,?,?,?,?,?,?)`,
      )
      .run("pat_1", "CB-P-0001", "usr_owner", "Ada", "Lovelace", "s", 1000, 1000);
    before
      .prepare(
        "insert into research_programs (id, patient_id, title, status, created_at, updated_at) values (?,?,?,?,?,?)",
      )
      .run("prg_1", "pat_1", "Program", "active", 1000, 1000);
    before.close();

    migrateToCurrentSchema(file);

    const after = new Database(file);
    // The query `findCaseById` runs: a case is visible to its owner and to nobody else.
    const ownersCase = after
      .prepare("select * from cases where id = ? and owner_id = ?")
      .get("pat_1", "usr_owner");
    expect(ownersCase).toBeTruthy();
    expect(
      after.prepare("select * from cases where id = ? and owner_id = ?").get("pat_1", "usr_stranger"),
    ).toBeUndefined();
    // And the program it owned is still reachable by joining through the renamed key.
    const joined = after
      .prepare(
        `select rp.id as program_id, c.id as case_id, c.owner_id
           from research_programs rp join cases c on c.id = rp.case_id
          where rp.id = ? and c.owner_id = ?`,
      )
      .get("prg_1", "usr_owner");
    expect(joined).toMatchObject({ program_id: "prg_1", case_id: "pat_1", owner_id: "usr_owner" });
    expect(
      after
        .prepare(
          `select rp.id from research_programs rp join cases c on c.id = rp.case_id
            where rp.id = ? and c.owner_id = ?`,
        )
        .get("prg_1", "usr_stranger"),
    ).toBeUndefined();
    after.close();
  });

  it("never drops a table, so the cascade that would delete child rows cannot fire", () => {
    // The failure this migration is written to avoid: `PRAGMA foreign_keys = OFF` is a no-op
    // inside a transaction, and the migrator runs every migration in one. A DROP TABLE in
    // this file would cascade and take the child rows with it. Asserted against the file so
    // a future edit to a generated migration cannot reintroduce it silently.
    const sql = fs.readFileSync(path.join(MIGRATIONS, `${ENTRY_0001}.sql`), "utf8");
    expect(sql).not.toMatch(/^\s*DROP\s+TABLE/im);
    // The single DROP INDEX statements are fine: an index is not a row.
    expect(sql).toMatch(/DROP INDEX IF EXISTS/i);
  });

  it("is idempotent against a database the migrator has already brought forward", () => {
    const file = fresh("already-current");
    migrateToCurrentSchema(file);
    // Running the migrator again must be a no-op, not an error and not a second backfill.
    expect(() => migrateToCurrentSchema(file)).not.toThrow();

    const conn = new Database(file);
    conn
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    conn
      .prepare(
        `insert into cases (id, code, owner_id, title, subtitle, kind, summary, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?)`,
      )
      .run("cas_1", "CB-C-0001", "usr_owner", "A case", "sub", "device", "s", 1000, 1000);
    conn.close();
    expect(() => migrateToCurrentSchema(file)).not.toThrow();
  });

  it("applies cleanly when run inside a transaction, with foreign keys enforced", () => {
    // The real migrator wraps each file in a transaction, and `foreign_keys = OFF` does
    // nothing once one is open. This runs the SQL exactly that way, with the pragma on.
    const file = fresh("in-transaction");
    migrateToPreviousSchema(file);

    const conn = new Database(file);
    conn
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    conn
      .prepare(
        `insert into patients
           (id, pid, owner_id, first_name, last_name, birth_year, sex, condition_summary, consent_status, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        "pat_1",
        "CB-P-0001",
        "usr_owner",
        "Ada",
        "Lovelace",
        1979,
        "female",
        "s",
        "consented",
        1000,
        1000,
      );
    conn
      .prepare(
        "insert into research_programs (id, patient_id, title, status, created_at, updated_at) values (?,?,?,?,?,?)",
      )
      .run("prg_1", "pat_1", "Program", "active", 1000, 1000);
    conn.close();

    applyMigrationSql(file);

    const after = new Database(file);
    expect(after.prepare("select count(*) as n from research_programs").get()).toEqual({ n: 1 });
    expect(after.prepare("select title from cases where id = ?").get("pat_1")).toEqual({
      title: "Ada Lovelace",
    });
    // The renamed foreign key is still enforced: an orphan program is refused.
    expect(() =>
      after
        .prepare(
          "insert into research_programs (id, case_id, title, status, created_at, updated_at) values (?,?,?,?,?,?)",
        )
        .run("prg_2", "pat_missing", "Orphan", "active", 1000, 1000),
    ).toThrow(/foreign key/i);
    after.close();
  });

  it("still lets the repo read a migrated case through the current schema", () => {
    // The end of the chain: not just that the rows survived, but that the code the app runs
    // against the new schema can select them. `cases` is the shape `listProgramsForResearcher`
    // joins on, and `case_id` is the key the whole ownership check hangs off.
    const file = fresh("repo-shape");
    migrateToPreviousSchema(file);

    const conn = new Database(file);
    conn
      .prepare("insert into users (id, email, name, password_hash, created_at) values (?,?,?,?,?)")
      .run("usr_owner", "owner@test.dev", "Owner", "hash", 1000);
    conn
      .prepare(
        `insert into patients
           (id, pid, owner_id, first_name, last_name, birth_year, sex, condition_summary, consent_status, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        "pat_1",
        "CB-P-0007",
        "usr_owner",
        "Ada",
        "Lovelace",
        1979,
        "female",
        "s",
        "consented",
        1000,
        1000,
      );
    conn
      .prepare(
        "insert into research_programs (id, patient_id, title, status, created_at, updated_at) values (?,?,?,?,?,?)",
      )
      .run("prg_1", "pat_1", "Program", "active", 1000, 1000);
    conn.close();

    migrateToCurrentSchema(file);

    const migrated = makeDb(file);
    // The join the dashboard list performs, restricted to one owner.
    const rows = migrated.$client
      .prepare(
        `select c.id as case_id, c.code, c.title, c.subtitle, c.kind, c.attributes_json,
                rp.id as program_id, rp.title as program_title
           from research_programs rp
           join cases c on c.id = rp.case_id
          where c.owner_id = ?
          order by rp.created_at desc`,
      )
      .all("usr_owner") as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      case_id: "pat_1",
      code: "CB-C-0007",
      title: "Ada Lovelace",
      kind: "subject",
      program_id: "prg_1",
      program_title: "Program",
    });
    const attributes = JSON.parse(rows[0].attributes_json as string);
    expect(attributes.Sex).toBe("Female");
    migrated.$client.close();
  });
});
