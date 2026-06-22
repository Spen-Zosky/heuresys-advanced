# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Heuresys Advanced HRMS/BPM Platform v5** — pnpm monorepo bootstrapped 2026-05-16. Backend-heavy: Fastify 5 API on top of PostgreSQL 16 with a Zod-typed contract layer shared with a Next.js 15 admin SPA + ESS portal (both shipped — MVP-2a/2b).

The project is at **`v1.0.0` GA baseline** (released S957, 2026-06-02) with a post-v1.0 program in flight: MVP-0→4 + the RBAC/UIX/Perspectives epic are closed. The API ships ~75 business modules + auth under `/v1/*` (every module covered by integration tests hitting the real DB through the SSH tunnel); the Next.js web app ships the admin SPA (MVP-2a) + ESS portal (MVP-2b) + teams "my team" scope axis; a static brand showcase is deployed to GitHub Pages. The VM runs in **production mode** (API tsup bundle `node dist/server.js` + web `next start`). **The running counts (modules / migrations / endpoints / tests / RBAC mappings) are NOT hardcoded here — they live in `docs/kb/SOT_STATE.md`** (handoff-governed, re-derived every session; they drifted before — D-01). **Project state lives in two handoff-governed views**: `.handoff/STATE.md` (rapid — priorities/open-questions) + `docs/kb/SOT_STATE.md` (granular system snapshot — versions/counts/architecture). Open backlog in `docs/kb/SOT_BACKLOG.md`, technical debts in `docs/kb/DEBT_REGISTER.md`. Historical records (`HANDOFF.md`, the v1.0.0 entry-point) archived under `docs/archive/`; architectural decisions in `docs/architecture/adr/`. The invariants, module pattern, security model, and Design System sections below remain authoritative.

**Data provenance** (ADR-0023): the `sys.*` business tables are populated by a deterministic brownfield ingestion pipeline whose **authoritative data source** is the legacy `heuresys-evo` Docker DB (`heuresys_evo_platform_db` / db `heuresys_platform`) — synthetic case-study data, no real PII (I12). The advanced `sys.*` schema is the **structural authority** (the legacy adapts to it). The RTL_BANK reference tenant was rebuilt (S950) by matching+wiring real legacy records (161 users / 2 active tenants). See `docs/kb/SOT_STATE.md` §4.

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

After the infra hooks (tunnel/db/branch), **before** asking what to do or starting work, build the **action menu** from all live sources so the user picks from a complete list — never from memory:

1. **Read** the action sources: `.handoff/STATE.md` (priorities + open questions), `docs/kb/SOT_BACKLOG.md` (items NOT `✅ DONE`/`✅ FATTO`/`⚪ WON'T-DO`), `docs/kb/DEBT_REGISTER.md` (debts NOT `RISOLTO`), `docs/kb/SOT_STATE.md` §"Prossimo"/roadmap + gated.
2. **Aggregate** into ONE **priority-tiered** menu — **P1** high-impact/unblocking · **P2** quality/debt · **P3** roadmap/gated. Each row: `# · short title · [source] · gating (⛔ reason if blocked) · effort (~Xh)`. Derive priority from the existing markers (DEBT 🔴→P1 / 🟡→P2 / 🟢→P3; backlog P1-P3 sections; STATE top-priorities) plus judgment on impact/unblocking. **If `docs/kb/tools/build_menu.py` exists, run it first** (`python docs/kb/tools/build_menu.py`): it generates the register-driven menu (ACTIVE tiers + GATED + WAIT-INPUT tray + HOLD count + INTERRUPTED top, with P3 trigger-eval flagging unblockable parked items + P9 age) from the canonical Action register — present its output and ADD the debt (not-`RISOLTO`) + SOT roadmap/gated items it doesn't yet cover (P2, design §11.2).
3. **Exclude** definitively-concluded work (`DONE`/`FATTO`/`RISOLTO`/`WON'T-DO` + shipped MVPs). **Keep** `GATED` items (`⛔`-marked with the blocker — visible but clearly not ready) and `WAIT-INPUT` items in a dedicated "aspetta un tuo input" tray. **Exclude `HOLD` items from the menu body** — show them only as a one-line count summary ("⏸ N azioni in HOLD — scrivi *mostra hold*"); they enter the menu only on the user's explicit request or when their `reactivation-trigger` fires. Put any `INTERRUPTED` item at the **top** (work in flight to resume).
4. **Present** the menu, then: *"Scegli #, aggrega (es. 1+4), o nuovo."* The user may aggregate several items into one session.

Do NOT start work before presenting this menu and getting the user's choice — UNLESS the user's first message already names a specific task. Rationale + the writing side (handoff): `docs/superpowers/specs/2026-06-05-sot-unification-design.md` §12.

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

"**Allinea Mac e VM**" means making the remotes **true clones** of the local PC repo (idempotency, modulo OS/arch) — including the gitignored payload `git pull` never carries. Canonical entrypoint: **`bash scripts/align-clones.sh <mac|vm|all> [--deploy]`** (push local commits first; remotes `reset --hard origin/main`). Per target it composes: hard git sync → `pnpm install --frozen-lockfile -r` → `.secrets/` + gitignored data (`sync-gitignored-to-vm.sh`) → **`.env` additive key-merge** (`env-key-merge.sh`, never overwrites per-machine topology) → Claude memory tree (`sync-memory-tree.sh`) → (VM `--deploy`) `vm-deploy.sh`. **`vm-deploy.sh`** guarantees a fully-updated PROD (exact lockfile versions + clean-reinstall on Node-ABI change + self-modify-buffer re-exec + `db:migrate:sh` + shared→api→web rebuild + restart). Full rationale: `memory/feedback_full_alignment_doctrine.md`; ops detail: `deploy/README.md` §"Full alignment". **At session close** the canonical orchestrator is **`scripts/close-propagate.sh`** (invoked by the `handoff` skill Step 4b): it runs BOTH channels — `align-clones` (repo + payload + project memories + PROD deploy) **and** `align-claude-ecosystem` (CLAUDE.md/skills/commands/settings/SDK + plugin SHA-verify) — plus the conditional linux-pc clone-DB; **fail-loud** on a reachable host, **skip+warn** on a host that's off (design 2026-06-20 §12-§13).

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

All reusable UI/UX components live in **`@heuresys/ui`**, una libreria condivisa derivata da `ux-design-shared` (originariamente extracted from `heuresys-evo`). Dal 2026-05 (migrazione X18) la lib è **pubblicata come pacchetto npm versionato**, non più consumata via `link:` symlink locale. La dep è risolta da pnpm contro il registry e installata in `node_modules/@heuresys/ui` come dipendenza normale (pnpm crea un symlink interno alla cache `.pnpm/`, ma è meccanica pnpm — non un live-link a una working copy).

**Stato attuale verificato (HEAD `ad7d5c0`, S932)**:
- Dep in `package.json` (root e `apps/showcase/package.json`): `"@heuresys/ui": "^0.1.1"`. **NON è più `link:../ux-design-shared/ui`.**
- `node_modules/@heuresys/ui` è un symlink pnpm verso `node_modules/.pnpm/@heuresys+ui@<ver>/node_modules/@heuresys/ui` — è la normale risoluzione pnpm, immutabile a runtime.
- Le UI runtime deps (Radix, Tailwind 4, framer-motion, d3, echarts, three.js, ecc.) sono dichiarate dentro `@heuresys/ui` e tirate dentro come transitive deps quando si fa `pnpm install`. Questo repo non le installa direttamente.
- Import standard invariato: `import { Button, Card, DataTable } from "@heuresys/ui"`.
- Tailwind 4 in `apps/web` / `apps/showcase`: `tailwind.config` deve includere `"./node_modules/@heuresys/ui/dist/**/*.{js,mjs}"` (o equivalente path al build output della lib) nel `content` array per raccogliere le utility classes usate dai componenti pubblicati.
- Next.js in `apps/web` / `apps/showcase`: `transpilePackages: ["@heuresys/ui"]` in `next.config.js` se la lib espone ESM/TSX non pre-transpilato; verificare il `package.json` di `@heuresys/ui@0.1.1` per il vero `exports` map.

**Workflow per modificare componenti UI (post-X18)**:
- Le modifiche al codice di `@heuresys/ui` **NON sono live** in questo repo: bisogna versionare, pubblicare una nuova versione della lib, poi bumpare la dep qui (`pnpm update @heuresys/ui` o cambiando `^0.1.1` → versione target) e rifare `pnpm install`.
- Per dev rapido di un componente nuovo o modifica esistente, il flusso consigliato è: lavorare nel repo `ux-design-shared` con Storybook (`npm run storybook` → `http://localhost:6006`), validare, tagliare release npm, poi consumare qui.
- In emergenza (debug rapido di un componente già in prod) è possibile temporaneamente reintrodurre `link:` o `pnpm.overrides` puntando a una working copy locale, MA è un detour — va ripristinato a versione npm prima del commit.

**Rules** (non-negotiable, invariati nello spirito):
- **NEVER** create reusable UI components in `apps/web`, `apps/showcase` o `packages/*` di questo repo. Vanno nel repo `ux-design-shared` (sorgente di `@heuresys/ui`).
- **NEVER** aggiungere UI runtime deps (Radix, framer-motion, recharts, ecc.) ai `package.json` di questo repo. Appartengono a `@heuresys/ui` e arrivano come transitive deps.
- Se un componente è genuinamente heuresys-advanced-specific (es. tenant-aware widget che usa schemi Zod da `@heuresys/shared`), vive in `apps/web/src/components/` o `apps/showcase/src/components/` — e anche in quel caso, prefer composing primitives di `@heuresys/ui` invece di reimplementarle.
- React peer: `@heuresys/ui` dichiara React via `peerDependencies`; `apps/web` / `apps/showcase` installano la versione concreta di React (oggi 19.2.5). Evita il crash "due React istanze".

**Maintenance / evolution**:
- Bump versione: `pnpm update @heuresys/ui` (segue il range `^0.1.1`) oppure pinning esplicito a una versione specifica nel `package.json`.
- Aggiungere un nuovo componente o nuova dep: lavoro nel repo `ux-design-shared` → release npm → bump qui.
- Storybook: `cd D:\ux-design-shared && npm run storybook` → `http://localhost:6006` (51 componenti, 16 tier — count storico, verificare allo state corrente del repo).
- Re-validation post-`pnpm install`: il check storico `readlink -f node_modules/@heuresys/ui → /d/ux-design-shared/ui` è **obsoleto** (era valido pre-X18). Oggi `readlink -f node_modules/@heuresys/ui` ritorna un path dentro `node_modules/.pnpm/@heuresys+ui@<ver>/node_modules/@heuresys/ui` — è il pattern pnpm standard.

**Apps che consumano `@heuresys/ui`** (allo stato corrente):
- `apps/web` — admin SPA + ESS portal (Next.js 15, codebase MVP-2a/2b in costruzione).
- `apps/showcase` — Heuresys brand identity v1, static site GitHub Pages (Next.js 15 static export). Aggiunto post-CLAUDE.md originale.

**Note migrazione X18** (storico, leggibile dai commit):
- Prima della migrazione X18 (2026-05), `@heuresys/ui` era consumato via `link:../ux-design-shared/ui` (live symlink). La sezione precedente di questo file descriveva quella configurazione.
- Il switch a npm-published è stato fatto per (i) eliminare la dipendenza dalla working copy locale per dev su altre macchine (Mac/VM), (ii) garantire reproducibilità (lockfile pinning), (iii) supportare deploy CI/CD senza accesso al filesystem dello sviluppatore.

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
- **I12 Brownfield/legacy = authoritative no-PII DATA SOURCE** (not mere enrichment). The legacy `heuresys-evo` Docker DB (`heuresys_evo_platform_db` / db `heuresys_platform`) is the canonical source that populates `sys.*`; v5 `sys.*` remains the **structural authority** and the legacy adapts to it via `brownfield.column_mappings`. Data is synthetic case-study (no real persons) → no real PII, no anonymization/masking layer (verified: all `column_mappings pii_disposition=NONE`). No-PII is **global** for this project. See **ADR-0023**.
- **I14 Legacy ingestion is EMPLOYEE-centric** (ADR-0024). In the legacy Docker DB the **person/business entity is `employees`** (95 cols; **207 FK** hang off it — bio, job, org, kpi, learning, skills, compensation), **NOT `users`** (16-col auth shell; only **45 FK**, all audit-actor; `users.employee_id → employees.id` makes `users` subordinate). Therefore: legacy `employees` ⟹ `sys.sys_users` + `sys.sys_user_*` satellites; legacy `users` ⟹ `sys.sys_auth_*` (credentials only, never the person). The canonical crosswalk key is **`user_external_code = 'LEGACY_EMP::' || employees.id`** (or email cross-check), **never** `'LEGACY:' || users.id`. Coverage is driven by `employees` (an employee with no `users` row is still a credential-less person, not skipped). The `sys.sys_users` ↔ legacy `users` name collision is a **false friend**. Full map: `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`.
- **ADR-0011** ESS (Employee Self-Service) is **MVP-2b** — 13 pages `/me/*` + 18 `/v1/me/*` endpoints with 19 self-scope permissions. Don't add `/me/*` routes to existing modules; they get a dedicated module.
- **I15 Single production-grade environment, two current tenants** (ADR-0026). There is **one** environment and it is **production** (prod runtime, TLS, native DB — ADR-0010). **RTL Bank** (customer-example tenant — the populated business dataset, 162 users) and **Heuresys System** (platform/system tenant) are the **current production tenants**, NOT "test" tenants. Data is synthetic-by-provenance → **no PII, ever** (ADR-0023) → **but treated as real production data** (quality, referential coherence, governance, idempotent/reversible writes; "not real" qualifies only provenance, never treatment). Two access paths: **public prospect** (unauthenticated landing → `/demo`·`/investors` → lead capture) and **authenticated production app** (login → use per RBAC profile). The phrases "tenant di TEST" / "mai produzione" are **retired**. Business-data writes target RTL Bank by *role* (it models a customer company), never as a test/prod split.

When a new requirement seems to conflict with these, **stop and ask** rather than working around.

## Security model (auth, in case you need to touch it)

- Passwords: **Argon2id 64 MiB / 3 iter / 4 parallelism** (ADR-0005). The `needsRehash` path auto-rotates on successful login.
- Access token: JWT RS256, 15 min TTL, issued as `HttpOnly + SameSite=Lax` cookie. Keys in `.secrets/jwt_{private,public}.pem` (gitignored).
- Refresh token: 30 d, single-use, rotation with replay detection. Replay attempt revokes the entire family and returns `401 REFRESH_REPLAY_DETECTED`.
- CSRF: double-submit cookie pattern via `csrfPlugin`. Opt-in per route — apply `app.verifyCsrf` preHandler to all state-changing routes (POST/PATCH/DELETE).
- Login returns `200` with body (not 204 — Fastify strips bodies from 204; documented errata in commit `7450f77`).
- 11 roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `BLUEPRINT_MANAGER`, `HRMS_MANAGER`, `PROCESS_OWNER`, `MANAGER`, `USER`, `READ_ONLY` + 3 holderless functional roles added in the S953/R2 epic (mig 000049): `CEO`, `TEAM_LEADER`, `TEAM_MEMBER`. (Role×permission mapping count lives in `docs/kb/SOT_STATE.md` — verify live: `SELECT count(*) FROM sys.sys_auth_role_permissions`.)
- Test personas (post-S950 RTL rebuild: **real RTL_BANK users**, not the old `*.test` accounts which were deleted; `pnpm db:seed-test-admin` is now idempotent + login-only — it ensures a LOCAL auth identity + ARGON2ID credential for users created by the rebuild seeds, password `Admin#PassW0rd!`): `admin@heuresys.com` (PLATFORM_ADMIN), `federica.marchetti@rtl-bank.org` (TENANT_ADMIN), `paolo.caputo@rtl-bank.org` (MANAGER), `tommaso.fiore@rtl-bank.org` (USER, paolo's report), `antonio.parisi@rtl-bank.org` (USER, outsider). The manager→employee reports-to edge is a real org relationship. Mapping authority: `db/scripts/seed-test-admin.ts`.

## Database migrations

Numbered SQL files in `db/migrations/000001_*.sql..` (the `000035` gap is cosmetic and documented). The exact file count is **not hardcoded here** — it lives in `docs/kb/SOT_STATE.md` (re-derived every session: `ls db/migrations/*.sql`). Every migration is **idempotent** — `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, etc. — and running the full set twice produces an empty `pg_dump` diff (proven and recorded). When adding a new migration, follow the existing pattern: next sequential number, single descriptive file, idempotent body, no destructive ops.

## What NOT to touch

- `.env`, `.secrets/`, any `*.pem` or `*.key` — gitignored secrets.
- `docs/source_bundle/brownfield/extracted/` and `docs/brownfield/_inspection_artifacts/` — gitignored generated dump/inspection artifacts (large, reproducible from the brownfield pipeline). **Never commit** — repo hygiene, **not** privacy (the legacy data is synthetic, no real PII — I12 / ADR-0023). They **may** be read for ingestion/seed authoring (the RTL rebuild `00_extract` does exactly this); just don't paste absolute legacy-source paths into committed files (see the legacy read-only line below).
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

Vale la regola **R23** della SoT cross-tool (`C:\Users\enzospenuso\.claude\CLAUDE.md`): zero delega evitabile + proactive tool loading + self-diagnose fallback + no user-executable instructions when autonomously executable + evidence non suggerimento. Specifiche project-level che si applicano sopra R23 in heuresys-advanced:

- **Tool primari per task tipici di questo repo**: edits codice/test/migration → preferire Filesystem MCP o Desktop Commander `edit_block` (real disk) per file >900B, con Windows-MCP PowerShell come fallback. Bash sandbox solo per logica/calcolo non-stateful (parsing, format, regex). Git operations → sempre via Windows-MCP PowerShell (`.git/index.lock` può non rimuoversi dal sandbox mount).
- **Push autorizzazione**: la regola storica "never `git push` without explicit ask" resta valida come default ma **una volta che l'utente ha autorizzato push autonomi in una sessione (esplicitamente, es. via /authorize o approvazione esplicita), l'autorizzazione vale per quella sessione fino a sua revoca**. La nuova sessione riparte da default "ask". Esempio: S933 ha autorizzato push autonomi → S934 + S935 + S936 hanno ereditato → la prossima nuova sessione richiederà nuova autorizzazione.
- **CI workflow + self-hosted runner**: post-S935 F, i 6 workflow GitHub Actions girano su OCI VM runner. Il commit autonomo include automatica esecuzione CI se il path tocca file rilevanti (vedi `.github/workflows/*.yml` paths-ignore). Claude può consultare lo stato CI via `gh run list` + `gh run watch` come parte di evidenza (R23/e). Una CI rossa è un errore Claude DEVE correggere (R3 cross-project), non scaricare all'utente.
- **Live re-run + DB queries**: per task che richiedono SSH tunnel 5433 attivo, Claude prima verifica `Test-NetConnection localhost -Port 5433`; se down, tenta start tunnel via SSH agent loaded; se passphrase prompt → fallback documentato (vedi `qa_artifacts/s936_outcome_summary.md` §5 workaround SSH automation). Non chiedere all'utente di "aprire un terminale per il tunnel" se ssh-agent persistent setup è già documentato come task open.
- **Test verification level**: vitest test files con mocked pool (es. `upsert-sql-cw-b60-a-silent-skip.test.ts`) sono sufficienti come unit verification per R3 closure di un fix observability. Live DB validation è "belt-and-suspenders" non-blocking quando il fix è già unit-tested verde.

Cross-reference: R6 (global no-delega base), R22 (CLASSE A/B decision), R23 (autonomy comprehensive), R3 (correggere ogni errore), R12 (git safety cross-project).

## MVP-2a / MVP-2b frontend — LIVE DATA E2E ONLY (non-negotiable)

When the next session opens MVP-2a (admin web SPA) and MVP-2b frontend (13 ESS pages), the **canonical entry point** is `NEXT_SESSION_MVP_2A.md` at the repo root. Read that file in full before any code action — it contains the doctrine, the audit-first / TDD ordering, the page-by-page loop, and the literal session prompt.

**Non-negotiable rules** locked in by that doctrine (also enforced here so future sessions inherit them):

- **No mock data, no demo fixtures, no placeholder hard-codes** in any page. Every cell, chart, table, form is fed by a real `/v1/*` call hitting the OCI VM PostgreSQL via the live pool. The only "empty data" allowed is a real empty-state UI when the live API returns an empty list.
- **No stubbed endpoints, no Next.js routes that return static JSON, no TanStack Query with hard-coded `initialData`/`placeholderData`.**
- **No page commit without a Playwright E2E test green** that performs a real login (`admin@heuresys.com` / `Admin#PassW0rd!` or the appropriate seeded persona), navigates, and asserts on data that came from the seed (the rebuilt RTL_BANK reference tenant + the 5 real seeded personas — see Security model). Mutations must call the real endpoint and verify state via re-fetch.
- **API-first ordering** — never build UI before the endpoint exists, is typed in `@heuresys/shared`, and is covered by a green integration test in `apps/api/test/`. If a page needs an endpoint that doesn't exist, open a mini API milestone (e.g. `5.1.24 — dashboard aggregators`) and ship the endpoint + tests first, atomic commit.
- **Complete wiring at every level before a page is "done"**: shared Zod schema → API repository/service/route → integration test → frontend types reused from `@heuresys/shared` → TanStack Query hook → component composed from `@heuresys/ui` primitives → Playwright E2E green. If any layer is missing, the page is not done.
- **Correction + retest cycle is mandatory**: any regression in TypeScript, vitest API suite, Playwright, or i18n parity blocks the merge of the current page. No "TODO: fix later" comments shipped to production code.
- **No UI primitive duplication** — every reusable component lives nel repo sorgente `ux-design-shared` ed è consumato via `@heuresys/ui` npm-published (post-X18, vedi sezione Design System). Page-specific composition stays in `apps/web/src/components/` but only as composition of `@heuresys/ui` primitives plus tenant/RBAC-aware wrappers from `@heuresys/shared`.
