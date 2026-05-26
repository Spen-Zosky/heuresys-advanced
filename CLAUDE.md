# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Heuresys Advanced HRMS/BPM Platform v5** — pnpm monorepo bootstrapped 2026-05-16. Backend-heavy: Fastify 4 API on top of PostgreSQL 16 with a Zod-typed contract layer shared with a Next.js 15 admin SPA + ESS portal (still empty as of MVP-1).

The project is mid-execution: MVP-0 (bootstrap, DB, migrations, seed) is done; **MVP-1** is the API build-out (11/22 business modules + auth shipped, 69/69 integration tests green at commit `64c2a27`). Next milestones are tracked in `HANDOFF.md` and `docs/BOOTSTRAP_EXECUTION_PLAN.md` §5. **Read `START_HERE.md` and `HANDOFF.md` first** — they contain live state and the priming checklist (8 canonical docs).

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
| DB create (Windows) | `pnpm db:create` (uses `pwsh` + `db/scripts/create_local_database.ps1`) |
| DB create (bash) | `pnpm db:create:sh` |
| DB migrate | `pnpm db:migrate` / `pnpm db:migrate:sh` — idempotent, twice-run proven |
| DB reset (destructive) | `pnpm db:reset` — **ask user before running** |
| DB validate (7 views) | `pnpm db:validate` |
| Seed RTL bank | `pnpm db:seed` |
| Seed test admin/personas | `pnpm db:seed-test-admin` |
| OpenAPI spec generate | `pnpm openapi:generate` (writes `apps/api/openapi.yaml`) |
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
# Look for: "RBAC permission cache loaded rolesLoaded:8 mappingsLoaded:388"
```

The `.env` file is **gitignored** but real; `.env.example` has three runtime blocks (A localhost / B OCI VM / C OCI Managed). **Option B (OCI VM, tunnel 5433) is the active runtime** (RD-25, ADR-0010). Do not commit `.env`, `.secrets/`, or `*.pem`.

## High-level architecture

```
heuresys-advanced/
├── apps/
│   ├── api/      Fastify 4 + Zod + Argon2id + RS256 JWT — 11 business modules shipped (MVP-1)
│   └── web/      Next.js 15 App Router (scaffolded, no code yet — MVP-2)
├── packages/
│   └── shared/   @heuresys/shared — Zod schemas + TS types, subpath exports per module
├── db/
│   ├── migrations/  27 idempotent SQL files (000001..000027)
│   ├── seeds/       CSV + INSERT for RTL_BANK_REFERENCE tenant
│   └── scripts/     PS1 + SH twins: create/migrate/reset/validate/seed
├── docs/         CANONICAL planning + ADR + brownfield (8 priming docs — read on session start)
├── tests/        vitest + supertest + playwright (top-level, currently unused; tests live per-app)
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

Auth is **non-enforcing at the plugin level**: `auth.ts` decodes the JWT cookie into `req.user` if present; per-route enforcement is done with `requirePermission('perm:code')` from `middleware/rbac.ts`. The RBAC permission map (388 role×permission mappings, 8 roles) is **loaded once at server start** from `sys.sys_auth_role_permissions` — `requirePermission` throws `RBAC_NOT_LOADED` if used before the cache is populated.

The server logger redacts secrets via the exported `LOG_REDACT_PATHS` constant in `app.ts` (cookies, Authorization, password fields, refresh tokens, `*.password`, `*.hash`, `*.secret`). Tests verify this is live.

### The module pattern (mandatory for every new API module)

This pattern has been replicated 11 times — **do not deviate**:

1. `packages/shared/src/schemas/<module>.ts` — Zod schemas (Create/Update/Filter/Response). Export from `packages/shared/src/index.ts` AND add a subpath export in `packages/shared/package.json` → `./schemas/<module>`.
2. `apps/api/src/modules/<module>/repository.ts` — **raw parameterized SQL** against `sys.sys_<plural>`. No Drizzle query builder for selects/inserts (Drizzle is used only via the pg pool wrapper). Always `$1, $2` params, never string interpolation. For multi-statement atomic operations (token rotation, hierarchical inserts), use the `withTransaction(pool, async (client) => { ... })` helper pattern from `modules/auth/repository.ts` instead of acquiring a client manually.
3. `apps/api/src/modules/<module>/service.ts` — business logic + scope authorization based on an `ActorContext` built from `req.user`. Visibility model is module-specific (tenant-only, global+tenant, platform-only — see existing modules for examples).
4. `apps/api/src/modules/<module>/routes.ts` — `FastifyPluginAsyncZod` with `requirePermission('<resource>:<verb>')` on every route + `app.verifyCsrf` on POST/PATCH/DELETE. Errors thrown from service/repository must use the typed classes in `src/errors/index.ts` (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`) with a `SCREAMING_SNAKE` code as second arg — e.g. `throw new ForbiddenError('Missing permission: skills:write', 'PERMISSION_DENIED')`. The error handler turns this into a stable `{error:{code, message, requestId}}` response. Existing codes to mimic: `LOGIN_INVALID`, `REFRESH_REPLAY_DETECTED`, `RBAC_NOT_LOADED`, `PERMISSION_DENIED`.
5. Register in `apps/api/src/app.ts` at step 13 with `app.register(<module>Routes, { prefix: '/v1/<module>' })`.
6. `apps/api/test/<module>.integration.test.ts` — supertest via `buildTestApp()` helper (4–8 tests per module). Tests hit the **real DB** through the tunnel; there are no mocks.
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
- **I13 PostgreSQL 16 NATIVE. NO DOCKER.** (ADR-0004 hard policy.) Runtime location is OCI VM via SSH tunnel (ADR-0010 Option B / RD-25).
- **RD-08 Categorical fields = `varchar(N) + CHECK`. NEVER PostgreSQL ENUM.** Enum-like values are TS-side discriminators.
- **RD-09** Use `date` for date-only columns; `timestamptz` only where time-of-day precision is required.
- **I12 Brownfield** = enrichment source only. v5 architecture wins; brownfield data is demo/no-PII, no anonymization layer.
- **ADR-0011** ESS (Employee Self-Service) is **MVP-2b** — 13 pages `/me/*` + 18 `/v1/me/*` endpoints with 19 self-scope permissions. Don't add `/me/*` routes to existing modules; they get a dedicated module.

When a new requirement seems to conflict with these, **stop and ask** rather than working around.

## Security model (auth, in case you need to touch it)

- Passwords: **Argon2id 64 MiB / 3 iter / 4 parallelism** (ADR-0005). The `needsRehash` path auto-rotates on successful login.
- Access token: JWT RS256, 15 min TTL, issued as `HttpOnly + SameSite=Lax` cookie. Keys in `.secrets/jwt_{private,public}.pem` (gitignored).
- Refresh token: 30 d, single-use, rotation with replay detection. Replay attempt revokes the entire family and returns `401 REFRESH_REPLAY_DETECTED`.
- CSRF: double-submit cookie pattern via `csrfPlugin`. Opt-in per route — apply `app.verifyCsrf` preHandler to all state-changing routes (POST/PATCH/DELETE).
- Login returns `200` with body (not 204 — Fastify strips bodies from 204; documented errata in commit `7450f77`).
- 8 roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `BLUEPRINT_MANAGER`, `HRMS_MANAGER`, `PROCESS_OWNER`, `MANAGER`, `USER`, `READ_ONLY`.
- Test personas (seeded by `pnpm db:seed-test-admin`, password `Admin#PassW0rd!`): `admin@heuresys.com`, `tenant_admin_test@rtl-bank.test`, `manager_test@rtl-bank.test`, `employee_test@rtl-bank.test`, `outsider_test@rtl-bank.test`.

## Database migrations

27 numbered SQL files in `db/migrations/000001_*.sql..000027_*.sql`. Every migration is **idempotent** — `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, etc. — and running the full set twice produces an empty `pg_dump` diff (proven and recorded). When adding a new migration, follow the existing pattern: next sequential number, single descriptive file, idempotent body, no destructive ops.

## What NOT to touch

- `.env`, `.secrets/`, any `*.pem` or `*.key` — gitignored secrets.
- `docs/source_bundle/brownfield/extracted/` and `docs/brownfield/_inspection_artifacts/` — gitignored, may contain legacy PII. Never commit, never read for code generation.
- `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo` — generated.
- Legacy codebase at `D:\evo.heuresys.com\` (Win) and `/home/ubuntu/heuresys-evo` (OCI VM) — read-only enrichment source. Authorized for inspection but **don't commit absolute paths to it** in this repo; reference via `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md`.

## Working conventions for this repo (in addition to the user's global rules)

- **TS strict mode quirks**: `tsconfig.base.json` has `noUncheckedIndexedAccess: true` plus `noUnusedLocals` / `noUnusedParameters`. Array index access and `Map.get()` return `T | undefined` — narrow explicitly. Unused params must be prefixed `_` (e.g. `(_req, reply) =>`). `exactOptionalPropertyTypes` is intentionally **off** to keep Zod-inferred types ergonomic.
- **Module work follows the 7-step pattern above + atomic commit.** Don't split a module across commits.
- Commit prefix style is established: `feat(api): MVP-1 5.1.X — <module> module (...)`, `chore(db): seed — ...`, `docs(handoff): ...`, `test(api): ...`. Follow the existing log style.
- **Never `git push`** without an explicit ask from the user. Local commits on `main` are pre-authorized for this project (see `memory/feedback_full_autonomy.md`); pushes are not.
- **Update `HANDOFF.md`** at the end of any session that ships modules or changes live state — it's the cross-session handoff doc.
- The repo runs on Windows. PowerShell 5.1 quirks apply (absolute exe paths, no `-ArgumentList @()` with string arrays, `cmd.exe` not on PATH). Most automation has `.sh` siblings for SSH-into-VM use.

## MVP-2a / MVP-2b frontend — LIVE DATA E2E ONLY (non-negotiable)

When the next session opens MVP-2a (admin web SPA) and MVP-2b frontend (13 ESS pages), the **canonical entry point** is `NEXT_SESSION_MVP_2A.md` at the repo root. Read that file in full before any code action — it contains the doctrine, the audit-first / TDD ordering, the page-by-page loop, and the literal session prompt.

**Non-negotiable rules** locked in by that doctrine (also enforced here so future sessions inherit them):

- **No mock data, no demo fixtures, no placeholder hard-codes** in any page. Every cell, chart, table, form is fed by a real `/v1/*` call hitting the OCI VM PostgreSQL via the live pool. The only "empty data" allowed is a real empty-state UI when the live API returns an empty list.
- **No stubbed endpoints, no Next.js routes that return static JSON, no TanStack Query with hard-coded `initialData`/`placeholderData`.**
- **No page commit without a Playwright E2E test green** that performs a real login (`admin@heuresys.com` / `Admin#PassW0rd!` or the appropriate seeded persona), navigates, and asserts on data that came from the seed (`RTL_BANK_REFERENCE` + 5 test personas). Mutations must call the real endpoint and verify state via re-fetch.
- **API-first ordering** — never build UI before the endpoint exists, is typed in `@heuresys/shared`, and is covered by a green integration test in `apps/api/test/`. If a page needs an endpoint that doesn't exist, open a mini API milestone (e.g. `5.1.24 — dashboard aggregators`) and ship the endpoint + tests first, atomic commit.
- **Complete wiring at every level before a page is "done"**: shared Zod schema → API repository/service/route → integration test → frontend types reused from `@heuresys/shared` → TanStack Query hook → component composed from `@heuresys/ui` primitives → Playwright E2E green. If any layer is missing, the page is not done.
- **Correction + retest cycle is mandatory**: any regression in TypeScript, vitest API suite, Playwright, or i18n parity blocks the merge of the current page. No "TODO: fix later" comments shipped to production code.
- **No UI primitive duplication** — every reusable component lives nel repo sorgente `ux-design-shared` ed è consumato via `@heuresys/ui` npm-published (post-X18, vedi sezione Design System). Page-specific composition stays in `apps/web/src/components/` but only as composition of `@heuresys/ui` primitives plus tenant/RBAC-aware wrappers from `@heuresys/shared`.
