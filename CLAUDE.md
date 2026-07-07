# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Heuresys Advanced HRMS/BPM Platform v5** — pnpm monorepo bootstrapped 2026-05-16. Backend-heavy: Fastify 5 API on top of PostgreSQL 16 with a Zod-typed contract layer shared with a Next.js 15 admin SPA + ESS portal (both shipped — MVP-2a/2b).

The project is at **`v1.0.0` GA baseline** (released S957, 2026-06-02) with a post-v1.0 program in flight: MVP-0→4 + the RBAC/UIX/Perspectives epic are closed. The API ships ~75 business modules + auth under `/v1/*` (every module covered by integration tests hitting the real DB through the SSH tunnel); the Next.js web app ships the admin SPA (MVP-2a) + ESS portal (MVP-2b) + teams "my team" scope axis; a static brand showcase is deployed to GitHub Pages. The VM runs in **production mode** (API tsup bundle `node dist/server.js` + web `next start`). **The running counts (modules / migrations / endpoints / tests / RBAC mappings) are NOT hardcoded here — they live in `docs/kb/SOT_STATE.md`** (handoff-governed, re-derived every session; they drifted before — D-01). **Project state lives in two handoff-governed views**: `.handoff/STATE.md` (rapid — priorities/open-questions) + `docs/kb/SOT_STATE.md` (granular system snapshot — versions/counts/architecture). Open backlog in `docs/kb/SOT_BACKLOG.md`, technical debts in `docs/kb/DEBT_REGISTER.md`. Historical records (`HANDOFF.md`, the v1.0.0 entry-point) archived under `docs/archive/`; architectural decisions in `docs/architecture/adr/`. The invariants, module pattern, security model, and Design System sections below remain authoritative.

**Data provenance** (ADR-0023): the `sys.*` business tables are populated by a deterministic brownfield ingestion pipeline whose **authoritative data source** is the legacy `heuresys-evo` Docker DB (`heuresys_evo_platform_db` / db `heuresys_platform`). The data is **production data, treated as real** (quality, governance, coherence); the legacy is the data *source* (ADR-0023). The advanced `sys.*` schema is the **structural authority** (the legacy adapts to it).

> **OUTPUT RULE (S1011, Enzo — vincolante)**: the "no-PII / synthetic / ADR-0023 / safe-to-publish" qualifier is **RETIRED as a descriptor**. Never append it as a reassurance in messages, commits, docs, ADRs or questions; describe a datum for what it **is** (a payslip, an IBAN, an address), never for what it "isn't". The architectural facts below stand (no anonymization layer, treat-as-real) — what's banned is the reflexive label. The RTL_BANK reference tenant was rebuilt (S950) by matching+wiring real legacy records (161 users / 2 active tenants). See `docs/kb/SOT_STATE.md` §4.

## Definition of Done — live E2E con dati reali (VINCOLANTE, cross-sessione · ADR-0026)

> Regola di Enzo recepita 2026-06-15 (`docs/kb/COWORK_INBOX.md` entry `2026-06-15 | REGOLA VINCOLANTE`; riferimento nel repo plugin `Spen-Zosky/human-resources-plus` → `docs/DEFINITION_OF_DONE.md`). **Vale per OGNI work-item, non solo #9.**

**Nessuno step si chiude su mock / placeholder / green-test.** Il mock è solo impalcatura transitoria DENTRO uno step; ogni step si chiude SOLO con una **dimostrazione LIVE su dati reali** — output reale allegato (comando + output + path assoluto + timestamp, R5). "Green test" o "il mock funziona" = **in-progress**, non *done*. Unica attesa ammessa: un input che solo Enzo può fornire (secret/credenziale, approval umana) → stato = **`blocked-on-Enzo: <cosa, perché>`**, MAI "done". Scritture eseguite sui **due tenant di produzione correnti** — **RTL Bank** (customer-example) e **Heuresys System** (platform/system) — **trattati come dati reali**: un solo ambiente prod-grade, **nessun «tenant di TEST», nessun «mai produzione»** (→ **ADR-0026**). Per le pagine autenticate la dimostrazione LIVE = **login con una persona reale** (es. `federica.marchetti@rtl-bank.org`, `paolo.caputo@rtl-bank.org`) e uso secondo profilo. Coerente con la dottrina "LIVE DATA E2E ONLY" della sezione MVP-2a/2b in fondo a questo file.

## Source of Truth (single per domain — do not duplicate)

- **Current state — two handoff-governed views** (disjoint domains, no number duplicated between them): `.handoff/STATE.md` (rapid — priorities + open questions) and `docs/kb/SOT_STATE.md` (granular — versions, DB/API/web/CI counts, architecture, milestone narrative). Both are rewritten by the `handoff` skill at session close (it re-derives the granular counts via psql/ls/git). Do NOT create other state/handoff/entry-point files.
- **Open backlog** → `docs/kb/SOT_BACKLOG.md`.
- **Technical debts** → `docs/kb/DEBT_REGISTER.md`.
- **Item status vocabulary** (closed set, on backlog/debt items): `ACTIVE` · `GATED` (dependency-blocked, auto-re-evaluated) · `WAIT-INPUT` (blocked on an input only Enzo provides) · `HOLD` (parked by decision → **pull lane**: out of the session-start menu, shown only as a count, reactivated on explicit request) · `INTERRUPTED` (work in flight, stopped involuntarily — top of menu, `resume-from`) · `DONE`/`FATTO`/`WON'T-DO` (terminal). Menu items live as **structured blocks** in a tagged **Action register** section of `SOT_BACKLOG.md` (all lanes — `HOLD` is the pull corsia *within* it). The vocabulary + register integrity are verified by `docs/kb/tools/handoff_lint.py` (10 checks, blocking) at each handoff, and the menu itself is generated from the register by `docs/kb/tools/build_menu.py` (design: `docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md` §3-§4 + §11).
- **Durable rules / architecture** → this file (`CLAUDE.md`).
- **Path index** → `docs/kb/INDEX_PATHS.md`. Public overview → `README.md`.
- **Product level** (business scope / PRD / competitive scorecard / latent-capability catalog / product work-item specs) → `docs/product/` (adopted as SoT for the **product domain** S997, Enzo decision). Disjoint from `docs/kb/` (technical state) and `docs/due-diligence/` (investor DD). ⚠️ The "latent capabilities" the catalog declares are **wiki-derived and partly describe legacy `heuresys-evo`** — re-verify on the *advanced* schema before committing to roadmap (Fase-0 method + a worked example: `docs/product/WORKITEM_GAP1_PHASE0_VERIFICATION.md`).

Historical records live in `docs/archive/` and are **not** SoT. When state changes, update the relevant SoT above — never spawn a new file. (Rationale: `docs/superpowers/specs/2026-06-05-sot-unification-design.md` §11.)

## Session start (do this first, every session)

After the infra hooks (tunnel/db/branch), **before** asking what to do or starting work, build the **action menu** from all live sources so the user picks from a complete list — never from memory. Do it with ONE command, in ONE model round — this replaces the old two-script, N-round boot that was the dominant cost of a slow "avvia sessione" (forensics: `docs/kb/SESSION_START_FORENSICS.md`):

1. **Run `python docs/kb/tools/session_start.py`** (pass `--no-db` if the tunnel is down). One process that prints the register-driven action menu (`build_menu`) **plus** the live health dashboard (`status_dashboard`), which **at boot runs offline-fast** (`--no-net`): the git-fetch / CI / PROD probes are monitoring data, not inputs to the menu, and the boot hook already established tunnel + DB + branch/dirty/unpushed. **Do NOT read `SOT_BACKLOG.md` / `SOT_STATE.md` / `DEBT_REGISTER.md` raw at boot** (156KB + 206KB + 65KB — mostly historical archive the script already distills into menu + debts + decisions + drift). Open a source raw **only in drill-down, for the item the user chooses**. You may read the small `.handoff/STATE.md` (~3KB — priorities + open-questions prose) if you want the narrative.
2. **Aggregate**: the menu is generated exhaustively from the canonical Action register (ACTIVE tiers + GATED + WAIT-INPUT tray + HOLD count + INTERRUPTED top, with P3 trigger-eval flagging unblockable parked items + P9 age — design §11.2). Present it and **ADD only what the register doesn't yet cover**: debts not-`RISOLTO` (already in the dashboard's debt section) + SOT roadmap/gated items — with judgment on impact/unblocking (**P1** high-impact/unblocking · **P2** quality/debt · **P3** roadmap/gated).
3. **Exclude** definitively-concluded work (`DONE`/`FATTO`/`RISOLTO`/`WON'T-DO` + shipped MVPs). **Keep** `GATED` items (`⛔`-marked with the blocker — visible but clearly not ready) and `WAIT-INPUT` items in a dedicated "aspetta un tuo input" tray. **Exclude `HOLD` items from the menu body** — show them only as a one-line count summary ("⏸ N azioni in HOLD — scrivi *mostra hold*"); they enter the menu only on the user's explicit request or when their `reactivation-trigger` fires. Put any `INTERRUPTED` item at the **top** (work in flight to resume).
4. **Present** the menu, then: *"Scegli #, aggrega (es. 1+4), o nuovo."* The user may aggregate several items into one session.

Do NOT start work before presenting this menu and getting the user's choice — UNLESS the user's first message already names a specific task. Rationale + the writing side (handoff): `docs/superpowers/specs/2026-06-05-sot-unification-design.md` §12.

**Full live health on demand** (NOT at boot — it costs ~5s of network + a tail-risk timeout): `python docs/kb/tools/status_dashboard.py` (alias `pnpm status`), or `session_start.py --net`, adds the network probes on top of the boot view — git sync vs origin, last CI conclusion per workflow, PROD `/login`+`/api/readyz`. The DB migrations/integrity/counts, **staleness self-check** (live vs `SOT_STATE.md` §0 → flags drift), backlog lanes, open debts and decisions-waiting-on-Enzo are already in the boot view. It never trusts a cached number; tunnel/offline degrade to `[? ]`, never to a stale guess. Born S1007 to end "sono al buio"; the two scripts were consolidated into `session_start.py` at the 2026-07-07 session-start forensics.

## Canonical commands

All run from repo root unless noted. Use the project's pnpm package manager (pinned via `packageManager` in `package.json`).

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev (all workspaces) | `pnpm dev` — runs API on :3001 and (when scaffolded) web on :3000 |
| Dev API only | `cd apps/api && pnpm dev` (`tsx watch src/server.ts`) |
| Build all | `pnpm build` |
| Typecheck all | `pnpm typecheck` |
| Lint all | `pnpm lint` |
| Run all tests | `pnpm test` |
| Run single test file | `cd apps/api && pnpm exec vitest run test/<name>.integration.test.ts` |
| Run single test by name | `cd apps/api && pnpm exec vitest run -t "<test name pattern>"` |
| Full E2E web suite (prod build, **only** supported full-run mode — D-24) | `cd apps/web && pnpm test:e2e:prod` — dev config (`test:e2e`) is for per-spec iteration only: auth sessions live 15 min. **On a host with Node ≥23** (e.g. Windows Node 24) Playwright 1.61 crashes at import-time (D-36) — use `pnpm test:e2e:prod:node22` / `test:e2e:node22` (wrapper auto-runs Playwright under a Node 22 portable; passthrough on Node ≤22, so CI/Mac/VM are unaffected) |
| DB create (Windows) | `pnpm db:create` (uses `pwsh` + `db/scripts/create_local_database.ps1`) |
| DB create (bash) | `pnpm db:create:sh` |
| DB migrate | `pnpm db:migrate` / `pnpm db:migrate:sh` — idempotent, twice-run proven |
| DB reset (destructive) | `pnpm db:reset` — **ask user before running** |
| DB validate (7 views) | `pnpm db:validate` |
| Seed RTL bank | `pnpm db:seed` |
| Seed test admin/personas | `pnpm db:seed-test-admin` |
| i18n parity check (web) | `pnpm i18n:check` |
| Typecheck test files separately | `cd apps/api && pnpm typecheck:test` (uses `tsconfig.test.json`) |
| **Session start (menu + health, ONE round)** | `python docs/kb/tools/session_start.py` — register-driven action menu **+** offline-fast health in one process; `--no-db` (tunnel down), `--show-hold`, `--net` (add CI/PROD/git-fetch probes). This is the canonical boot command |
| Status dashboard (FULL live health, on demand) | `python docs/kb/tools/status_dashboard.py` (or `pnpm status`) — re-derives git/CI/PROD/DB/backlog/debts/drift live; flags `--no-db` `--no-net` `--md` `--strict`. NOT run at boot (network cost) — the boot view (`session_start.py`) already carries DB/backlog/debts/drift |

PowerShell scripts are the Windows canonical; `.sh` siblings exist for bash/SSH-to-VM use. Every `db/scripts/*.{ps1,sh}` is idempotent and safe to re-run.

## Required infrastructure at session start

Two background pieces must be live before tests or dev server work — they may be down after a logout:

```bash
# 1. SSH tunnel to OCI VM PostgreSQL (port 5433 local → 5432 remote)
ssh -fN -L 5433:localhost:5432 oracle-vm-default

# 2. Smoke-check DB
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"

# 3. (optional) API dev server — restart if process died
cd apps/api && pnpm dev
# Look for: "RBAC permission cache loaded rolesLoaded:11 mappingsLoaded:<N>" (current N: docs/kb/SOT_STATE.md)
```

The `.env` file is **gitignored** but real; `.env.example` has three runtime blocks (A localhost / B OCI VM / C OCI Managed). **Option B (OCI VM, tunnel 5433) is the active runtime** (RD-25, ADR-0010). Do not commit `.env`, `.secrets/`, or `*.pem`.

## Full alignment & deploy doctrine

"**Allinea i cloni**" (VM + linux-pc) means making the remotes **true clones** of the local PC repo (idempotency, modulo OS/arch) — including the gitignored payload `git pull` never carries. Canonical entrypoint: **`bash scripts/align-clones.sh <vm|linuxpc|all> [--deploy]`** (push local commits first; remotes `reset --hard origin/main`). **The Mac (2012 MBP) is RETIRED from `all`/`close-propagate` (S1007 — dead weight: its Claude CLI SIGILLs on the Ivy Bridge CPU, the ecosystem channel kept failing 16 plugins + drift). It remains an on-demand-only target (`align-clones.sh mac`) if ever revived.** Per target it composes: hard git sync → `pnpm install --frozen-lockfile -r` → `.secrets/` + gitignored data (`sync-gitignored-to-vm.sh`) → **`.env` additive key-merge** (`env-key-merge.sh`, never overwrites per-machine topology) → Claude memory tree (`sync-memory-tree.sh`) → (VM `--deploy`) `vm-deploy.sh`. **`vm-deploy.sh`** guarantees a fully-updated PROD (exact lockfile versions + clean-reinstall on Node-ABI change + self-modify-buffer re-exec + `db:migrate:sh` + shared→api→web rebuild + restart). Full rationale: `memory/feedback_full_alignment_doctrine.md`; ops detail: `deploy/README.md` §"Full alignment". **At session close** the canonical orchestrator is **`scripts/close-propagate.sh`** (invoked by the `handoff` skill Step 4b): it runs BOTH channels — `align-clones` (repo + payload + project memories + PROD deploy) **and** `align-claude-ecosystem` (CLAUDE.md/skills/commands/settings/SDK + plugin SHA-verify) — plus the conditional linux-pc clone-DB; **fail-loud** on a reachable host, **skip+warn** on a host that's off (design 2026-06-20 §12-§13).

## High-level architecture

```
heuresys-advanced/
├── apps/
│   ├── api/       Fastify 5 + Zod + Argon2id + RS256 JWT — ~75 business modules + auth shipped (MVP-1→4, v1.0.0). Live count: docs/kb/SOT_STATE.md
│   ├── web/       Next.js 15 App Router — admin SPA + ESS portal shipped (MVP-2a/2b)
│   └── showcase/  Next.js 15 static export — brand identity site, GitHub Pages deploy
├── packages/
│   └── shared/   @heuresys/shared — Zod schemas + TS types, subpath exports per module
├── db/
│   ├── migrations/  idempotent numbered SQL files (000001.., 000035 gap cosmetic). Live count: docs/kb/SOT_STATE.md
│   ├── seeds/       CSV + INSERT for RTL_BANK_REFERENCE tenant
│   └── scripts/     PS1 + SH twins: create/migrate/reset/validate/seed
├── docs/         CANONICAL planning + ADR + brownfield (8 priming docs — read on session start). Path index: docs/kb/INDEX_PATHS.md
├── tests/        vitest + playwright (top-level, currently unused; tests live per-app)
└── qa_artifacts/ acceptance outputs + Mermaid diagrams (runs/ is gitignored)
```

**Workspace layout** (`pnpm-workspace.yaml`): `apps/*` + `packages/*`. Imports use `@heuresys/api`, `@heuresys/web`, `@heuresys/shared` with subpath exports like `@heuresys/shared/schemas/users`.

## Design System — `@heuresys/ui` (npm-published, post-migrazione X18)

Reusable UI/UX components live in **`@heuresys/ui`** — an npm-published versioned lib derived from `ux-design-shared` (ex-`heuresys-evo`), consumed as a normal dep (not `link:`) since migration X18 (2026-05). Import: `import { Button, Card, DataTable } from "@heuresys/ui"`. UI runtime deps (Radix, Tailwind 4, framer-motion, d3, echarts, three.js, …) are declared inside the lib and arrive as transitive deps. **Full setup (Tailwind `content` path, `transpilePackages`), the modify-a-component workflow (Storybook → npm release → bump here), maintenance and the X18 migration history → `docs/kb/DESIGN_SYSTEM_UI.md`.**

**Rules** (non-negotiable):
- **NEVER** create reusable UI components in `apps/web`, `apps/showcase` o `packages/*` di questo repo. Vanno nel repo `ux-design-shared` (sorgente di `@heuresys/ui`).
- **NEVER** aggiungere UI runtime deps (Radix, framer-motion, recharts, ecc.) ai `package.json` di questo repo. Appartengono a `@heuresys/ui` e arrivano come transitive deps.
- Se un componente è genuinamente heuresys-advanced-specific (es. tenant-aware widget che usa schemi Zod da `@heuresys/shared`), vive in `apps/web/src/components/` o `apps/showcase/src/components/` — e anche in quel caso, prefer composing primitives di `@heuresys/ui` invece di reimplementarle.
- React peer: `@heuresys/ui` dichiara React via `peerDependencies`; `apps/web` / `apps/showcase` installano la versione concreta di React (oggi 19.2.5). Evita il crash "due React istanze".

### apps/api — the heart of MVP-1

Entry split: `src/server.ts` is the network binding + env validation; `src/app.ts` exports `buildApp()` so tests (and any future embedded use) can boot an isolated Fastify instance without a port. The singleton pg pool lives in `src/db/client.ts` (`isDatabaseReady()` is the readiness probe used by `/readyz`). The `RoleCode` union and `COOKIES` constants live in `src/config/constants.ts` — import from there, don't redefine.

`apps/api/src/app.ts` builds the Fastify instance with a **fixed 13-step plugin chain** (do not reorder — see `docs/api/API_IMPLEMENTATION_PLAN.md` §3.2):

```
1. Zod type-provider compilers  → 2. requestId  → 3. helmet  → 4. cors
5. cookie  → 6. JWT (RS256)  → 7. rate-limit  → 8. auth (decode-only, non-enforcing)
9. CSRF (double-submit, opt-in per route)  → 10. tenantContext  → 11. errorHandler
12. /healthz + /readyz  → 13. module routes (/v1/<module>)
```

Auth is **non-enforcing at the plugin level**: `auth.ts` decodes the JWT cookie into `req.user` if present; per-route enforcement is done with `requirePermission('perm:code')` from `middleware/rbac.ts`. The RBAC permission map (role×permission mappings across 11 roles — live counts in `docs/kb/SOT_STATE.md`; verify with `SELECT count(*) FROM sys.sys_auth_role_permissions`) is **loaded once at server start** from `sys.sys_auth_role_permissions` — `requirePermission` throws `RBAC_NOT_LOADED` if used before the cache is populated.

The server logger redacts secrets via the exported `LOG_REDACT_PATHS` constant in `app.ts` (cookies, Authorization, password fields, refresh tokens, `*.password`, `*.hash`, `*.secret`). Tests verify this is live.

### The module pattern (mandatory for every new API module)

This pattern has been replicated across every business module (current count: `docs/kb/SOT_STATE.md`) — **do not deviate**:

1. `packages/shared/src/schemas/<module>.ts` — Zod schemas (Create/Update/Filter/Response). Export from `packages/shared/src/index.ts` AND add a subpath export in `packages/shared/package.json` → `./schemas/<module>`.
2. `apps/api/src/modules/<module>/repository.ts` — **raw parameterized SQL** against `sys.sys_<plural>`. No Drizzle query builder for selects/inserts (Drizzle is used only via the pg pool wrapper). Always `$1, $2` params, never string interpolation. For multi-statement atomic operations (token rotation, hierarchical inserts), use the `withTransaction(pool, async (client) => { ... })` helper pattern from `modules/auth/repository.ts` instead of acquiring a client manually.
3. `apps/api/src/modules/<module>/service.ts` — business logic + scope authorization based on an `ActorContext` built from `req.user`. Visibility model is module-specific (tenant-only, global+tenant, platform-only — see existing modules for examples).
4. `apps/api/src/modules/<module>/routes.ts` — `FastifyPluginAsyncZod` with `requirePermission('<resource>:<verb>')` on every route + `app.verifyCsrf` on POST/PATCH/DELETE. Errors thrown from service/repository must use the typed classes in `src/errors/index.ts` (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`) with a `SCREAMING_SNAKE` code as second arg — e.g. `throw new ForbiddenError('Missing permission: skills:write', 'PERMISSION_DENIED')`. The error handler turns this into a stable `{error:{code, message}}` response body (`details?` for validation errors); the request id is returned in the `x-request-id` **response header** (set by the `requestId` plugin), not in the body. Existing codes to mimic: `LOGIN_INVALID`, `REFRESH_REPLAY_DETECTED`, `RBAC_NOT_LOADED`, `PERMISSION_DENIED`.
5. Register in `apps/api/src/app.ts` at step 13 with `app.register(<module>Routes, { prefix: '/v1/<module>' })`.
6. `apps/api/test/<module>.integration.test.ts` — via `buildTestApp()` helper (`app.inject()`, 4–8 tests per module). Tests hit the **real DB** through the tunnel; there are no mocks.
7. `pnpm test` must be 100% green. Then **atomic commit**: `feat(api): MVP-1 5.1.X — <module> module (N endpoints, M tests)`.

### Tests

Vitest config (`apps/api/vitest.config.ts`) runs **singleThread** to avoid refresh-rotation race conditions and shares one DB pool across the suite. The helper `apps/api/test/helpers/build-test-app.ts` boots an isolated Fastify instance per test, loads the RBAC cache once, and injects an `InMemoryMailer` so auth assertions can inspect outgoing mail without I/O. Tests hit the live OCI VM DB — **the SSH tunnel must be up**. There is no separate unit/integration split today; all tests in `apps/api/test/*.test.ts` are integration-level.

**Transactional isolation (D-52, S1015)**: every test FILE runs inside ONE real transaction rolled back at file end (`test/helpers/setup.ts` → `test/helpers/tx-isolation.ts`) — zero residue on the shared DB, no inter-file coupling; the legacy `afterAll` DELETE cleanups are now redundant-but-harmless. Direct `pool.query` WRITE statements (INSERT/UPDATE/DELETE/MERGE, incl. writing CTEs) run in serialized per-statement savepoints so intentional DB-error tests keep autocommit semantics; reads pass straight through; the app's `withTransaction` maps BEGIN/COMMIT/ROLLBACK to savepoints. Deltas to know: `now()` is frozen per file (transaction_timestamp); fixtures created in `beforeAll` are rolled back too; an intentionally-failing SELECT would abort the file tx (none exists today — extend the write-detector if one appears). Escape hatch: `TEST_TX_ISOLATION=0` (legacy autocommit).

## Non-negotiable invariants

These are enforced architecturally and cannot be revisited without a new ADR / decision-log entry. They override "common patterns" you may want to apply from other projects.

- **I1 Position-centric** model, not Employee-centric. Position owner ≠ Incumbent.
- **I3/I4 Schema discipline**: business tables live in `sys.sys_<plural>`. Aux schemas are `staging`, `brownfield`, `audit`. **Never** `usr_*` / `br_*` / etc.
- **I5 Tenant isolation = FK + API middleware filter. NEVER RLS.** Postgres RLS is not used anywhere.
- **I7 Auth is separate from `sys.sys_users`** — 11 dedicated `sys.sys_auth_*` tables.
- **I9 PIP** (Position Intelligence Profile) is a **VIEW / MATERIALIZED VIEW**, never a JSONB blob (ADR-0008).
- **I13 PostgreSQL 16 NATIVE. NO DOCKER.** (ADR-0004 hard policy.) Runtime location is OCI VM via SSH tunnel (ADR-0010 Option B / RD-25). NO-DOCKER governs the advanced **runtime** only — the read-only legacy `heuresys-evo` Docker DB consulted during extract/import is a data **source**, not a runtime dependency, and does not violate this (ADR-0004 source-vs-runtime note; ADR-0023).
- **RD-08 Categorical fields = `varchar(N) + CHECK`. NEVER PostgreSQL ENUM.** Enum-like values are TS-side discriminators.
- **RD-09** Use `date` for date-only columns; `timestamptz` only where time-of-day precision is required.
- **I12 Brownfield/legacy = authoritative DATA SOURCE** (not mere enrichment). The legacy `heuresys-evo` Docker DB (`heuresys_evo_platform_db` / db `heuresys_platform`) is the canonical source that populates `sys.*`; v5 `sys.*` remains the **structural authority** and the legacy adapts to it via `brownfield.column_mappings`. The ingestion pipeline has **no anonymization/masking layer** (verified: all `column_mappings pii_disposition=NONE`) — the data is treated as **real production data, full-fat** (no field is skipped/masked). See **ADR-0023** (data-source doctrine) and the **OUTPUT RULE** in *Data provenance* (the "no-PII" label is retired as a descriptor).
- **I14 Legacy ingestion is EMPLOYEE-centric** (ADR-0024). In the legacy Docker DB the **person/business entity is `employees`** (95 cols; **207 FK** hang off it — bio, job, org, kpi, learning, skills, compensation), **NOT `users`** (16-col auth shell; only **45 FK**, all audit-actor; `users.employee_id → employees.id` makes `users` subordinate). Therefore: legacy `employees` ⟹ `sys.sys_users` + `sys.sys_user_*` satellites; legacy `users` ⟹ `sys.sys_auth_*` (credentials only, never the person). The canonical crosswalk key is **`user_external_code = 'LEGACY_EMP::' || employees.id`** (or email cross-check), **never** `'LEGACY:' || users.id`. Coverage is driven by `employees` (an employee with no `users` row is still a credential-less person, not skipped). The `sys.sys_users` ↔ legacy `users` name collision is a **false friend**. Full map: `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`.
- **ADR-0011** ESS (Employee Self-Service) is **MVP-2b** — 13 pages `/me/*` + 18 `/v1/me/*` endpoints with 19 self-scope permissions. Don't add `/me/*` routes to existing modules; they get a dedicated module.
- **I15 Single production-grade environment, two current tenants** (ADR-0026). There is **one** environment and it is **production** (prod runtime, TLS, native DB — ADR-0010). **RTL Bank** (customer-example tenant — the populated business dataset, 162 users) and **Heuresys System** (platform/system tenant) are the **current production tenants**, NOT "test" tenants. Data is **treated as real production data** (quality, referential coherence, governance, idempotent/reversible writes); the legacy is only the data *source* (ADR-0023). *(The "no-PII / synthetic" qualifier is retired as a descriptor — see the OUTPUT RULE in **Data provenance**.)* Two access paths: **public prospect** (unauthenticated landing → `/demo`·`/investors` → lead capture) and **authenticated production app** (login → use per RBAC profile). The phrases "tenant di TEST" / "mai produzione" are **retired**. Business-data writes target RTL Bank by *role* (it models a customer company), never as a test/prod split.

- **I16 Bi-axial authorization** (ADR-0027). Access = `f(actor, resource, data-class, relationship)`, resolved over TWO orthogonal chains: **organizational** (org-chart reports-to, transitive) gates **sensitive personal data**; **functional/operational** (team/process membership) gates **activities**. Not role+tenant alone. The two axes compose with RBAC (role answers *can this action happen at all*; the axis answers *on whose data/work*).
- **I17 Universal ESS floor.** Every user is at least `USER`: guaranteed the Employee Portal (`/v1/me/*`) + full access to their OWN data. Self-scope overrides every axis.
- **I18 Sensitive data is organizational-only.** Another user's `PERSONAL`/`COMPENSATION`/`SKILL`/`EVALUATION` data is accessible ONLY via the organizational chain (transitive reports-to). Functional (team/process) membership NEVER unlocks sensitive data.
- **I19 Peer isolation.** Holders of disjoint organizational sub-trees are peers — neither sees the other's sensitive data.
- **I20 Organizational prevalence (absolute for sensitive data).** When axes concur, the org chain prevails for sensitive data, with no exceptions. HR-mandated roles (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER`) keep tenant-wide sensitive access by explicit mandate, not via the axes.

When a new requirement seems to conflict with these, **stop and ask** rather than working around.

## Security model (auth, in case you need to touch it)

- Passwords: **Argon2id 64 MiB / 3 iter / 4 parallelism** (ADR-0005). The `needsRehash` path auto-rotates on successful login.
- Access token: JWT RS256, 15 min TTL, issued as `HttpOnly + SameSite=Lax` cookie. Keys in `.secrets/jwt_{private,public}.pem` (gitignored).
- Refresh token: 30 d, single-use, rotation with replay detection. Replay attempt revokes the entire family and returns `401 REFRESH_REPLAY_DETECTED`.
- CSRF: double-submit cookie pattern via `csrfPlugin`. Opt-in per route — apply `app.verifyCsrf` preHandler to all state-changing routes (POST/PATCH/DELETE).
- Login returns `200` with body (not 204 — Fastify strips bodies from 204; documented errata in commit `7450f77`).
- 11 roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `BLUEPRINT_MANAGER`, `HRMS_MANAGER`, `PROCESS_OWNER`, `MANAGER`, `USER`, `READ_ONLY` + 3 holderless functional roles added in the S953/R2 epic (mig 000049): `CEO`, `TEAM_LEADER`, `TEAM_MEMBER`. (Role×permission mapping count lives in `docs/kb/SOT_STATE.md` — verify live: `SELECT count(*) FROM sys.sys_auth_role_permissions`.)
- Test personas (post-S950 RTL rebuild: **real RTL_BANK users**, not the old `*.test` accounts which were deleted; `pnpm db:seed-test-admin` is now idempotent + login-only — it ensures a LOCAL auth identity + ARGON2ID credential for users created by the rebuild seeds, password from the `TEST_ADMIN_PASSWORD` env — no committed default, F-001): `admin@heuresys.com` (PLATFORM_ADMIN), `federica.marchetti@rtl-bank.org` (TENANT_ADMIN), `paolo.caputo@rtl-bank.org` (MANAGER), `tommaso.fiore@rtl-bank.org` (USER, paolo's report), `antonio.parisi@rtl-bank.org` (USER, outsider). The manager→employee reports-to edge is a real org relationship. Mapping authority: `db/scripts/seed-test-admin.ts`.

## Database migrations

Numbered SQL files in `db/migrations/000001_*.sql..` (the `000035` gap is cosmetic and documented). The exact file count is **not hardcoded here** — it lives in `docs/kb/SOT_STATE.md` (re-derived every session: `ls db/migrations/*.sql`). Every migration is **idempotent** — `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, etc. — and running the full set twice produces an empty `pg_dump` diff (proven and recorded). When adding a new migration, follow the existing pattern: next sequential number, single descriptive file, idempotent body, no destructive ops.

## What NOT to touch

- `.env`, `.secrets/`, any `*.pem` or `*.key` — gitignored secrets.
- `docs/source_bundle/brownfield/extracted/` and `docs/brownfield/_inspection_artifacts/` — gitignored generated dump/inspection artifacts (large, reproducible from the brownfield pipeline). **Never commit** — repo hygiene (large, reproducible from the pipeline), not a privacy gate. They **may** be read for ingestion/seed authoring (the RTL rebuild `00_extract` does exactly this); just don't paste absolute legacy-source paths into committed files (see the legacy read-only line below).
- `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo` — generated.
- Legacy codebase at `D:\evo.heuresys.com\` (Win) and `/home/ubuntu/heuresys-evo` (OCI VM) — read-only enrichment source. Authorized for inspection but **don't commit absolute paths to it** in this repo; reference via `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md`.

## Working conventions for this repo (in addition to the user's global rules)

- **TS strict mode quirks**: `tsconfig.base.json` has `noUncheckedIndexedAccess: true` plus `noUnusedLocals` / `noUnusedParameters`. Array index access and `Map.get()` return `T | undefined` — narrow explicitly. Unused params must be prefixed `_` (e.g. `(_req, reply) =>`). `exactOptionalPropertyTypes` is intentionally **off** to keep Zod-inferred types ergonomic.
- **Module work follows the 7-step pattern above + atomic commit.** Don't split a module across commits.
- Commit prefix style is established: `feat(api): MVP-1 5.1.X — <module> module (...)`, `chore(db): seed — ...`, `docs(handoff): ...`, `test(api): ...`. Follow the existing log style.
- **Never `git push`** without an explicit ask from the user. Local commits on `main` are pre-authorized for this project (see `memory/feedback_full_autonomy.md`); pushes are not.
- **Update `HANDOFF.md`** at the end of any session that ships modules or changes live state — it's the cross-session handoff doc.
- The repo runs on Windows. PowerShell 5.1 quirks apply (absolute exe paths, no `-ArgumentList @()` with string arrays, `cmd.exe` not on PATH). Most automation has `.sh` siblings for SSH-into-VM use.

## Autonomia operativa cross-tool (R23 globale — project enforcement)

Global rule **R23** (`~/.claude/CLAUDE.md`) applies: zero avoidable delegation + proactive tool loading + self-diagnose fallback + no user-executable instructions when autonomously executable + evidence-not-suggestion. **Project-level specifics — preferred tools per task, self-hosted CI runner, tunnel handling, test-verification level → `docs/kb/AUTONOMY_R23_PROJECT.md`.** Two rules to keep top-of-mind:
- **Push authorization is session-scoped**: the historical "never `git push` without explicit ask" is the default; once you authorize autonomous push in a session it holds until revoked, and a **new session resets to "ask"**.
- **A red CI is an error Claude MUST fix** (R3), never hand back to the user — consult `gh run list`/`gh run watch` as evidence (R23/e).

Cross-reference: R6 (global no-delega base), R22 (CLASSE A/B decision), R23 (autonomy comprehensive), R3 (correggere ogni errore), R12 (git safety cross-project).

## MVP-2a / MVP-2b frontend — LIVE DATA E2E ONLY (non-negotiable)

MVP-2a (admin web SPA) + MVP-2b (13 ESS pages) are **shipped**, but the binding doctrine survives for **any new frontend work** and is enforced here so future sessions inherit it:

- **No mock data / demo fixtures / placeholder hard-codes / stubbed endpoints / static-JSON Next.js routes / hard-coded TanStack `initialData`/`placeholderData`.** Every cell, chart, table, form is fed by a real `/v1/*` call hitting the OCI VM PostgreSQL via the live pool; the only "empty data" allowed is a real empty-state UI when the live API returns an empty list.
- **API-first ordering** — never build UI before the endpoint exists, is typed in `@heuresys/shared`, and is covered by a green integration test in `apps/api/test/`. If a page needs a missing endpoint, open a mini API milestone and ship the endpoint + tests first (atomic commit).
- **Complete wiring before "done"**: shared Zod schema → API repository/service/route → integration test → frontend types from `@heuresys/shared` → TanStack Query hook → component composed from `@heuresys/ui` primitives → **Playwright E2E green** (real login — e.g. `admin@heuresys.com` with the `TEST_ADMIN_PASSWORD` env password, or a seeded persona — navigate + assert on seeded data; mutations verify via re-fetch). Any missing layer = not done.
- **Correction + retest is mandatory**: any regression in TypeScript, vitest, Playwright, or i18n parity blocks the merge — no "TODO: fix later" in production code. **No UI primitive duplication** (primitives come from `@heuresys/ui`; page-specific composition in `apps/web/src/components/` only as composition + tenant/RBAC wrappers from `@heuresys/shared`).

Full doctrine (audit-first / TDD ordering, page-by-page loop, literal session prompt): **`docs/archive/NEXT_SESSION_MVP_2A.md`** (archived — the MVPs shipped).
