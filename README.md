# Omanta Lab — Research Workspace Prototype

A collaborative research workspace for Omanta's patient-centered research model, organized around **patient research
programs**. The prototype runs end to end on **synthetic data only** — it demonstrates the full workflow a researcher
would use, but claims nothing about clinical validity.

> **Synthetic data — not for clinical use.** This prototype is not ready for patient accounts or real patient data. All
> patients, files, findings, evidence, and reports in this demo are fabricated and deidentified.

Current status: **Phase 1 (interface polish) shipped.** Phase 0 built the workflow, Phase 0.5 added first-run
onboarding, and Phase 1 made the interface quiet and consistent. See `.planning/ROADMAP.md` for what comes next.

## Working in this repo

This is a vibecoded prototype, so the build is defended by a gate rather than by review. **Read
[`AGENTS.md`](./AGENTS.md) before changing code** — it is the working agreement for humans and agents.

```bash
npm run verify
```

That single command is the whole quality gate, in order: Prettier format check → ESLint → TypeScript → Vitest →
`next build`. **No change is done until it passes clean.** It currently covers 21 tests and a real production compile.

| Task                | Command              |
| ------------------- | -------------------- |
| Format files        | `npm run format`     |
| Autofix lint        | `npm run lint:fix`   |
| Tests while editing | `npm run test:watch` |
| Full gate           | `npm run verify`     |
| Local app           | `npm run dev`        |

## What was built

A complete sign-in → workspace → report loop, plus a first-time tour:

0. **First-time tour** — a three-step welcome guide (`Directory → Data → Reports`) that appears once on the first
   dashboard visit. Progress is saved in browser storage, dismiss or skip at any point, and **Help** in the header
   replays it anytime.
1. **Sign in** — email/password (bcrypt-hashed), server-action based, httpOnly session cookie, middleware redirect.
2. **Patient programs** — dashboard listing every patient and their research program (status, hypothesis, asset counts).
3. **Workspace per patient** (7 tabs):
   - **Overview** — program summary, stats, latest findings, activity timeline, and an intelligent "next step."
   - **Research data** — upload CSV/TSV/VCF/JSON/TXT/FASTA/BED/GFF/PDF/PNG/JPG/XLSX/MD (≤25 MB), inline previews
     (table/JSON-syntax-highlighted text/image), download via an authenticated API route, delete.
   - **Activities** — log analyses (variant analysis, literature review, statistical analysis, …) with hypothesis;
     walk them `planned → in_progress → completed`; record findings inline.
   - **Findings** — researcher-recorded observations with category and significance, optionally linked to an activity.
   - **Evidence & sources** — publications/databases/clinical records/datasets attached to findings (URL/DOI/note).
   - **Reports** — auto-assembled structured reports (patient overview, program, data index, activities, findings +
     evidence, history, methodology note); draft → mark final; print/save-as-PDF layout with print CSS.
   - **History** — immutable event trail of everything that happened in the program.
4. **New patient program** — create patient + program in one form; workspace opens ready.

### Interface principles (Phase 1)

The UI is deliberately quiet. Documentation is available on demand and never blocks a working screen:

- **One Help affordance** in the shell carries the walkthrough; there is no per-page instruction banner.
- **One synthetic-data disclosure** in the shell, with a per-report draft warning where it actually matters.
- **No prose that restates a heading.** Empty states are a short title and one clear action.
- **Constraints live at the point of action** — file types, size limits, and required fields stay next to the control.
- Prettier (with a Tailwind class-order plugin) owns formatting, so diffs stay readable.

## Domain model

10 tables (Drizzle, SQLite): `users`, `sessions`, `patients`, `research_programs`, `data_records`,
`research_activities`, `findings`, `evidence`, `reports`, `history_events`.

Key invariants:

- One researcher per demo tenant; **proof of ownership enforced in the data layer** — every query/action checks
  `programAllowed()` (patient owner / program), so a patient's records can't leak across users.
- Every mutation writes a `history_events` row (timeline + report "Activity history" section).
- Patient IDs are `OM-P-0001…`; long IDs are `prefix_<uuid-ish>`.
- All uploads are flagged `is_synthetic = true` and stored under `data/storage/programs/<programId>/`.

## Architecture

- **Next.js 15 (App Router, TypeScript)** — server components for pages, `"use client"` only for interactive forms.
- **Tailwind CSS v3** design system: `ui/{button,badge,card,form,empty-state,avatar}`, brand teal palette, print CSS.
- **Drizzle ORM + better-sqlite3** — `src/lib/db/{index,schema,repo}.ts`. Migrations in `drizzle/`.
- **Server Actions** — one module per domain (`src/actions/{auth,patient,data,activities,findings,reports}.ts`),
  zod-validated, always guarded by `requireUser()`.
- **File handling** — `src/lib/files/{storage,mime,parse}.ts` with size/extension allowlists; previews parse CSV/TSV/
  VCF/JSON/text/markdown/images.
- **Report assembly** — `src/lib/report/generate.ts` produces a typed block model
  (`kv | p | list | table | note | quote | hr`) rendered by `/report/[id]`.
- **Plain-English system tour** — `docs/ARCHITECTURE.md` explains the data model and flows for non-engineers.

## Getting started

```bash
npm install
cp .env.example .env        # defaults are fine for the demo
npm run setup               # wipes ./data, migrates, and seeds synthetic demo data
npm run dev                 # http://localhost:3000
```

Sign in with the seeded researcher:

- **Email:** `demo@omanta.dev`
- **Password:** `demo-password`

Other scripts: `npm run seed` (idempotent re-seed), `npm run db:studio` (Drizzle Studio), `npm run build && npm start`
(production).

## Seeded demo walkthrough

- **OM-P-0001 · Patricia Okafor** — the flagship: 6 data assets (WES variant calls, SV VCF, karyotype, treatment
  history, serial CBC, consult note), 3 activities, 4 findings with evidence, and a draft report. Try **Generate
  report → open → Mark as final → Print / save PDF**.
- **OM-P-0002 · Marcus Whitfield** — mid-maturity TNBC/HRD program (partial pipeline).
- **OM-P-0003 · Elena Kovalski** — fresh enrollment, exercises every empty state.
- **OM-P-0004 · Raymond Silva** — paused chordoma program (data + a planned activity).

## Tests

`npm test` runs two suites (21 tests):

- `src/lib/data-layer.test.ts` — patient/program creation + pid sequencing + ownership isolation, data record
  create/list/delete with history, the activity status lifecycle, findings-with-evidence + reporter resolution,
  non-owner access denial, and the full report-generate → create → access → finalize flow.
- `src/lib/browser/onboarding-storage.test.ts` — the onboarding guide's storage contract, including missing,
  malformed, and throwing browser storage.

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

## Security & compliance posture

- bcrypt password hashing, opaque session cookies (SHA-256 token hashes), no secrets committed.
- Server-side ownership checks on every read/write; uploads are extension/size-allowlisted and size-capped, and file
  bytes are only ever served through the authorized `/api/files/[id]` route.
- **Not claimed:** HIPAA/GDPR-compliant data handling, audit attestation, RBAC beyond single owner, transport
  security config, real clinical validity. Do not run with real patient data. Compliance is Phase 10 work with
  explicit sign-off.

## Assumptions & next steps

Decisions and assumptions are recorded in `.planning/ASSUMPTIONS.md` — key ones: single-tenant demo; SQLite for
proto (Postgres via Drizzle is a drop-in swap); hand-rolled sessions acceptable for the prototype; synthetic data
only; no simulated pipeline execution beyond placeholder/hand-typed analysis results.

Product direction: host Omanta Lab at `lab.omanta.com` as a collaboration workspace for the Omanta
team and patients. That direction is recorded from the project engineer and has not yet been
validated with the founder, researchers, or patients. Before real patient use, the app needs
patient/team permissions, consent boundaries, secure hosting, audit and operational controls, and
the applicable privacy/security review. See `.planning/PROJECT.md` and `.planning/ROADMAP.md`.

## Roadmap

Twelve phases, in order. The next four:

2. **Production persistence and object storage** — PostgreSQL target with a second test leg, S3-compatible uploads
   behind the existing storage interface, Docker Compose for local Postgres + MinIO.
3. **In-app user feedback** — a form and a founders-only triage list. No third-party service.
4. **Genomic data intake and analysis jobs** — multipart uploads for large files and a mocked job runner
   (`queued → running → completed/failed`) behind a documented seam for a future AWS/Python service.
5. **Report sending and sharing** — auditable, mocked delivery with recipient/actor/time recorded.
