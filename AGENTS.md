# AGENTS.md — Working Agreement for Casebook

This file is the contract for any human or AI agent changing this repository. Read it before
editing code. It exists because this app is developed conversationally ("vibecoded"): the
only thing standing between a plausible-looking change and a broken app is a gate that nobody
is allowed to skip.

---

## 1. The one rule

**No change is finished until `npm run verify` passes, clean, on the whole repo.**

If the gate fails, the change is not done. Fix the failure or, if the failure is pre-existing
and genuinely unrelated, say so explicitly in your report with the exact command output. Never
quietly narrow the gate, add `eslint-disable` to make a warning disappear, delete a failing
test, or skip a step "just this once".

---

## 2. The gate

```bash
npm run verify
```

It runs five steps in order and stops at the first failure:

| Step      | Command                | Catches                                                        |
| --------- | ---------------------- | -------------------------------------------------------------- |
| 1. Format | `npm run format:check` | Files not matching Prettier style                              |
| 2. Lint   | `npm run lint`         | `eslint .` — React/Next/TS rules, unused code, unsafe patterns |
| 3. Types  | `npm run typecheck`    | `tsc --noEmit` across app, scripts, and tests                  |
| 4. Tests  | `npm run test`         | `vitest run` — the full suite, no watch mode                   |
| 5. Build  | `npm run build`        | `next build` — the real production compile                     |

A green `npm test` alone is **not** sufficient. A green build alone is **not** sufficient.
Lint warnings are treated as failures for anything you introduced.

Useful while iterating:

```bash
npm run format        # rewrite files with Prettier
npm run lint:fix      # autofix what ESLint can fix
npm run test:watch    # tests while editing
npm run dev           # local app at http://localhost:3000
```

Order of work: run `npm run format` early and often (it is cheap and makes diffs readable),
run the full `npm run verify` at the end.

---

## 3. What this application is

- A **self-hosted research workspace** for casework: a researcher uploads data, records the
  analyses they run, notes what they concluded, cites the evidence, and generates a report.
  The focus is DNA and oncology; the workflow suits any data investigation.
- **Not** a clinical tool. **Not** a diagnostic or decision-support system.
- The **seeded** demo content is synthetic and deidentified. Content the owner uploads is their own
  data — the app does not mark it synthetic, because it cannot know its provenance. See
  `.planning/PROJECT.md` and `.planning/ASSUMPTIONS.md` (especially #21) for the constraint set.

### Non-negotiable safety rules

1. **Never wire in real data as part of the project.** The project must not connect to a real
   patient, a real identifier, or a real clinical data source, and no fixture, seed, or test may
   contain real health information. This is about what the _project_ introduces — it is not a claim
   that the app is incapable of holding a researcher's own files, which is its whole purpose. When
   describing content, report its actual provenance: a seeded item is synthetic, an uploaded item
   is the researcher's own, and the app does not guess.
2. **No compliance claims.** Do not write "HIPAA compliant", "HIPAA-ready", "secure", or
   "production-ready for healthcare" in UI copy, code comments, docs, or commit messages. There is no
   compliance program and none is planned. Describe what the code does, and where the app's
   protections stop, say so plainly.
3. **Authorized access on every read and write.** Every data path starts with
   `requireUser()` (or equivalent session check) and then scopes the query to records the
   user may access. Session cookies are `httpOnly` and `sameSite=lax`; passwords are hashed
   with bcrypt. Do not weaken any of this.
4. **Never log or commit secrets.** No tokens, passwords, or `.env` contents in code, logs,
   fixtures, or planning documents. `.env` stays gitignored.
5. **File bytes are served through the app**, never from a public path. `/api/files/[id]`
   authorizes the requester before streaming.
6. **Report content is not a clinical document.** Reports are drafts until finalized and are
   labeled accordingly.

---

## 4. Architecture map

```
src/
  app/            Next.js App Router. Pages and route handlers. Mostly server components.
    api/files/    Authorized file streaming (the only route handler today).
  actions/        Server Actions: the write path for mutations. Validate, then call repo.
  components/
    ui/           Primitives: button, card, badge, form, empty-state. Design-system only.
    layout/       AppShell: chrome, nav, session controls, environment disclosure.
    workspace/    Feature components for the case workflow.
    dashboard/    Program/patient list UI.
    onboarding/   First-run tour (client component, localStorage-backed).
  lib/
    db/           Drizzle schema + repo functions. All queries live here.
    auth/         Password hashing and session helpers.
    server/       Server-only guards (requireUser).
    files/        Limits, mime allowlist, parsing, storage adapter.
    report/       Report assembly and rendering.
    seed/         Synthetic dataset definition and insertion.
    browser/      Client-safe storage helpers.
scripts/          setup.ts, seed.ts (run via tsx).
drizzle/          Generated SQL migrations.
.planning/        GSD planning: PROJECT, ROADMAP, STATE, ASSUMPTIONS, phases/.
```

Rules that follow from that layout:

- **All SQL lives in `src/lib/db/repo.ts`**, parameterized. The sanctioned exceptions are
  `src/actions/patient.ts` (one templated update) and `src/app/api/files/[id]/route.ts`
  (one authorization lookup). Do not add new ad-hoc queries in pages or components; add a
  repo function instead. Never interpolate user input into SQL.
- **Server Components by default.** Add `"use client"` only for interactivity (state, effects,
  event handlers). Pages currently render on the server; do not move them client-side for
  convenience.
- **Mutations go through Server Actions** in `src/actions/`, which validate with Zod before
  touching the repo.
- **Styling is Tailwind with the existing design tokens** (`ink-*`, `brand-*`, semantic
  `danger/success/warning` scales). Reuse `src/components/ui` primitives. Do not introduce
  inline `style={{}}`, a second CSS system, or new arbitrary color values.
- **Icons come from `lucide-react`**, sized `size-4` in body text and `size-5`+ in headings.

---

## 5. Interface principles

This app is intentionally **simple, minimal, and quiet**. When adding UI:

1. **Documentation is on demand, never an obstacle.** Explain a workflow when the user first
   meets it, or from the `Help` control in the shell. Do not litter pages with instructions
   the user has to dismiss.
2. **One place per fact.** The synthetic-data disclosure lives in the app shell; the report
   warning lives on the report. Do not repeat either inside page bodies.
3. **Cut prose that restates the heading.** Empty states get a short title and one clear
   action — not a paragraph explaining the screen. Move detail to Help.
4. **Functional constraints stay at the point of action** (file types, size limits, required
   fields). Those are not documentation; they are guardrails.
5. **No decorative chrome.** No banner that says the same thing every visit, no fake
   verification steps, no marketing copy on working screens.
6. **Accessible by default:** semantic elements, labelled controls, visible focus, and
   keyboard-reachable actions. An icon-only control needs an accessible name.
7. **Empty, loading, and error states are part of the feature.** A new page ships with all
   three, and they are tested.

---

## 6. Testing rules

- Tests live next to the code they cover (`*.test.ts`) or in the mirrored path. Runner is
  Vitest.
- **Pure logic must have a unit test**: file parsing and limits, report generation, storage
  path handling, onboarding/browser storage, password hashing, and repo queries.
- **Anything touching the database needs an integration test** against a real database, not a
  mock. Phase 2 adds a second PostgreSQL leg: the same suite must pass on SQLite and
  PostgreSQL.
- **Authorization needs a negative test.** For every new read or write path, assert that a
  user without access is rejected. A test that only proves the happy path does not count as
  coverage of that path.
- **UI behavior that matters gets a test.** Non-obvious client state (the onboarding tour,
  read/unread toggles, job status transitions) is tested; pure visual styling is not.
- Add a regression test with every bug fix. Name tests after behavior, not implementation.
- Never lower coverage by deleting or skipping a test. If a test is genuinely obsolete,
  say so in your report and replace it.

---

## 7. Data, migrations, and storage

- Schema changes are made in `src/lib/db/schema.ts`, then `npm run db:generate`. Never edit
  files in `drizzle/` by hand; never use `db:push` against anything but a local scratch
  database.
- Seed data is synthetic by construction. `npm run setup` builds the local database and
  seeds it; `npm run seed` reseeds.
- Uploaded files go through the `src/lib/files/storage.ts` adapter. Do not call `fs` directly
  from a page or action. Enforce `src/lib/files/limits.ts` and the mime allowlist on every
  upload path.
- Phase 2 introduces an S3-compatible implementation behind the same interface, a PostgreSQL
  production target, and a fresh dialect-agnostic seed. Keep SQLite working while that lands.

---

## 8. Documentation is part of the feature

A stale document is a defect, not a chore for later. Update docs in the same change as the
code they describe.

| Document                           | Update it when                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `README.md`                        | Scripts, commands, status, features, or the roadmap change                      |
| `docs/ARCHITECTURE.md`             | Schema, data flow, ownership rules, directory layout, or the raw-SQL map change |
| `AGENTS.md`                        | The gate, conventions, or house rules change                                    |
| `.planning/STATE.md`               | Work starts, moves, finishes, or gets blocked                                   |
| `.planning/phases/*/NN-CONTEXT.md` | A decision is made, reversed, or discovered mid-build                           |
| `src/lib/help-content.ts`          | A workflow, upload rule, status, or lifecycle the guide explains changes        |

Rules:

- A new feature ships with its documentation. Do not open a follow-up "write the docs" task.
- Keep the plain-English promise: `docs/ARCHITECTURE.md` must stay readable by a non-engineer,
  and `README.md` must be enough to run the app from a clean clone.
- Do not document a capability that does not exist yet. Planned work belongs in
  `.planning/ROADMAP.md` and `NN-CONTEXT.md`, written as intent — never as shipped behavior. The in-app
  guide at `/help` is held to the same rule, and its test enforces it.
- Commands in docs must be commands that exist in `package.json`. Do not invent flags.

---

## 9. Definition of done

A task is complete when all of these are true:

- [ ] `npm run verify` passes clean (format, lint, types, tests, build).
- [ ] New behavior is covered by tests, including the unauthorized-access case where relevant.
- [ ] No duplicate UI copy, no new prose that restates a heading, no redundant banner.
- [ ] Errors are handled at the boundary the user actually sees them.
- [ ] No secrets, no real patient data, no compliance claims introduced.
- [ ] Docs that describe the changed area are updated in this same change (see §8).
- [ ] `.planning/STATE.md` and the relevant `phases/*/CONTEXT.md` reflect reality if scope,
      decisions, or status changed.
- [ ] The report states what changed, what was verified, and what was deliberately left out.

---

## 10. Planning workflow

`.planning/` is the source of truth for scope, not code.

- `PROJECT.md` — product constraints and stack. `ROADMAP.md` — phase order and boundaries.
- `STATE.md` — current phase, what is in flight, what is next. **Update it when work moves.**
- `ASSUMPTIONS.md` — numbered assumptions. Add a new number rather than editing history.
- `phases/<nn>-<slug>/NN-CONTEXT.md` — decisions for that phase, written before the code.
- `phases/<nn>-<slug>/NN-DISCUSSION-LOG.md` — alternatives considered and why they lost.
- Do not start work that belongs to a later phase. Do not silently widen a phase; either
  narrow the change or add a phase through the roadmap tooling.

---

## 11. Environment notes

- **WSL2 + native bindings.** npm sometimes fails to install optional native deps here. The
  Linux binding for Rolldown (used by Vitest) is pinned as an explicit devDependency so
  `npm run verify` works reliably. If a native module breaks again, install the matching
  binding as a real devDependency, not with `--no-save`.
- **Docker Desktop** must have WSL integration enabled before the PostgreSQL/MinIO leg of
  Phase 2 can run. The daemon is not always reachable from WSL.
- The prototype is pinned to old, stable versions on purpose (Next 15.5, React 19.3, Tailwind
  3.4). Do not upgrade dependencies as a side effect of another task. Upgrades are their own
  task, with a full `npm run verify` before and after.

---

## 12. Do not

- Do not skip, narrow, or reorder the gate steps.
- Do not add a dependency without a stated reason in your report.
- Do not leave commented-out code, `TODO`s without an owner, or dead files.
- Do not introduce a second source of truth for data access, styling, or validation.
- Do not claim a feature is verified without pasting the command that proves it.
