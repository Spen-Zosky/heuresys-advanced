# Heuresys Advanced — HRMS / BPM Platform v5

Position-centric HR + BPM platform built as a pnpm monorepo. Fastify 5 API on PostgreSQL 16, Next.js 15 admin SPA + ESS portal, shared Zod contracts. Multi-tenant via API middleware (no Postgres RLS), 8 roles × 101 permissions × 388 mappings seeded.

> **Status — 2026-05-28 (HEAD `e744a8a` on `main`, tag `v0.4.1-housekeeping-closed`)**
> MVP-1 + MVP-2a + MVP-2b + MVP-3 **closed**; **MVP-4 in progress**. 272 live API endpoints · 341+ vitest tests · 47 web routes live · 61 Playwright E2E tests on live OCI VM data · zero mocks · MFA TOTP login-gating shipped · Brownfield Wave 1 13/19 IMPORT pragmatic + 6 residual CW-B60 · `migrate.sh` re-runnable end-to-end (43 migrations, idempotent ×2).
> **Live state SoT**: `docs/kb/SOT_STATE.md` (CLI-owned) · backlog `docs/kb/SOT_BACKLOG.md` · debts `docs/kb/DEBT_REGISTER.md`. The headline numbers below are the MVP-3 closure snapshot; `SOT_STATE.md` carries the running counts.

---

## Headline numbers

| Layer | Count | Notes |
|---|---|---|
| API endpoints | **272** business + 2 health | 14 auth+mfa · 17 me ESS · 236 business · 2 health · 1 dashboard aggregator · 4 compensation |
| API modules | **58** | Fastify 5 routes registered under `/v1/*` |
| Shared Zod schemas | **427** in 59 subpath exports | `@heuresys/shared` workspace package |
| DB tables | **~110** in `sys.*` + 12 views + 18 staging.wave1_* + 7 brownfield aux + 4 audit aux | 43 idempotent migrations |
| Integration tests | **341 PASS / 1 FAIL** (skills:131 pre-existente known issue) **/ 5 SKIP** | vitest single-thread, real DB via SSH tunnel |
| Web routes shipped | **47** | 30 admin + 14 ESS + 1 login + 1 system-health + 1 root router |
| Playwright E2E tests | **61** in 20 spec | live-data, storageState-backed, 5 personas |
| Design system components | **14+ dashboard widgets** + brand mark/wordmark + Shell/Header/Sidebar/Footer | `@heuresys/ui` npm-published `^0.1.1` (post-X18) · live Storybook: **[spen-zosky.github.io/ux-design-shared](https://spen-zosky.github.io/ux-design-shared/)** |
| Showcase site | **19 routes** | Static Next.js 15 export, GitHub Pages deploy via `.github/workflows/showcase.yml` |

---

## Tech stack

**Backend** — Fastify 5.8 · Zod type-provider · Argon2id (64 MiB / 3 / 4) · RS256 JWT 15 min + 30 d refresh rotation w/ replay detection · CSRF double-submit · MFA TOTP RFC 6238 (otpauth) login-gating · raw parameterised SQL on `pg` (Drizzle only as pool wrapper) · `vitest 4` + `supertest` via `app.inject`.

**Frontend** — Next.js 15.5 App Router · React 19.2 · Tailwind CSS 4.3 · TanStack Query v5.62 · React Hook Form 7.55 · Zod 3.25 · react-i18next 15 (it/en) · Playwright 1.55 · axe-playwright (WCAG 2.2 AA) · `@heuresys/ui` npm-published consumed as transitive dep (no duplication).

**Database** — PostgreSQL 16 (native, no Docker — ADR-0004) running on OCI VM `oracle-vm-default` (eu-milan-1), reached via SSH tunnel `5433 → :5432` (ADR-0010 Option B / RD-25). Multi-tenant via FK + API middleware filter (I5 — never RLS).

**Tooling** — pnpm 9.15 workspaces · TypeScript 5.7 strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`) · Node 20 LTS · Git on Windows + macOS + Linux · 5 pnpm.overrides (vite, postcss, esbuild, qs, exceljs>uuid) per security CVE bumps.

---

## Monorepo layout

```
heuresys-advanced/
├── apps/
│   ├── api/                            Fastify 5 API (58 modules, /v1/*)
│   │   ├── src/
│   │   │   ├── app.ts                  13-step plugin chain + LOG_REDACT_PATHS
│   │   │   ├── server.ts               network bind + env validation
│   │   │   ├── db/client.ts            singleton pg pool + withTransaction + isDatabaseReady
│   │   │   ├── middleware/             auth · rbac · csrf · tenantContext · requestId · errorHandler
│   │   │   ├── modules/                58 business modules
│   │   │   │   ├── auth/               9 endpoints + mfa-routes 5 endpoints (TOTP enroll/verify/list/del/verify-login)
│   │   │   │   ├── me/                 17 ESS endpoints (hard self-scope)
│   │   │   │   ├── compensation/       4 endpoints (decision support, I8)
│   │   │   │   ├── dashboard/          1 role-gated aggregator
│   │   │   │   ├── brownfield-wave-executor/  state machine 8 stati + transform-compiler + upsert-sql + audit-rule-codes
│   │   │   │   ├── …54 more business modules
│   │   │   └── errors/                 typed error classes (UnauthorizedError, ForbiddenError, etc.)
│   │   └── test/                       52 test files (41 *.integration.test.ts + 11 unit)
│   │
│   ├── web/                            Next.js 15 SPA (47 routes)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx          root provider tree
│   │   │   │   ├── login/page.tsx      auth + MFA 2-step
│   │   │   │   ├── (authenticated)/
│   │   │   │   │   ├── layout.tsx      role-gated nav + logout
│   │   │   │   │   ├── me/…            14 ESS pages (incl. /me/security MFA enroll)
│   │   │   │   │   ├── dashboard/      admin landing
│   │   │   │   │   ├── system-health/  PLATFORM_ADMIN dashboard
│   │   │   │   │   ├── users/…         list + detail
│   │   │   │   │   ├── positions/…     list + detail + 3 sub-resources
│   │   │   │   │   └── …other admin routes
│   │   │   ├── lib/api/                fetchApi · csrf-store · auth · landing · errors
│   │   │   ├── components/             SystemHealthDashboard (composition of @heuresys/ui widgets)
│   │   │   └── locales/{it,en}/        23 keys × 2 locales (parity verified)
│   │   └── tests/e2e/                  20 spec files (61 test() calls) + auth.setup persona project
│   │
│   └── showcase/                       Static Next.js 15 brand identity site (19 routes)
│       ├── src/app/showcase/           18 brand pages (icons/logo/palettes/tables/charts/etc.)
│       └── next.config.js              STATIC_EXPORT=1 → GitHub Pages /heuresys-advanced
│
├── packages/
│   └── shared/                         @heuresys/shared — 59 subpath exports, 427 Zod schemas
│
├── db/
│   ├── migrations/                     43 idempotent SQL files (000001..000044, gap 000035 cosmetico)
│   ├── seeds/                          RTL_BANK_REFERENCE (158 users + 55 positions + brownfield wave1 registry + SDBI Goals/OKRs)
│   └── scripts/                        .ps1 + .sh twins (create / migrate / reset / validate / brownfield-wave-1-preflight)
│
├── docs/
│   ├── BOOTSTRAP_EXECUTION_PLAN.md     §5 roadmap · §8 risk register · §9 decision log RD-01..RD-25
│   ├── api/API_IMPLEMENTATION_PLAN.md
│   ├── api/MVP_2A_API_GAP_AUDIT.md     v2.0 refreshed X12 (gap zero)
│   ├── architecture/adr/               18 ADRs (16 file + ADR-0017 retroactive)
│   ├── frontend/FRONTEND_IMPLEMENTATION_PLAN.md
│   ├── security/AUTH_SECURITY_PLAN.md
│   ├── db/TARGET_SCHEMA_DESIGN.md
│   ├── brownfield/                     5 canonical + wave_runners/ (Wave 1 + future Wave 2-4 stubs)
│   ├── github/                         32 docs (8 cluster onboarding curriculum)
│   └── a11y-tail-items.md              MVP-3 register
│
├── cowork_code_exchange/               Cowork↔Claude Code CLI protocol v2.2 (~140 file: Goal 001/002/003 + batch X1-X21)
├── cowork_reserved/                    KB forensic F0-F12 + 12 batch_cN + bias_registry CW-B17..B60 + HANDOFF_FRESH_SESSION
├── qa_artifacts/                       Coverage matrix + Playwright/axe/build logs + release notes
├── scripts/cowork-exchange/            Protocol v2.2 toolchain (status/inbox/locks/notify/validate/session)
├── sessioni/                           Session deliverables (forensic state of the art + pre-flight reports)
├── .handoff/STATE.md                   SoT operativa cross-session
├── .github/                            1 workflow (showcase deploy) + Dependabot + CODEOWNERS + SECURITY + templates
├── CLAUDE.md                           Conventions for AI-assisted dev (post-X18 Design System npm doctrine)
├── HANDOFF.md                          Cronologia sessione
├── NEXT_SESSION_MVP_2A.md              Live-data E2E doctrine (storica, ancora applicable)
└── README.md                           (this file)
```

---

## Getting started

### 1. Prerequisites

- Node.js ≥ 20.11 · pnpm ≥ 9 (project pin `pnpm@9.15.0`)
- PostgreSQL 16 reachable on `localhost:5433` (we use an SSH tunnel to an OCI VM — see `.env.example`)
- SSH access configured for `oracle-vm-default` host (key in `C:\Users\<user>\.ssh\oci_recovery_ed25519`)
- For the web E2E suite: `playwright install chromium` runs once after `pnpm install`

### 2. Clone + install

```bash
git clone https://github.com/Spen-Zosky/heuresys-advanced.git
cd heuresys-advanced
pnpm install
```

**Note**: post-X18 migration, `@heuresys/ui` is npm-published (`^0.1.1`) and resolved via standard pnpm dep resolution. **NO sibling `ux-design-shared` clone needed** for normal dev. Sibling repo is only needed if you intend to develop UI components themselves (Storybook + tsup publish workflow).

### 3. Environment

Copy `.env.example` to `.env` at the repo root. Required variables include `POSTGRES_*` connection params, `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` PEM strings (gitignored under `.secrets/`), `COOKIE_SECRET` (48-byte base64), and `MFA_ENCRYPTION_KEY` (post-Tappa-E full shipped).

### 4. Tunnel + DB smoke

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
```

### 5. Run

```bash
pnpm dev                  # all workspaces in parallel
# or per-app:
cd apps/api && pnpm dev   # → :3001  Fastify 5 API
cd apps/web && pnpm dev   # → :3000  Next.js 15 SPA
cd apps/showcase && pnpm dev  # → :3010  Static brand showcase
```

Open `http://localhost:3000`, log in as one of the 5 seeded personas (password `Admin#PassW0rd!`):

| Persona | Email | Role | Lands on |
|---|---|---|---|
| Platform Admin | `admin@heuresys.com` | `PLATFORM_ADMIN` | `/dashboard` |
| Tenant Admin | `tenant_admin_test@rtl-bank.test` | `TENANT_ADMIN` | `/dashboard` |
| Manager | `manager_test@rtl-bank.test` | `MANAGER` | `/dashboard` |
| Employee | `employee_test@rtl-bank.test` | `USER` | `/me` |
| Outsider | `outsider_test@rtl-bank.test` | `USER` | `/me` |

---

## Testing

### API integration tests

```bash
cd apps/api
pnpm test                                                  # full suite (~341 PASS / 1 FAIL skills:131 / 5 SKIP, ~3-8 min)
pnpm exec vitest run test/<module>.integration.test.ts    # focused
```

Tests hit the **real DB through the SSH tunnel**. There are no mocks; the auth flow rotates real cookies, validates the JWT chain end-to-end, and MFA TOTP login-gating uses real RFC 6238 challenges.

### Frontend E2E

```bash
cd apps/web
pnpm exec playwright install --with-deps chromium     # once
pnpm exec playwright test                              # full suite (61 tests)
pnpm exec playwright test landing-pages.spec.ts        # focused
```

The setup project (`tests/e2e/auth.setup.ts`) logs in 5 personas once and persists their cookie state to `tests/.auth/<persona>.json`, so individual specs reuse the session without hitting the login rate limit (10/5 min per email).

Every spec asserts on **live data** from the seeded `RTL_BANK_REFERENCE` tenant (158 personas + 55 positions). No mocks, no fixtures inlined in tests, no stubbed endpoints. **MFA enroll + verify-login** flows tested end-to-end with real TOTP tokens.

---

## Non-negotiable invariants

These are baked into the architecture and cannot be revisited without an ADR / decision-log entry:

- **I1** Position-centric model. Owner ≠ Incumbent.
- **I3 / I4** Business tables in `sys.sys_<plural>`. Aux schemas: `staging`, `brownfield`, `audit`, `temp_sdbi` (ADR-0014).
- **I5** Tenant isolation = FK + API middleware filter. **Never** Postgres RLS.
- **I7** Auth tables (11 `sys.sys_auth_*`) are separate from `sys.sys_users`.
- **I8** Compensation module is **decision support only**, not payroll execution.
- **I9** Position Intelligence Profile is a VIEW (no MATERIALIZED yet — ADR-0008 fallback option).
- **I13** PostgreSQL 16 native — no Docker (ADR-0004 hard policy).
- **RD-08** Categorical fields = `varchar(N) + CHECK`, never Postgres `ENUM`.
- **ADR-0011** ESS portal is hard self-scoped — no `:userId` in `/v1/me/*` URLs; `selfActor()` derives identity from JWT.
- **ADR-0013** Showcase SoT — `@heuresys/ui` → `apps/web` → `apps/showcase` mirror via `scripts/sync-showcase.sh` → GH Pages.

Full invariant list (I1-I14) + rationale in `CLAUDE.md`.

---

## Roadmap

| Milestone | Status | Tag |
|---|---|---|
| MVP-0 — Bootstrap, DB, 27 migrations, seed | ✅ closed | — |
| MVP-1 — API build-out (56 business modules + auth + ESS) | ✅ closed | — |
| MVP-2a — Admin SPA (30 routes) + auth client + axe a11y | ✅ closed acceptance-criteria-complete | `v0.2.1-mvp2a-final` |
| MVP-2b — ESS portal (`/v1/me/*` + 14 web pages) | ✅ closed | `v0.2.0-mvp2` |
| MVP-3 — GitHub Tier 0/1, MFA full TOTP login-gating, Brownfield Wave 1 pragmatic 13/19, WCAG 2.2 AA, `@heuresys/ui` npm publish, 2 CVE fixes | ✅ closed | `v0.3.2-mvp3-full` |
| MVP-4 — Brownfield Wave 2-4, SDBI Phase 2 (ADR-0014 ACCEPTED), MFA multi-kind, React Flow renderer, Mobile responsive, OCI Managed migration prep | ⏳ planned (vedi `docs/MVP_4_ROADMAP.md`) | — |

3 P0 immediate da chiudere prima di MVP-4 (vedi `.handoff/STATE.md` + `sessioni/.../FORENSIC_STATE_OF_ART_2026-05-26.md`):
- **DEFER-F** `/showcase` Next 15 RSC bundle threshold proper fix (PROMPT 025 X21 pending)
- **CW-B60-A** brownfield engine silent-filter (3 target AUTO_APPROVED + 0 upserted)
- **CW-B60-B** Wave 2 scope ADR (3 target IMPORT senza staging source)

For details on what's next, see `.handoff/STATE.md` (live state) and `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md`.

---

## Repository

- **Code**: https://github.com/Spen-Zosky/heuresys-advanced (public)
- **Design system source**: https://github.com/Spen-Zosky/ux-design-shared (public, sorgente dev di `@heuresys/ui`)
- **Design system npm**: `@heuresys/ui` (semver `^0.1.1`, consumed as standard dep)
- **Design system Storybook (live)**: https://spen-zosky.github.io/ux-design-shared/
- **License**: UNLICENSED (private project, contact the author before reuse)
- **Author**: Enzo Spenuso

Generated and maintained with [Claude Code](https://claude.com/claude-code) + Cowork (Claude Opus supervisor).
