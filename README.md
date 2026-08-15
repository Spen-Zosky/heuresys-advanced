# Heuresys Advanced — HRMS / BPM Platform v5

Position-centric HR + BPM platform built as a pnpm monorepo. Fastify 5 API on PostgreSQL 16, Next.js 15 admin SPA + ESS portal, shared Zod contracts. Multi-tenant via API middleware (no Postgres RLS); RBAC is role × permission × mapping seeded (**live counts: `docs/kb/SOT_STATE.md`**).

> **Status — `v1.0.0` GA baseline (tag `v1.0.0` on `main`, S957) + post-v1.0 program in flight**
> MVP-1 → MVP-4 + RBAC/UIX/Perspectives epic **closed**; **v1.0.0 GA released**. The API ships ~75 business modules + auth under `/v1/*`, hitting the real OCI VM PostgreSQL through the SSH tunnel · zero mocks · MFA TOTP login-gating shipped · Brownfield Wave 1 IMPORT · idempotent migrations (run twice → empty `pg_dump` diff, `db:validate` 7/7) · live data on the rebuilt RTL_BANK reference tenant. VM runs in **production mode** (API tsup bundle `node dist/server.js` + web `next start`).
> **All running counts live in `docs/kb/SOT_STATE.md`** (handoff-governed — re-derived every session). This README intentionally avoids hardcoding volatile counts (modules / migrations / endpoints / tests / RBAC mappings); they drifted before (D-01) — `SOT_STATE.md` is the single source.
> **Live state SoT (two handoff-governed views)**: `.handoff/STATE.md` (rapid — priorities/open-questions) + `docs/kb/SOT_STATE.md` (granular snapshot — running counts/architecture) · backlog `docs/kb/SOT_BACKLOG.md` · debts `docs/kb/DEBT_REGISTER.md`.

---

## Headline numbers

> **Running counts are not hardcoded here** — they live (and are re-derived every session) in **`docs/kb/SOT_STATE.md`**. This avoids the recurring drift that hardcoded README numbers caused before. The shape of the system, layer by layer:

| Layer | What it is | Live count |
|---|---|---|
| API modules + endpoints | Fastify 5 business modules registered under `/v1/*` (+ auth/mfa/me ESS · 2 health) | `docs/kb/SOT_STATE.md` |
| Shared Zod schemas | `@heuresys/shared` workspace package — schemas + TS types, subpath exports per module | `docs/kb/SOT_STATE.md` |
| DB tables + migrations | `sys.*` business tables + views + `staging`/`reference_sync`/`audit` aux · idempotent numbered migrations (`000001..`) | `docs/kb/SOT_STATE.md` |
| Integration tests | vitest single-thread, real DB via SSH tunnel, no mocks | `docs/kb/SOT_STATE.md` |
| Web routes | admin SPA + ESS `/me/*` + teams + login + system-health + root router | `docs/kb/SOT_STATE.md` |
| Playwright E2E | live-data, storageState-backed, real seeded personas | `docs/kb/SOT_STATE.md` |
| Design system | `@heuresys/ui` npm-published (post-X18) — dashboard widgets + brand mark/wordmark + Shell/Header/Sidebar/Footer · live Storybook: **[spen-zosky.github.io/ux-design-shared](https://spen-zosky.github.io/ux-design-shared/)** | `docs/kb/SOT_STATE.md` |
| Showcase site | Static Next.js export, GitHub Pages deploy via `.github/workflows/showcase.yml` | `docs/kb/SOT_STATE.md` |

---

## Tech stack

**Backend** — Fastify 5 · Zod type-provider · Argon2id (64 MiB / 3 / 4) · RS256 JWT 15 min + 30 d refresh rotation w/ replay detection · CSRF double-submit · MFA TOTP RFC 6238 (otpauth) login-gating · raw parameterised SQL on `pg` · `vitest 4` via `app.inject`. (Exact pinned versions: `package.json` + `docs/kb/SOT_STATE.md`.)

**Frontend** — Next.js App Router · React 19 · Tailwind CSS 4 · TanStack Query v5 · React Hook Form · Zod · react-i18next (it/en) · Playwright · axe-playwright (WCAG 2.2 AA) · `@heuresys/ui` npm-published consumed as transitive dep (no duplication). (Exact pinned versions: `package.json` + `docs/kb/SOT_STATE.md`.)

**Database** — PostgreSQL 16 (native, no Docker — ADR-0004) running on OCI VM `oracle-vm-default` (eu-milan-1), reached via SSH tunnel `5433 → :5432` (ADR-0010 Option B / RD-25). Multi-tenant via FK + API middleware filter (I5 — never RLS).

**Tooling** — pnpm workspaces · TypeScript strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`) · Node (see `.nvmrc`) · Git on Windows + macOS + Linux · `pnpm.overrides` for security CVE bumps (current set: root `package.json`).

---

## Monorepo layout

```
heuresys-advanced/
├── apps/
│   ├── api/                            Fastify 5 API — business modules under /v1/*
│   │   ├── src/
│   │   │   ├── app.ts                  13-step plugin chain + LOG_REDACT_PATHS
│   │   │   ├── server.ts               network bind + env validation
│   │   │   ├── db/client.ts            singleton pg pool + withTransaction + isDatabaseReady
│   │   │   ├── middleware/             auth · rbac · csrf · tenantContext · requestId · errorHandler
│   │   │   ├── modules/                business modules (one dir each: repository/service/routes)
│   │   │   │   ├── auth/               login/refresh + mfa-routes (TOTP enroll/verify/list/del/verify-login)
│   │   │   │   ├── me/                 ESS endpoints (hard self-scope)
│   │   │   │   ├── compensation/       decision support (I8)
│   │   │   │   ├── dashboard/          role-gated aggregator
│   │   │   │   ├── brownfield-wave-executor/  state machine + transform-compiler + upsert-sql + audit-rule-codes
│   │   │   │   └── …more business modules (full list: docs/kb/INDEX_PATHS.md)
│   │   │   └── errors/                 typed error classes (UnauthorizedError, ForbiddenError, etc.)
│   │   └── test/                       integration test files (*.integration.test.ts) + unit
│   │
│   ├── web/                            Next.js App Router SPA
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx          root provider tree
│   │   │   │   ├── login/page.tsx      auth + MFA 2-step
│   │   │   │   ├── (authenticated)/
│   │   │   │   │   ├── layout.tsx      role-gated nav + logout
│   │   │   │   │   ├── me/…            ESS pages (incl. /me/security MFA enroll)
│   │   │   │   │   ├── dashboard/      admin landing
│   │   │   │   │   ├── system-health/  PLATFORM_ADMIN dashboard
│   │   │   │   │   ├── users/…         list + detail
│   │   │   │   │   ├── positions/…     list + detail + sub-resources
│   │   │   │   │   └── …other admin routes
│   │   │   ├── lib/api/                fetchApi · csrf-store · auth · landing · errors
│   │   │   ├── components/             SystemHealthDashboard (composition of @heuresys/ui widgets)
│   │   │   └── locales/{it,en}/        i18n keys × 2 locales (parity verified, i18n:check)
│   │   └── tests/e2e/                  spec files + auth.setup persona project
│   │
│   └── showcase/                       Static Next.js brand identity site
│       ├── src/app/showcase/           brand pages (icons/logo/palettes/tables/charts/etc.)
│       └── next.config.js              STATIC_EXPORT=1 → GitHub Pages /heuresys-advanced
│
├── packages/
│   └── shared/                         @heuresys/shared — Zod schemas + TS types, subpath exports per module
│
├── db/
│   ├── migrations/                     idempotent numbered SQL files (000001.., gap 000035 cosmetico)
│   ├── seeds/                          RTL_BANK_REFERENCE (users + positions + brownfield wave1 registry + SDBI Goals/OKRs)
│   └── scripts/                        .ps1 + .sh twins (create / migrate / reset / validate / brownfield-wave-1-preflight)
│
├── docs/
│   ├── BOOTSTRAP_EXECUTION_PLAN.md     §5 roadmap · §8 risk register · §9 decision log RD-01..RD-25
│   ├── api/API_IMPLEMENTATION_PLAN.md
│   ├── api/MVP_2A_API_GAP_AUDIT.md     v2.0 refreshed X12 (gap zero)
│   ├── architecture/adr/               ADRs (architectural decision records)
│   ├── frontend/FRONTEND_IMPLEMENTATION_PLAN.md
│   ├── security/AUTH_SECURITY_PLAN.md
│   ├── db/TARGET_SCHEMA_DESIGN.md
│   ├── brownfield/                     canonical docs + wave_runners/
│   ├── kb/                             SOT_STATE.md (running counts) · INDEX_PATHS.md (path index) · backlog · debts
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

Open `http://localhost:3000`, log in as one of the seeded personas (password from the `TEST_ADMIN_PASSWORD` env — set it in `.env`, no committed default; F-001). These are **real RTL_BANK users** wired by the S950 rebuild (the old `*.test` accounts were deleted); authority: `db/scripts/seed-test-admin.ts`:

| Persona | Email | Role | Lands on |
|---|---|---|---|
| Platform Admin | `enzo.spenuso@heuresys.com` | `PLATFORM_ADMIN` | `/dashboard` |
| Tenant Admin | `federica.marchetti@rtl-bank.org` | `TENANT_ADMIN` | `/dashboard` |
| Manager | `paolo.caputo@rtl-bank.org` | `MANAGER` | `/dashboard` |
| Employee (Paolo's report) | `tommaso.fiore@rtl-bank.org` | `USER` | `/me` |
| Outsider | `antonio.parisi@rtl-bank.org` | `USER` | `/me` |
| Employee | `marco.rinaldi@rtl-bank.org` | `USER` | `/me` |

> ⚠ **The password is not a shared literal**: since Z-262 it is **derived per e-mail** from
> the master key in `.secrets/` (gitignored). Using `TEST_ADMIN_PASSWORD` directly returns
> `LOGIN_INVALID` for every persona. Login is a **two-step** call (MFA is on, the second
> factor is a derived TOTP) — see `apps/api/scripts/verify-derived-login.mjs`.

---

## Testing

### API integration tests

```bash
cd apps/api
pnpm test                                                  # full suite (real DB via SSH tunnel)
pnpm exec vitest run test/<module>.integration.test.ts    # focused
```

Tests hit the **real DB through the SSH tunnel**. There are no mocks; the auth flow rotates real cookies, validates the JWT chain end-to-end, and MFA TOTP login-gating uses real RFC 6238 challenges. (Current suite size / pass counts: `docs/kb/SOT_STATE.md`.)

### Frontend E2E

```bash
cd apps/web
pnpm exec playwright install --with-deps chromium     # once
pnpm exec playwright test                              # full suite
pnpm exec playwright test landing-pages.spec.ts        # focused
```

The setup project (`tests/e2e/auth.setup.ts`) logs the seeded personas in once and persists their cookie state to `tests/.auth/<persona>.json`, so individual specs reuse the session without hitting the login rate limit (10/5 min per email).

Every spec asserts on **live data** from the seeded `RTL_BANK_REFERENCE` reference tenant (real RTL_BANK users + positions — see `docs/kb/SOT_STATE.md` §4). No mocks, no fixtures inlined in tests, no stubbed endpoints. **MFA enroll + verify-login** flows tested end-to-end with real TOTP tokens.

---

## Non-negotiable invariants

These are baked into the architecture and cannot be revisited without an ADR / decision-log entry:

- **I1** Position-centric model. Owner ≠ Incumbent.
- **I3 / I4** Business tables in `sys.sys_<plural>`. Aux schemas, **measured live** (`information_schema.schemata`): `staging`, `reference_sync`, `audit`. `brownfield` was **retired** by mig. `000297` (#164 F4) and no longer exists; `temp_sdbi` is gone too.
- **I5** Tenant isolation = FK + API middleware filter. **Never** Postgres RLS.
- **I7** Auth tables (11 `sys.sys_auth_*`) are separate from `sys.sys_users`.
- **I8** Compensation module is **decision support only**, not payroll execution.
- **I9** Position Intelligence Profile is a VIEW (no MATERIALIZED yet — ADR-0008 fallback option).
- **I13** PostgreSQL 16 native — no Docker (ADR-0004 hard policy).
- **RD-08** Categorical fields = `varchar(N) + CHECK`, never Postgres `ENUM`.
- **ADR-0011** ESS portal is hard self-scoped — no `:userId` in `/v1/me/*` URLs; `selfActor()` derives identity from JWT.
- **ADR-0013** Showcase SoT — `@heuresys/ui` → `apps/web` → `apps/showcase` mirror via `scripts/sync-showcase.sh` → GH Pages.

Full invariant list (I1-I22) + rationale in `CLAUDE.md` — that file is the source, and the
range is re-derived from it rather than restated here.

---

## Roadmap

| Milestone | Status | Tag |
|---|---|---|
| MVP-0 — Bootstrap, DB, 27 migrations, seed | ✅ closed | — |
| MVP-1 — API build-out (56 business modules + auth + ESS) | ✅ closed | — |
| MVP-2a — Admin SPA (30 routes) + auth client + axe a11y | ✅ closed acceptance-criteria-complete | `v0.2.1-mvp2a-final` |
| MVP-2b — ESS portal (`/v1/me/*` + 14 web pages) | ✅ closed | `v0.2.0-mvp2` |
| MVP-3 — GitHub Tier 0/1, MFA full TOTP login-gating, Brownfield Wave 1 pragmatic 13/19, WCAG 2.2 AA, `@heuresys/ui` npm publish, 2 CVE fixes | ✅ closed | `v0.3.2-mvp3-full` |
| MVP-4 — Brownfield Wave 2-4, SDBI Phase 2 (ADR-0014 ACCEPTED), MFA multi-kind, React Flow renderer, Mobile responsive, OCI Managed migration prep | ✅ closed with the `v1.0.0` GA baseline | `v1.0.0` |

Anything still open lives in the **Action register** of `docs/kb/SOT_BACKLOG.md` and in
`docs/kb/DEBT_REGISTER.md` — not here. This section used to carry three "P0 immediate"
(`DEFER-F`, `CW-B60-A`, `CW-B60-B`) which the debt register has long marked terminal, and
the two `CW-B60-*` concerned brownfield waves that **invariant I12 has since closed for
good** ("il rubinetto è chiuso"). A README that keeps its own to-do list drifts from the
register the moment one of the two is updated; the register is the source.

For details on what's next, see `.handoff/STATE.md` (live state) and `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md`.

---

## Repository

- **Code**: https://github.com/Spen-Zosky/heuresys-advanced (public)
- **Design system source**: https://github.com/Spen-Zosky/ux-design-shared (public, sorgente dev di `@heuresys/ui`)
- **Design system npm**: `@heuresys/ui` (consumed as a standard npm dep; current pinned range in `package.json`)
- **Design system Storybook (live)**: https://spen-zosky.github.io/ux-design-shared/
- **License**: UNLICENSED (private project, contact the author before reuse)
- **Author**: Enzo Spenuso

Generated and maintained with [Claude Code](https://claude.com/claude-code) + Cowork (Claude Opus supervisor).
