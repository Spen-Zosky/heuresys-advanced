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

## Design System — CENTRALIZZATO in `D:\ux-design-shared`

All reusable UI/UX components live in **`D:\ux-design-shared\ui`** (`@heuresys/ui`) — a shared, deduplicated library extracted from `heuresys-evo`. This repo (and every future Heuresys consumer) accesses it via **symlink**, not via duplicated source. All UI dependencies (Radix, Tailwind 4, framer-motion, d3, echarts, three.js, ~80 libs total) live exclusively in `D:\ux-design-shared\ui` — **this repo installs nothing UI-related**.

**Integration (verified working at commit `b720ada` of ux-design-shared)**:
- Dep in root `package.json`: `"@heuresys/ui": "link:../ux-design-shared/ui"` (note: `link:` — NOT `file:` — and the path is **1 level up** from this repo root, not 3). Verified live symlink: `node_modules/@heuresys/ui` → `D:/ux-design-shared/ui`.
- Initial setup of `ux-design-shared` (one-time per machine, already done): `git init`, then `cd D:/ux-design-shared && npm install --legacy-peer-deps` (Storybook 10 has a peer-dep clash with addon-a11y that requires the flag).
- Import standard: `import { Button, Card, DataTable } from "@heuresys/ui"`.
- Tailwind 4 in `apps/web`: when configured, `tailwind.config` must include `"./node_modules/@heuresys/ui/src/**/*.{ts,tsx}"` in `content` so utility classes from the linked library are picked up.
- Next.js in `apps/web`: when scaffolded, set `transpilePackages: ["@heuresys/ui"]` in `next.config.js` so the bundler walks through the symlink.

**Live-link semantics (do not get this wrong)**:
- Modifications to **existing** file content in `D:\ux-design-shared\ui` → visible immediately to consumer (true symlink, inode-shared).
- **New files / new components** added to `D:\ux-design-shared\ui` → also visible immediately (it's a directory-level symlink, so the symlinked view tracks the real directory contents in real time). No `pnpm install` needed for new component visibility — only when adding **new npm deps** to `@heuresys/ui` (then `npm install --legacy-peer-deps` inside `D:\ux-design-shared` to bring them in).
- Verification command: `touch D:/ux-design-shared/ui/src/_TEST.txt && ls node_modules/@heuresys/ui/src/_TEST.txt` from this repo root should succeed without re-running `pnpm install`.

**Rules** (non-negotiable):
- **NEVER** create reusable UI components in `apps/web` or `packages/*`. Always add to `D:\ux-design-shared\ui\src\components\` and use from there.
- **NEVER** add UI runtime deps (Radix, framer-motion, recharts, etc.) to any `package.json` in this repo. They belong to `@heuresys/ui` and are resolved through the symlink.
- If a component is genuinely heuresys-advanced-specific (e.g., wires a tenant-aware widget to `@heuresys/shared` Zod schemas), it lives in `apps/web/src/components/` — and even then, prefer composing `@heuresys/ui` primitives rather than re-implementing them.
- React peer: `@heuresys/ui` declares React via `peerDependencies`; `apps/web` is the one that installs the concrete React version. This avoids the "two Reacts" runtime crash.

**Maintenance / evolution**:
- Adding a new component: edit/add files under `D:\ux-design-shared\ui\src\components\` — appears in consumer instantly.
- Adding a new npm dep to `@heuresys/ui`: edit `D:\ux-design-shared\ui\package.json`, run `npm install --legacy-peer-deps` in `D:\ux-design-shared` root, commit the lockfile inside that repo. No action needed in `heuresys-advanced`.
- Versioning: `ux-design-shared` is its own git repo (initialized 2026-05-16, commit `b720ada`). Tag releases there when stable; consumers can pin to specific commits later by switching the `link:` to a `git+ssh://` or `git+https://` dep when the lib publishes elsewhere.
- Storybook (51 components, 16 tiers): `cd D:\ux-design-shared && npm run storybook` → `http://localhost:6006`.
- Re-validate symlink after a `pnpm install` accident or a Windows reboot: `readlink -f node_modules/@heuresys/ui` must return `/d/ux-design-shared/ui`. If it doesn't (e.g., pnpm resolved to a snapshot via `file:`), check that `package.json` says `link:` and the path is `../ux-design-shared/ui` (one level up from repo root).

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
