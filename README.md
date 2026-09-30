# Casebook

A self-hosted web app for working through a genomic case. You upload data files, record the analyses you
run, write down what you concluded, cite the evidence behind it, and generate a report at the end. The
focus is DNA and oncology, but the workflow — upload → analyze → conclude → cite → report — suits any
kind of data investigation.

> **Not a clinical tool.** Casebook is a research notebook, not a medical record and not a diagnostic or
> decision-support system. The demo data that ships with it is synthetic and deidentified, for trying the
> workflow out. Its output is not suitable for clinical decision-making.

## Why it exists

A home-lab version of a case workspace. One person, one machine, one SQLite file. No hosted service, no
account to create, no data leaving the box. If you want to keep a folder of a case's data, the analyses you
ran, and the report you wrote, this is the tool.

## Getting started

```bash
npm install
cp .env.example .env        # defaults are fine
npm run setup               # wipes ./data, migrates, and seeds the demo cases
npm run dev                 # http://localhost:3000
```

Sign in with the seeded researcher:

- **Email:** `demo@example.com`
- **Password:** `demo-password`

Other scripts: `npm run seed` (idempotent re-seed), `npm run db:studio` (Drizzle Studio), `npm run samples`
(regenerate the sample files), `npm run build && npm start` (production).

## What it does

0. **First-time tour** — a three-step welcome guide (`Directory → Data → Reports`) that appears once on the
   first dashboard visit. Progress is saved in browser storage, dismiss or skip at any point, and **Help**
   in the header replays it anytime.
1. **Sign in** — email/password (bcrypt-hashed), server-action based, httpOnly session cookie, middleware
   redirect.
2. **Cases** — dashboard listing every patient and their research program (status, hypothesis, asset
   counts).
3. **Workspace per patient** (7 tabs):
   - **Overview** — program summary, stats, latest findings, activity timeline, and a suggested next step.
   - **Research data** — upload CSV/TSV/VCF/JSON/TXT/FASTA/BED/GFF/PDF/PNG/JPG/XLSX/MD (≤25 MB), inline
     previews (table/JSON-syntax-highlighted text/image), download via an authenticated API route, delete.
   - **Activities** — log analyses (variant review, literature review, statistical analysis, …) with a
     hypothesis; walk them `planned → in_progress → completed`; record findings inline.
   - **Findings** — conclusions you recorded, with category and significance, optionally linked to an
     activity.
   - **Evidence & sources** — publications/databases/clinical records/datasets attached to findings
     (URL/DOI/note).
   - **Reports** — auto-assembled structured reports (patient overview, program, data index, activities,
     findings + evidence, history, methodology note); draft → mark final; print/save-as-PDF layout with
     print CSS.
   - **History** — immutable event trail of everything that happened in the program.
4. **New patient program** — create patient + program in one form; the workspace opens ready.

### Interface principles

The UI is deliberately quiet. Documentation is available on demand and never blocks a working screen:

- **One Help affordance** in the shell carries the walkthrough; there is no per-page instruction banner.
- **One synthetic-data disclosure** in the shell, with a per-report draft warning where it actually matters.
- **No prose that restates a heading.** Empty states are a short title and one clear action.
- **Constraints live at the point of action** — file types, size limits, and required fields stay next to
  the control.
- **Every route has a loading, error, and not-found state** (`src/app/{loading,error,global-error,not-found}.tsx`).
  A slow page shows a quiet skeleton that announces itself to screen readers; a failure explains itself in
  plain language with a retry and a support reference, and never shows internal error text.
- Prettier (with a Tailwind class-order plugin) owns formatting, so diffs stay readable.

## Domain model

10 tables (Drizzle, SQLite): `users`, `sessions`, `patients`, `research_programs`, `data_records`,
`research_activities`, `findings`, `evidence`, `reports`, `history_events`.

Key invariants:

- One researcher per instance; **proof of ownership enforced in the data layer** — every query/action checks
  `programAllowed()` (patient owner / program), so a patient's records can't leak across users.
- Every mutation writes a `history_events` row (timeline + report "Activity history" section).
- Patient IDs are `CB-P-0001…`; long IDs are `prefix_<uuid-ish>`.
- `data_records.is_synthetic` records provenance, not permission: the bundled seed sets it, the upload path
  clears it. A report only calls content synthetic when the flag says so.

## Architecture

- **Next.js 15 (App Router, TypeScript)** — server components for pages, `"use client"` only for
  interactive forms.
- **Tailwind CSS v3** design system: `ui/{button,badge,card,form,empty-state,avatar}`, brand teal palette,
  print CSS.
- **Drizzle ORM + better-sqlite3** — `src/lib/db/{index,schema,repo}.ts`. Migrations in `drizzle/`.
- **Server Actions** — one module per domain (`src/actions/{auth,patient,data,activities,findings,reports}.ts`),
  zod-validated, always guarded by `requireUser()`.
- **File handling** — `src/lib/files/{storage,mime,parse}.ts` with size/extension allowlists; previews parse
  CSV/TSV/VCF/JSON/text/markdown/images.
- **Report assembly** — `src/lib/report/generate.ts` produces a typed block model
  (`kv | p | list | table | note | quote | hr`) rendered by `/report/[id]`.
- **Plain-English system tour** — `docs/ARCHITECTURE.md` explains the data model and flows for
  non-engineers.

## Where your data lives

Everything is a file on disk, which is what makes this easy to back up and easy to lose.

| Thing            | Location                                                   |
| ---------------- | ---------------------------------------------------------- |
| Database         | `./data/casebook.db` (path set by `DATABASE_FILE`)         |
| Uploaded files   | `./data/storage/programs/<programId>/` (set by `DATA_DIR`) |
| Seeded demo data | regenerable at any time with `npm run setup`               |

**Back up** by copying the `data/` folder. **Moving to another machine** means copying the repo and that
folder, then pointing `DATABASE_FILE` and `DATA_DIR` at it.

Note that `npm run setup` wipes `./data` first. It is the right command for a clean slate and the wrong
command if you have uploaded anything you want to keep.

## Before you put real data in it

Casebook is built for a single trusted user on a machine they control. It is not hardened for exposure to
the open internet, and running it on a shared network or a public server means putting it behind your own
TLS termination, firewall, and authentication.

What the app does do:

- bcrypt password hashing, opaque session cookies (SHA-256 token hashes), no secrets committed.
- Server-side ownership checks on every read/write, including report finalization; uploads are
  extension/size-allowlisted and size-capped, and file bytes are only ever served through the authorized
  `/api/files/[id]` route.
- Every state change is written to an immutable history log.

What it does **not** do, and does not claim to: encryption at rest, audit attestation, role-based access
control, transport security configuration, backup tooling, retention, or compliance with HIPAA, GDPR, or
any other regime. If your data is a real person's health information, that is your responsibility to
discharge, and this app does not discharge it for you.

## Working in this repo

This is a vibecoded prototype, so the build is defended by a gate rather than by review. **Read
[`AGENTS.md`](./AGENTS.md) before changing code** — it is the working agreement for humans and agents.

```bash
npm run verify
```

That single command is the whole quality gate, in order: Prettier format check → ESLint → TypeScript →
Vitest → `next build`. **No change is done until it passes clean.** It currently covers the full test suite
and a real production compile.

| Task                | Command              |
| ------------------- | -------------------- |
| Format files        | `npm run format`     |
| Autofix lint        | `npm run lint:fix`   |
| Tests while editing | `npm run test:watch` |
| Full gate           | `npm run verify`     |
| Local app           | `npm run dev`        |

## Help is inside the app

The **Help** control in the header opens `/help` — a written guide to the workflow, uploads, the reasoning
chain, report lifecycle, troubleshooting, and a filterable glossary of genomics and research terms. It is
there so nobody has to leave the app or read a repository to find out what a tab is for. The content lives
in `src/lib/help-content.ts` as data, which lets `src/lib/help-content.test.tsx` assert the anchors, the
topic coverage, and that the page never promises a capability the app has not shipped.

## Sample files to upload live

`samples/` holds 12 fabricated files — VCF, CSV, TSV, BED, GFF, FASTA, JSON, TXT, MD, PNG, PDF — for
exercising the upload and preview pipeline. Every one is already inside the upload allowlist and far under
the size cap, so nothing rejects mid-demo. See [`samples/README.md`](./samples/README.md) for what each file
demonstrates and a suggested upload order. Regenerate with `npm run samples`; the generator is
deterministic and is the provenance record for the data. `src/lib/files/samples.test.ts` fails the build if
a sample is rejected by the allowlist, grows too large, or stops being obviously synthetic.

## Seeded demo walkthrough

- **CB-P-0001 · Patricia Okafor** — the flagship: 6 data assets (WES variant calls, SV VCF, karyotype,
  treatment history, serial CBC, consult note), 3 activities, 4 findings with evidence, and a draft report.
  Try **Generate report → open → Mark as final → Print / save PDF**.
- **CB-P-0002 · Marcus Whitfield** — mid-maturity TNBC/HRD program (partial pipeline).
- **CB-P-0003 · Elena Kovalski** — fresh enrollment, exercises every empty state.
- **CB-P-0004 · Raymond Silva** — paused chordoma program (data + a planned activity).

## Tests

`npm test` runs the full suite. The load-bearing ones:

- `src/actions/workflow.test.ts` — the case lifecycle end to end, through the real server actions: upload a
  file (real bytes, real disk), run an activity through its statuses, record a finding, cite evidence,
  generate and finalize a report, delete a file. Asserts the finished report contains the actual work, a
  researcher who does not own the program is refused at every read and write, and every step left a
  history entry attributed to the researcher who did it.
- `src/lib/data-layer.test.ts` — patient/program creation, pid sequencing, ownership isolation, data record
  create/list/delete with history, the activity status lifecycle, findings-with-evidence, and the full
  report flow.
- `src/app/route-boundaries.test.tsx` — the loading, error, global-error, and not-found boundaries.
- `src/lib/help-content.test.tsx` — the in-app guide: unique link anchors, coverage of every part of the
  workflow, no claims about undelivered features, and the glossary filter.
- `src/lib/files/samples.test.ts` — the demo sample files are all accepted by the allowlist and all small
  enough to upload instantly.

New behavior needs a test, and every new read or write path needs a negative test for a user without access.

## Documentation map

Keep these current as the app changes — a stale doc is a defect:

| Document                           | What it is for                                        |
| ---------------------------------- | ----------------------------------------------------- |
| `AGENTS.md`                        | Working agreement: the mandatory gate and house rules |
| `README.md`                        | This file: what the app is and how to run it          |
| `docs/ARCHITECTURE.md`             | Plain-English tour of the data model and flows        |
| `.planning/PROJECT.md`             | Product constraints and stack                         |
| `.planning/ROADMAP.md`             | Phase order, scope boundaries, success criteria       |
| `.planning/STATE.md`               | Where the work actually is right now                  |
| `.planning/ASSUMPTIONS.md`         | Numbered assumptions, including the open questions    |
| `.planning/phases/*/NN-CONTEXT.md` | Decisions for a phase, written before its code        |

## Roadmap

See `.planning/ROADMAP.md` for the current plan. Near-term work is making single-user self-hosting solid —
PostgreSQL and object storage as alternatives to the local file, larger uploads, and real analysis jobs
behind a documented seam. Multi-user and anything patient-facing are deliberately not planned.

## License

MIT — see [`LICENSE`](./LICENSE).
